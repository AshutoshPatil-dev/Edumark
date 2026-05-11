import { useState, useMemo, useEffect, useRef } from 'react';
import { Student } from '../types';
import { Filter, Calendar, Clock, User, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/attendance';
import { AnimatePresence, motion } from 'motion/react';

interface AttendanceLogsProps {
  students: Student[];
  studentId?: string;
  className?: string;
  compact?: boolean;
}

interface LogEntry {
  studentName: string;
  studentRollNo: string;
  subject: string;
  date: string;
  lectureNo: number;
  status: 0 | 1;
  markedBy?: string;
  markedByName?: string;
}

export function AttendanceLogs({ students, studentId, className, compact = false }: AttendanceLogsProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent'>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      if (data) {
        const profileMap: Record<string, string> = {};
        data.forEach(p => {
          profileMap[p.id] = p.full_name || 'Unknown Teacher';
        });
        setProfiles(profileMap);
      }
    };
    fetchProfiles();
  }, []);

  const logs = useMemo(() => {
    const allLogs: LogEntry[] = [];

    const targetStudents = studentId
      ? students.filter(s => s.id === studentId)
      : students;

    targetStudents.forEach(student => {
      Object.entries(student.attendance).forEach(([subject, records]) => {
        records.forEach(record => {
          allLogs.push({
            studentName: student.name,
            studentRollNo: student.rollNo,
            subject,
            date: record.date,
            lectureNo: record.lectureNo,
            status: record.status,
            markedBy: record.marked_by,
            markedByName: record.marked_by ? (profiles[record.marked_by] || 'Unknown Teacher') : 'Unknown'
          });
        });
      });
    });

    return allLogs.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.lectureNo - a.lectureNo;
    });
  }, [students, studentId, profiles]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterStatus === 'present' && log.status !== 1) return false;
      if (filterStatus === 'absent' && log.status !== 0) return false;
      if (filterSubject !== 'all' && log.subject !== filterSubject) return false;
      return true;
    });
  }, [logs, filterStatus, filterSubject]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set<string>();
    logs.forEach(log => subjects.add(log.subject));
    return Array.from(subjects).sort();
  }, [logs]);

  const statusLabelMap: Record<'all' | 'present' | 'absent', string> = {
    all: 'All status',
    present: 'Present',
    absent: 'Absent',
  };

  return (
    <div className={cn("bg-card rounded-3xl border border-cream-border flex flex-col overflow-hidden", className)}>
      <div className="px-4 py-3.5 border-b border-cream-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-ochre" />
          <p className="eyebrow">{compact ? 'Recent logs' : 'The Ledger'}</p>
        </div>

        <div className="flex items-center gap-2 text-[0.8125rem]">
          <div className="relative" ref={statusDropdownRef}>
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className={cn(
                'min-w-[112px] flex items-center justify-between gap-2 bg-paper border rounded-lg px-3 py-1.5 font-medium text-ink transition-all',
                isStatusDropdownOpen
                  ? 'border-ochre ring-4 ring-ochre/10'
                  : 'border-cream-border hover:border-ochre/50',
              )}
            >
              <span>{statusLabelMap[filterStatus]}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-ink/40 transition-transform', isStatusDropdownOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {isStatusDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full z-50 mt-2 min-w-[148px] py-2 bg-card border border-cream-border rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)] overflow-hidden"
                >
                  {(['all', 'present', 'absent'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status);
                        setIsStatusDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-[0.8125rem] font-medium transition-colors',
                        filterStatus === status
                          ? 'bg-ochre/10 text-ochre-deep'
                          : 'text-ink hover:bg-cream-soft',
                      )}
                    >
                      {statusLabelMap[status]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!compact && (
            <div className="relative" ref={subjectDropdownRef}>
              <button
                onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                className={cn(
                  'min-w-[132px] max-w-[170px] flex items-center justify-between gap-2 bg-paper border rounded-lg px-3 py-1.5 font-medium text-ink transition-all',
                  isSubjectDropdownOpen
                    ? 'border-ochre ring-4 ring-ochre/10'
                    : 'border-cream-border hover:border-ochre/50',
                )}
              >
                <span className="truncate">{filterSubject === 'all' ? 'All subjects' : filterSubject}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-ink/40 transition-transform shrink-0', isSubjectDropdownOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {isSubjectDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 top-full z-50 mt-2 min-w-[180px] max-h-56 overflow-y-auto py-2 bg-card border border-cream-border rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)]"
                  >
                    <button
                      onClick={() => {
                        setFilterSubject('all');
                        setIsSubjectDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-[0.8125rem] font-medium transition-colors',
                        filterSubject === 'all'
                          ? 'bg-ochre/10 text-ochre-deep'
                          : 'text-ink hover:bg-cream-soft',
                      )}
                    >
                      All subjects
                    </button>
                    {uniqueSubjects.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => {
                          setFilterSubject(sub);
                          setIsSubjectDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-4 py-2.5 text-[0.8125rem] font-medium transition-colors',
                          filterSubject === sub
                            ? 'bg-ochre/10 text-ochre-deep'
                            : 'text-ink hover:bg-cream-soft',
                        )}
                      >
                        {sub}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-ink-muted">
            <Filter className="w-7 h-7 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No logs match these filters</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, idx) => (
              <div key={idx} className="p-3 rounded-xl hover:bg-paper border border-transparent hover:border-cream-border flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                    log.status === 1
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                      : "bg-rose-50 text-rose-700 border-rose-200/70"
                  )}>
                    {log.status === 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    {!studentId && (
                      <p className="font-semibold text-[0.8125rem] text-ink leading-tight truncate">
                        {log.studentName}
                        <span className="text-ink-muted font-medium text-[0.6875rem] ml-1.5 tracking-wide">
                          {log.studentRollNo}
                        </span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[0.6875rem] text-ink-muted font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {log.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        L{log.lectureNo}
                      </span>
                      <span className="px-1.5 py-0.5 bg-cream border border-cream-border rounded text-ink font-semibold uppercase tracking-wider text-[0.625rem]">
                        {log.subject}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={cn(
                    "text-[0.6875rem] font-semibold uppercase tracking-[0.15em]",
                    log.status === 1 ? "text-emerald-700" : "text-rose-700"
                  )}>
                    {log.status === 1 ? 'Present' : 'Absent'}
                  </p>
                  <p className="text-[0.625rem] text-ink-muted mt-0.5 flex items-center justify-end gap-1">
                    <User className="w-2.5 h-2.5" />
                    {log.markedByName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
