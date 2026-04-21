import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student, Profile, TimetableEntry, AttendanceLog } from '../types';

interface MissingAttendanceAlertProps {
  students: Student[];
  profile: Profile;
  refreshData: () => Promise<void>;
}

interface MissingEntry {
  date: string;
  subjectId: string;
  division: string;
  lectureNo: number;
  batch?: string;
}

export default function MissingAttendanceAlert({ students, profile, refreshData }: MissingAttendanceAlertProps) {
  const [missingList, setMissingList] = useState<MissingEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile.role !== 'faculty' && profile.role !== 'admin') return;

    const calculateMissing = async () => {
      // Fetch timetable for this faculty
      const { data: timetableData } = await supabase
        .from('timetable')
        .select('*')
        .eq('faculty_id', profile.id);

      if (!timetableData || timetableData.length === 0) return;

      // Fetch logs for this faculty
      const { data: logsData } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('faculty_id', profile.id);

      const logs = (logsData || []) as AttendanceLog[];
      const timetable = timetableData as TimetableEntry[];

      const pastDays: { date: string, dayOfWeek: number }[] = [];
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      
      // Get last 5 weekdays
      while (pastDays.length < 5) {
        d.setDate(d.getDate() - 1);
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday(0) and Saturday(6)
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          pastDays.push({ date: `${year}-${month}-${day}`, dayOfWeek });
        }
      }

      const ignored = JSON.parse(localStorage.getItem(`edumark_ignored_attendance_${profile.id}`) || '[]');
      const missing: MissingEntry[] = [];

      pastDays.forEach(day => {
        // Find all lectures this faculty was supposed to teach on this day of the week
        const dayTimetable = timetable.filter(t => {
          if (t.day_of_week !== day.dayOfWeek) return false;
          if (profile.role !== 'admin' && !(profile.assigned_subjects || []).includes(t.subject_id)) return false;
          return true;
        });
        
        // Group practicals so we only check the first lecture of a block (consecutive lectures)
        const processedTimetable: typeof dayTimetable = [];
        
        // Sort by subject, division, batch, then lecture_no to ensure consecutive grouping works even with interleaved batches
        const sortedTimetable = [...dayTimetable].sort((a, b) => {
          if (a.subject_id !== b.subject_id) return a.subject_id.localeCompare(b.subject_id);
          if (a.division !== b.division) return a.division.localeCompare(b.division);
          const batchA = a.batch || '';
          const batchB = b.batch || '';
          if (batchA !== batchB) return batchA.localeCompare(batchB);
          return a.lecture_no - b.lecture_no;
        });
        
        sortedTimetable.forEach(t => {
          const isPractical = t.subject_id.endsWith('L') || t.subject_id === 'PBL';
          if (isPractical) {
            // Check if the previous lecture in the processed list is part of the same block
            const prev = processedTimetable[processedTimetable.length - 1];
            if (prev && 
                prev.subject_id === t.subject_id && 
                prev.division === t.division && 
                prev.batch === t.batch && 
                prev.lecture_no === t.lecture_no - 1) {
              // It's consecutive, so we skip adding it (it's part of the same block)
              return;
            }
            processedTimetable.push(t);
          } else {
            processedTimetable.push(t);
          }
        });

        processedTimetable.forEach(t => {
          const key = `${day.date}_${t.subject_id}_${t.division}_${t.lecture_no}_${t.batch || ''}`;
          if (ignored.includes(key)) return;

          // Check if an action was logged (Holiday / No Lecture) for this date/subject/division/batch/lecture
          const isLogged = logs.some(l => 
            l.date === day.date && 
            l.subject_id === t.subject_id && 
            l.division === t.division &&
            (l.batch === t.batch || (!l.batch && !t.batch)) &&
            (!l.notes || l.notes === t.lecture_no.toString())
          );
          
          if (isLogged) return;

          // Check if attendance was marked for this specific division, subject, date, lecture, and batch
          const studentsInDiv = students.filter(s => s.division === t.division && (!t.batch || s.batch === t.batch));
          const hasAttendance = studentsInDiv.some(s => 
            s.attendance[t.subject_id]?.some(a => a.date === day.date && a.lectureNo === t.lecture_no)
          );

          if (!hasAttendance && studentsInDiv.length > 0) {
            missing.push({ 
              date: day.date, 
              subjectId: t.subject_id, 
              division: t.division, 
              lectureNo: t.lecture_no,
              batch: t.batch
            });
          }
        });
      });

      // Sort by date descending
      missing.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMissingList(missing);
    };

    calculateMissing();
  }, [students, profile]);

  const handleIgnore = (entry: MissingEntry) => {
    const key = `${entry.date}_${entry.subjectId}_${entry.division}_${entry.lectureNo}_${entry.batch || ''}`;
    const ignored = JSON.parse(localStorage.getItem(`edumark_ignored_attendance_${profile.id}`) || '[]');
    ignored.push(key);
    localStorage.setItem(`edumark_ignored_attendance_${profile.id}`, JSON.stringify(ignored));
    
    setMissingList(prev => prev.filter(m => !(m.date === entry.date && m.subjectId === entry.subjectId && m.division === entry.division && m.lectureNo === entry.lectureNo && m.batch === entry.batch)));
  };

  const handleLogAction = async (entry: MissingEntry, action: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('attendance_logs').insert({
        date: entry.date,
        subject_id: entry.subjectId,
        division: entry.division,
        batch: entry.batch || null,
        faculty_id: profile.id,
        action: action,
        notes: entry.lectureNo.toString()
      });

      if (error) throw error;

      // Remove from missing list
      setMissingList(prev => prev.filter(m => !(m.date === entry.date && m.subjectId === entry.subjectId && m.division === entry.division && m.lectureNo === entry.lectureNo && m.batch === entry.batch)));
    } catch (err: any) {
      console.error('Error logging action:', err);
      alert('Failed to log action: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllPresent = async (entry: MissingEntry) => {
    setIsLoading(true);
    try {
      const studentsInDiv = students.filter(s => s.division === entry.division && (!entry.batch || s.batch === entry.batch));
      const records = studentsInDiv.map(student => ({
        student_id: student.id,
        subject: entry.subjectId,
        date: entry.date,
        lecture_no: entry.lectureNo,
        status: 1, // Present
        marked_by: profile.id
      }));

      const { error } = await supabase.from('attendance').upsert(records, {
        onConflict: 'student_id, subject, date, lecture_no'
      });

      if (error) throw error;

      // Also add to ignored list so it doesn't pop up again if they delete the records later
      const key = `${entry.date}_${entry.subjectId}_${entry.division}_${entry.lectureNo}_${entry.batch || ''}`;
      const ignored = JSON.parse(localStorage.getItem(`edumark_ignored_attendance_${profile.id}`) || '[]');
      if (!ignored.includes(key)) {
        ignored.push(key);
        localStorage.setItem(`edumark_ignored_attendance_${profile.id}`, JSON.stringify(ignored));
      }

      await refreshData();
    } catch (err: any) {
      console.error('Error marking all present:', err);
      alert('Failed to mark attendance: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (missingList.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="bg-amber-100 p-2 rounded-xl mt-0.5">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-amber-900 font-bold">Missing Attendance Records</h3>
            <p className="text-amber-700 text-sm mt-1">
              You have {missingList.length} unmarked lecture{missingList.length > 1 ? 's' : ''} from the past week.
            </p>
          </div>
        </div>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold"
        >
          <span>{expanded ? 'Hide' : 'Review'}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2">
          {missingList.map(m => {
            const [y, month, d] = m.date.split('-');
            const dateObj = new Date(parseInt(y), parseInt(month) - 1, parseInt(d));
            const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            return (
              <div key={`${m.date}_${m.subjectId}_${m.division}_${m.lectureNo}_${m.batch || ''}`} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <div>
                    <span className="font-bold text-slate-800">{formattedDate}</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-slate-500 text-xs font-medium px-2 py-0.5 bg-slate-100 rounded-md">{m.subjectId}</span>
                      <span className="text-indigo-600 text-xs font-bold px-2 py-0.5 bg-indigo-50 rounded-md">Div {m.division}</span>
                      {m.batch && <span className="text-amber-600 text-xs font-bold px-2 py-0.5 bg-amber-50 rounded-md">Batch {m.batch}</span>}
                      <span className="text-slate-500 text-xs font-medium">Lec {m.lectureNo}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
                  <button 
                    onClick={() => handleMarkAllPresent(m)}
                    disabled={isLoading}
                    className="flex items-center space-x-1.5 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl hover:bg-emerald-100 font-bold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark All Present</span>
                  </button>
                  <button 
                    onClick={() => handleLogAction(m, 'Holiday / No Lecture')}
                    disabled={isLoading}
                    className="flex items-center space-x-1.5 text-sm bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 font-bold transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Holiday / No Lecture</span>
                  </button>
                  <button 
                    onClick={() => handleIgnore(m)}
                    disabled={isLoading}
                    className="flex items-center space-x-1.5 text-sm bg-white text-slate-500 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 font-bold transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Mark Later</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
