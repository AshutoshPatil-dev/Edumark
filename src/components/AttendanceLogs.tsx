import { useState, useMemo, useEffect } from 'react';
import { Student } from '../types';
import { Filter, Calendar, Clock, User, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/attendance';

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

  return (
    <div className={cn("bg-card rounded-3xl border border-cream-border flex flex-col overflow-hidden", className)}>
      <div className="px-4 py-3.5 border-b border-cream-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-ochre" />
          <p className="eyebrow">{compact ? 'Recent logs' : 'The Ledger'}</p>
        </div>

        <div className="flex items-center gap-2 text-[0.8125rem]">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-paper border border-cream-border text-ink rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium"
          >
            <option value="all">All status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
          </select>

          {!compact && (
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-paper border border-cream-border text-ink rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ochre/20 max-w-[120px] font-medium"
            >
              <option value="all">All subjects</option>
              {uniqueSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
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
