import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useInstitution } from '../context/InstitutionContext';
import type { Student, Profile, TimetableEntry } from '../types';

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
  const navigate = useNavigate();
  const { institutionId, scopeQuery } = useInstitution();
  const [missingList, setMissingList] = useState<MissingEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile.role !== 'faculty' && profile.role !== 'admin') return;

    const calculateMissing = async () => {
      const { data: timetableData } = await scopeQuery(supabase
        .from('timetable')
        .select('*'))
        .eq('faculty_id', profile.id);

      if (!timetableData || timetableData.length === 0) return;

      const { data: logsData } = await scopeQuery(supabase
        .from('admin_logs')
        .select('*'))
        .eq('actor_id', profile.id)
        .eq('category', 'attendance');

      // Parse details field to reconstruct comparable log info
      interface ParsedLog { date: string; subject_id: string; division: string; batch?: string; lecture_no?: string; action: string; }
      const logs: ParsedLog[] = (logsData || []).map((r: any) => {
        // Details format: "SUBJ · Div X · Batch Y · L2 · 2026-04-19"
        const parts = (r.details || '').split(' · ');
        const dateStr = parts.find((p: string) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || '';
        const divPart = parts.find((p: string) => p.startsWith('Div '));
        const batchPart = parts.find((p: string) => p.startsWith('Batch '));
        const lecPart = parts.find((p: string) => p.startsWith('Lecture '));
        return {
          date: dateStr,
          subject_id: parts[0] || '',
          division: divPart ? divPart.replace('Div ', '') : '',
          batch: batchPart ? batchPart.replace('Batch ', '') : undefined,
          lecture_no: lecPart ? lecPart.replace('Lecture ', '') : undefined,
          action: r.action || '',
        };
      });
      const timetable = timetableData as TimetableEntry[];

      const pastDays: { date: string, dayOfWeek: number }[] = [];
      const d = new Date();
      d.setHours(0, 0, 0, 0);

      while (pastDays.length < 5) {
        d.setDate(d.getDate() - 1);
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          pastDays.push({ date: `${year}-${month}-${day}`, dayOfWeek });
        }
      }

      const ignored = JSON.parse(localStorage.getItem(`edumark_ignored_attendance_${profile.id}`) || '[]');
      const missing: MissingEntry[] = [];

      pastDays.forEach(day => {
        const dayTimetable = timetable.filter(t => {
          if (t.day_of_week !== day.dayOfWeek) return false;
          if (profile.role !== 'admin' && !(profile.assigned_subjects || []).includes(t.subject_id)) return false;
          return true;
        });

        const processedTimetable: typeof dayTimetable = [];

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
            const prev = processedTimetable[processedTimetable.length - 1];
            if (prev &&
                prev.subject_id === t.subject_id &&
                prev.division === t.division &&
                prev.batch === t.batch &&
                prev.lecture_no === t.lecture_no - 1) {
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

          const isLogged = logs.some(l =>
            l.date === day.date &&
            l.subject_id === t.subject_id &&
            l.division === t.division &&
            (l.batch === t.batch || (!l.batch && !t.batch))
          );

          if (isLogged) return;

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
      const { error } = await supabase.from('admin_logs').insert({
        actor_id: profile.id,
        category: 'attendance',
        action: action,
        details: [
          entry.subjectId,
          `Div ${entry.division}`,
          entry.batch ? `Batch ${entry.batch}` : null,
          `Lecture ${entry.lectureNo}`,
          entry.date,
        ].filter(Boolean).join(' · '),
        institution_id: institutionId,
      });

      if (error) throw error;

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
        status: 1,
        marked_by: profile.id,
        institution_id: institutionId
      }));

      const { error } = await supabase.from('attendance').upsert(records, {
        onConflict: 'student_id, subject, date, lecture_no'
      });

      if (error) throw error;

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
    <div className="bg-card border border-cream-border rounded-3xl p-5 md:p-6 mb-8 relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-ochre/10 p-2.5 rounded-xl border border-ochre/20 shrink-0">
            <AlertCircle className="w-5 h-5 text-ochre" />
          </div>
          <div>
            <p className="eyebrow text-ink-muted">Needs attention</p>
            <h3 className="font-sans text-lg font-semibold text-ink mt-1 tracking-tight">
              Unmarked class sessions
            </h3>
            <p className="text-ink-muted text-sm mt-1.5 leading-relaxed">
              <span className="tabular-nums font-semibold text-ink">{missingList.length}</span> lecture{missingList.length > 1 ? 's' : ''} in the last week have no attendance saved yet.
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-ink hover:text-ochre-deep bg-cream hover:bg-cream-soft border border-cream-border px-3 py-2 rounded-xl text-[0.8125rem] font-semibold shrink-0"
        >
          <span>{expanded ? 'Hide' : 'Review'}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-5 space-y-2">
          {missingList.map(m => {
            const [y, month, d] = m.date.split('-');
            const dateObj = new Date(parseInt(y), parseInt(month) - 1, parseInt(d));
            const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            return (
              <div key={`${m.date}_${m.subjectId}_${m.division}_${m.lectureNo}_${m.batch || ''}`} className="flex flex-col sm:flex-row sm:items-center justify-between bg-paper p-4 rounded-2xl border border-cream-border gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0" />
                  <div>
                    <span className="font-semibold text-ink">{formattedDate}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-ink text-[0.6875rem] font-semibold px-2 py-0.5 bg-cream border border-cream-border rounded">{m.subjectId}</span>
                      <span className="text-ink text-[0.6875rem] font-semibold px-2 py-0.5 bg-ochre/10 border border-ochre/30 rounded">Div {m.division}</span>
                      {m.batch && <span className="text-ochre-deep text-[0.6875rem] font-semibold px-2 py-0.5 bg-ochre/10 border border-ochre/30 rounded">Batch {m.batch}</span>}
                      <span className="text-ink-muted text-[0.6875rem] font-medium">Lecture {m.lectureNo}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        subject: m.subjectId,
                        division: m.division,
                        date: m.date,
                        lecture: String(m.lectureNo),
                      });
                      if (m.batch) params.set('batch', m.batch);
                      navigate(`/attendance?${params.toString()}`);
                    }}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-night text-white border border-night px-3.5 py-2 rounded-xl hover:bg-night-soft font-semibold"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Mark now</span>
                  </button>
                  <button
                    onClick={() => handleMarkAllPresent(m)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-ochre text-white border border-ochre px-3.5 py-2 rounded-xl hover:bg-ochre-deep font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>All present</span>
                  </button>
                  <button
                    onClick={() => handleLogAction(m, 'Holiday / No Lecture')}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-card text-ink border border-cream-border px-3.5 py-2 rounded-xl hover:border-ochre/40 font-semibold disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Holiday</span>
                  </button>
                  <button
                    onClick={() => handleIgnore(m)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-card text-ink-muted border border-cream-border px-3.5 py-2 rounded-xl hover:text-ink font-semibold disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Later</span>
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
