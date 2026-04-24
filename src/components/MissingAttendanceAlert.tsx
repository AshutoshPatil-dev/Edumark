import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useInstitution } from '../context/InstitutionContext';
import type { Student, Profile, TimetableEntry } from '../types';
import { useSync } from '../context/SyncContext';

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

interface ParsedLog {
  date: string;
  subject_id: string;
  division: string;
  batch?: string;
  lecture_no?: string;
  action: string;
}

function parseAttendanceLog(details: string): ParsedLog {
  const normalizedParts = details.split(/ · | Â· /);
  const dateStr = normalizedParts.find((part) => /^\d{4}-\d{2}-\d{2}$/.test(part)) || '';
  const divPart = normalizedParts.find((part) => part.startsWith('Div '));
  const batchPart = normalizedParts.find((part) => part.startsWith('Batch '));
  const lecPart = normalizedParts.find((part) => part.startsWith('Lecture '));

  return {
    date: dateStr,
    subject_id: normalizedParts[0] || '',
    division: divPart ? divPart.replace('Div ', '') : '',
    batch: batchPart ? batchPart.replace('Batch ', '') : undefined,
    lecture_no: lecPart ? lecPart.replace('Lecture ', '') : undefined,
    action: '',
  };
}

export default function MissingAttendanceAlert({ students, profile, refreshData }: MissingAttendanceAlertProps) {
  const navigate = useNavigate();
  const { institutionId, scopeQuery } = useInstitution();
  const { isOnline, addToQueue } = useSync();
  const [missingList, setMissingList] = useState<MissingEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile.role !== 'faculty' && profile.role !== 'admin') {
      return;
    }

    const calculateMissing = async () => {
      const { data: timetableData } = await scopeQuery(
        supabase
          .from('timetable')
          .select('*')
      )
        .eq('faculty_id', profile.id);

      if (!timetableData || timetableData.length === 0) {
        setMissingList([]);
        return;
      }

      const { data: logsData } = await scopeQuery(
        supabase
          .from('admin_logs')
          .select('*')
      )
        .eq('actor_id', profile.id)
        .eq('category', 'attendance');

      const logs: ParsedLog[] = (logsData || []).map((record: any) => ({
        ...parseAttendanceLog(record.details || ''),
        action: record.action || '',
      }));
      const timetable = timetableData as TimetableEntry[];

      const pastDays: { date: string; dayOfWeek: number }[] = [];
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);

      while (pastDays.length < 5) {
        cursor.setDate(cursor.getDate() - 1);
        const dayOfWeek = cursor.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const year = cursor.getFullYear();
          const month = String(cursor.getMonth() + 1).padStart(2, '0');
          const day = String(cursor.getDate()).padStart(2, '0');
          pastDays.push({ date: `${year}-${month}-${day}`, dayOfWeek });
        }
      }

      const ignored = JSON.parse(localStorage.getItem(`edumark_ignored_attendance_${profile.id}`) || '[]');
      const missing: MissingEntry[] = [];

      for (const day of pastDays) {
        const dayTimetable = timetable.filter((entry) => {
          if (entry.day_of_week !== day.dayOfWeek) {
            return false;
          }
          if (profile.role !== 'admin' && !(profile.assigned_subjects || []).includes(entry.subject_id)) {
            return false;
          }
          return true;
        });

        const processedTimetable: TimetableEntry[] = [];
        const sortedTimetable = [...dayTimetable].sort((left, right) => {
          if (left.subject_id !== right.subject_id) {
            return left.subject_id.localeCompare(right.subject_id);
          }
          if (left.division !== right.division) {
            return left.division.localeCompare(right.division);
          }
          const leftBatch = left.batch || '';
          const rightBatch = right.batch || '';
          if (leftBatch !== rightBatch) {
            return leftBatch.localeCompare(rightBatch);
          }
          return left.lecture_no - right.lecture_no;
        });

        sortedTimetable.forEach((entry) => {
          const isPractical = entry.subject_id.endsWith('L') || entry.subject_id === 'PBL';
          if (!isPractical) {
            processedTimetable.push(entry);
            return;
          }

          const previousEntry = processedTimetable[processedTimetable.length - 1];
          if (
            previousEntry &&
            previousEntry.subject_id === entry.subject_id &&
            previousEntry.division === entry.division &&
            previousEntry.batch === entry.batch &&
            previousEntry.lecture_no === entry.lecture_no - 1
          ) {
            return;
          }

          processedTimetable.push(entry);
        });

        processedTimetable.forEach((entry) => {
          const key = `${day.date}_${entry.subject_id}_${entry.division}_${entry.lecture_no}_${entry.batch || ''}`;
          if (ignored.includes(key)) {
            return;
          }

          const isLogged = logs.some((log) =>
            log.date === day.date &&
            log.subject_id === entry.subject_id &&
            log.division === entry.division &&
            (log.batch === entry.batch || (!log.batch && !entry.batch)) &&
            log.lecture_no === String(entry.lecture_no)
          );

          if (isLogged) {
            return;
          }

          const studentsInSlot = students.filter(
            (student) => student.division === entry.division && (!entry.batch || student.batch === entry.batch),
          );
          const hasAttendance = studentsInSlot.some((student) =>
            student.attendance[entry.subject_id]?.some(
              (attendance) => attendance.date === day.date && attendance.lectureNo === entry.lecture_no,
            ),
          );

          if (!hasAttendance && studentsInSlot.length > 0) {
            missing.push({
              date: day.date,
              subjectId: entry.subject_id,
              division: entry.division,
              lectureNo: entry.lecture_no,
              batch: entry.batch,
            });
          }
        });
      }

      missing.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
      setMissingList(missing);
    };

    calculateMissing();
  }, [profile, scopeQuery, students]);

  const handleIgnore = (entry: MissingEntry) => {
    const key = `${entry.date}_${entry.subjectId}_${entry.division}_${entry.lectureNo}_${entry.batch || ''}`;
    const ignored = JSON.parse(localStorage.getItem(`edumark_ignored_attendance_${profile.id}`) || '[]');
    ignored.push(key);
    localStorage.setItem(`edumark_ignored_attendance_${profile.id}`, JSON.stringify(ignored));

    setMissingList((prev) =>
      prev.filter(
        (item) =>
          !(
            item.date === entry.date &&
            item.subjectId === entry.subjectId &&
            item.division === entry.division &&
            item.lectureNo === entry.lectureNo &&
            item.batch === entry.batch
          ),
      ),
    );
  };

  const handleLogAction = async (entry: MissingEntry, action: string) => {
    setIsLoading(true);
    const details = [
      entry.subjectId,
      `Div ${entry.division}`,
      entry.batch ? `Batch ${entry.batch}` : null,
      `Lecture ${entry.lectureNo}`,
      entry.date,
    ]
      .filter(Boolean)
      .join(' · ');

    try {
      const { error } = await supabase.from('admin_logs').insert({
        actor_id: profile.id,
        category: 'attendance',
        action,
        details,
        institution_id: institutionId,
      });

      if (error) {
        throw error;
      }

      setMissingList((prev) =>
        prev.filter(
          (item) =>
            !(
              item.date === entry.date &&
              item.subjectId === entry.subjectId &&
              item.division === entry.division &&
              item.lectureNo === entry.lectureNo &&
              item.batch === entry.batch
            ),
        ),
      );
    } catch (error: any) {
      console.error('Error logging action:', error);
      alert('Failed to log action: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllPresent = async (entry: MissingEntry) => {
    setIsLoading(true);

    try {
      const studentsInSlot = students.filter(
        (student) => student.division === entry.division && (!entry.batch || student.batch === entry.batch),
      );
      const records = studentsInSlot.map((student) => ({
        student_id: student.id,
        subject: entry.subjectId,
        date: entry.date,
        lecture_no: entry.lectureNo,
        status: 1,
        marked_by: profile.id,
        institution_id: institutionId,
      }));

      if (!isOnline) {
        await addToQueue('attendance', records);
        handleIgnore(entry);
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.from('attendance').upsert(records, {
        onConflict: 'student_id, subject, date, lecture_no',
      });

      if (error) {
        throw error;
      }

      handleIgnore(entry);
      await refreshData();
    } catch (error: any) {
      console.error('Error marking all present:', error);
      alert('Failed to mark attendance: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (missingList.length === 0) {
    return null;
  }

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
          {missingList.map((entry) => {
            const [year, month, day] = entry.date.split('-');
            const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={`${entry.date}_${entry.subjectId}_${entry.division}_${entry.lectureNo}_${entry.batch || ''}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between bg-paper p-4 rounded-2xl border border-cream-border gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0" />
                  <div>
                    <span className="font-semibold text-ink">{formattedDate}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-ink text-[0.6875rem] font-semibold px-2 py-0.5 bg-cream border border-cream-border rounded">
                        {entry.subjectId}
                      </span>
                      <span className="text-ink text-[0.6875rem] font-semibold px-2 py-0.5 bg-ochre/10 border border-ochre/30 rounded">
                        Div {entry.division}
                      </span>
                      {entry.batch && (
                        <span className="text-ochre-deep text-[0.6875rem] font-semibold px-2 py-0.5 bg-ochre/10 border border-ochre/30 rounded">
                          Batch {entry.batch}
                        </span>
                      )}
                      <span className="text-ink-muted text-[0.6875rem] font-medium">Lecture {entry.lectureNo}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        subject: entry.subjectId,
                        division: entry.division,
                        date: entry.date,
                        lecture: String(entry.lectureNo),
                      });
                      if (entry.batch) {
                        params.set('batch', entry.batch);
                      }
                      navigate(`/attendance?${params.toString()}`);
                    }}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-night text-white border border-night px-3.5 py-2 rounded-xl hover:bg-night-soft font-semibold"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Mark now</span>
                  </button>
                  <button
                    onClick={() => handleMarkAllPresent(entry)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-ochre text-white border border-ochre px-3.5 py-2 rounded-xl hover:bg-ochre-deep font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>All present</span>
                  </button>
                  <button
                    onClick={() => handleLogAction(entry, 'Holiday / No Lecture')}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-[0.8125rem] bg-card text-ink border border-cream-border px-3.5 py-2 rounded-xl hover:border-ochre/40 font-semibold disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Holiday</span>
                  </button>
                  <button
                    onClick={() => handleIgnore(entry)}
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
