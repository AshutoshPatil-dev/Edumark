import React, { useState, useMemo, useEffect } from 'react';
import { Student, Profile } from '../types';
import { Filter, Calendar, Clock, User, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/attendance';

interface AttendanceLogsProps {
  students: Student[];
  studentId?: string; // If provided, filter by this student
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

  // Fetch profiles to map marked_by UUID to full_name
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

    // Sort by date descending, then lectureNo descending
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
    <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col", className)}>
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-slate-800">{compact ? 'Recent Logs' : 'Attendance Logs'}</h3>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Status</option>
            <option value="present">Present Only</option>
            <option value="absent">Absent Only</option>
          </select>
          
          {!compact && (
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[120px]"
            >
              <option value="all">All Subjects</option>
              {uniqueSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">No logs found matching filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, idx) => (
              <div key={idx} className="p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    log.status === 1 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {log.status === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    {!studentId && (
                      <p className="font-bold text-sm text-slate-800 leading-tight">
                        {log.studentName} <span className="text-slate-400 font-normal text-xs">({log.studentRollNo})</span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {log.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Lec {log.lectureNo}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                        {log.subject}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  <p className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    log.status === 1 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {log.status === 1 ? 'Present' : 'Absent'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                    <User className="w-3 h-3" />
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
