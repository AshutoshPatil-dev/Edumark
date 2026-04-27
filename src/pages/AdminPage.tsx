import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Upload,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Users,
  ClipboardList,
  Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DIVISIONS, type DivisionId } from '../constants';
import { cn, getCorrectBatchesForDivision } from '../utils/attendance';
import type { AdminLog, AdminLogCategory } from '../types';
import AdminTimetableEditor from '../components/AdminTimetableEditor';
import { AdminLogsTable } from '../components/Admin/AdminLogsTable';
import { AddStudentForm } from '../components/Admin/AddStudentForm';
import { BulkStudentUpload } from '../components/Admin/BulkStudentUpload';
import { TimetableUpload } from '../components/Admin/TimetableUpload';
import { writeAdminLog } from '../utils/admin';

export function getDivisionFromRollNo(rollNo: string): DivisionId {
  if (rollNo && rollNo.length >= 5) {
    const divChar = rollNo.charAt(4);
    const divNum = parseInt(divChar, 10);
    if (!isNaN(divNum) && divNum >= 1 && divNum <= 26) {
      const divLetter = String.fromCharCode(64 + divNum);
      if (DIVISIONS.includes(divLetter as DivisionId)) {
        return divLetter as DivisionId;
      }
    }
  }
  return 'A';
}


interface AdminPageProps {
  refreshData: () => Promise<void>;
}

export default function AdminPage({ refreshData }: AdminPageProps) {
  const [mainTab, setMainTab] = useState<'students' | 'timetable' | 'logs'>('students');
  const [studentTab, setStudentTab] = useState<'single' | 'bulk'>('single');
  const [timetableTab, setTimetableTab] = useState<'visual' | 'csv'>('visual');

  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logCategory, setLogCategory] = useState<AdminLogCategory | 'all'>('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);

    try {
      // Step 1: Fetch logs without join to avoid relationship errors
      let query = supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (logCategory !== 'all') {
        query = query.eq('category', logCategory);
      }

      const { data: logsData, error: logsError } = await query;
      if (logsError) throw logsError;

      if (!logsData || logsData.length === 0) {
        setLogs([]);
        setIsLoadingLogs(false);
        return;
      }

      // Step 2: Fetch profiles for the unique actors
      const actorIds = Array.from(new Set(logsData.map(l => l.actor_id).filter(Boolean)));
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds);

      if (profilesError) {
        console.error('Error fetching profiles for logs:', profilesError);
        // Still show logs even if profile fetch fails
        setLogs(logsData as AdminLog[]);
      } else {
        // Merge profiles into logs
        const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));
        const mergedLogs = logsData.map(log => ({
          ...log,
          profiles: { full_name: profileMap.get(log.actor_id) || 'Unknown' }
        }));
        setLogs(mergedLogs as AdminLog[]);
      }
    } catch (err: any) {
      console.error('Failed to fetch activity logs:', err);
      setMessage({ type: 'error', text: 'Failed to load activity logs.' });
    } finally {
      setIsLoadingLogs(false);
    }
  }, [logCategory]);

  useEffect(() => {
    if (mainTab === 'logs') fetchLogs();
  }, [mainTab, fetchLogs]);

  const getCurrentUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  };

  const handleSingleSubmit = async (data: { name: string; rollNo: string; batch: string }) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const division = getDivisionFromRollNo(data.rollNo);
      const { error } = await supabase
        .from('students')
        .upsert([{ name: data.name, roll_no: data.rollNo, division, batch: data.batch || null }], {
          onConflict: 'roll_no',
        });
      if (error) throw error;

      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(
          actorId,
          'student',
          'Added student',
          `${data.name} (${data.rollNo}) → Division ${division}${data.batch ? `, Batch ${data.batch}` : ''}`,
        );
      }

      setMessage({ type: 'success', text: `Student ${data.name} added to Division ${division}.` });
      await refreshData();
      if (mainTab === 'logs') fetchLogs(); // Refresh logs if on that tab
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add student.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSubmit = async (csvText: string) => {
    setIsLoading(true);
    setMessage(null);
    try {
      let lines = csvText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length > 0 && lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('roll')) {
        lines = lines.slice(1);
      }
      const studentsToInsert = lines.map((line, index) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 2) throw new Error(`Invalid format on line ${index + 1}. Expected: Name, RollNo, Batch(optional)`);
        const [n, r, b] = parts;
        const d = getDivisionFromRollNo(r);
        return { name: n, roll_no: r, division: d, batch: b || null };
      });

      const { error } = await supabase.from('students').upsert(studentsToInsert, { onConflict: 'roll_no' });
      if (error) throw error;

      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(
          actorId,
          'student',
          'Bulk added students',
          `${studentsToInsert.length} students uploaded via CSV`,
        );
      }

      setMessage({ type: 'success', text: `Successfully added ${studentsToInsert.length} students.` });
      await refreshData();
      if (mainTab === 'logs') fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add students.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimetableSubmit = async (csvText: string) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fallbackId = user?.id;

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['faculty', 'admin']);
      if (profileError) throw profileError;

      const profileMap = new Map((profiles || []).map((p) => [(p.full_name || '').toLowerCase(), p.id]));

      let lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length > 0 && lines[0].toLowerCase().includes('day') && lines[0].toLowerCase().includes('subject')) {
        lines = lines.slice(1);
      }

      const timetableToInsert = lines.map((line, index) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 5) throw new Error(`Invalid format on line ${index + 1}. Expected: Day, Subject, Division, FacultyName, LectureNo, Batch(optional)`);
        const [dayStr, subject, division, facultyName, lectureStr, b] = parts;
        const day = parseInt(dayStr, 10);
        if (isNaN(day) || day < 1 || day > 5) throw new Error(`Invalid day "${dayStr}" on line ${index + 1}. Must be 1-5.`);
        const lectureNo = parseInt(lectureStr, 10);
        if (isNaN(lectureNo) || lectureNo < 1) throw new Error(`Invalid lecture number "${lectureStr}" on line ${index + 1}.`);
        let facultyId = profileMap.get(facultyName.toLowerCase());
        if (!facultyId) {
          if (!fallbackId) throw new Error(`Faculty name "${facultyName}" not found on line ${index + 1}.`);
          facultyId = fallbackId;
        }
        return { day_of_week: day, subject_id: subject, division, faculty_id: facultyId, lecture_no: lectureNo, batch: b || null };
      });

      const { error } = await supabase.from('timetable').insert(timetableToInsert);
      if (error) throw error;

      if (fallbackId) {
        await writeAdminLog(
          fallbackId,
          'timetable',
          'Uploaded timetable',
          `${timetableToInsert.length} entries added`,
        );
      }

      setMessage({ type: 'success', text: `Successfully added ${timetableToInsert.length} timetable entries.` });
      if (mainTab === 'logs') fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add timetable.' });
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'students' as const, label: 'Students', icon: UserPlus },
    { id: 'timetable' as const, label: 'Timetable', icon: Calendar },
    { id: 'logs' as const, label: 'Activity Log', icon: FileText },
  ];

  const categoryFilters: { id: AdminLogCategory | 'all'; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'All activity', icon: ClipboardList },
    { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
    { id: 'student', label: 'Students', icon: Users },
    { id: 'timetable', label: 'Timetable', icon: Calendar },
    { id: 'teacher', label: 'Teachers', icon: UserPlus },
    { id: 'leave', label: 'Leaves', icon: FileText },
  ];

  const categoryBadge: Record<string, string> = {
    attendance: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border-emerald-200',
    student: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 border-sky-200',
    timetable: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 border-violet-200',
    teacher: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200',
    leave: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 border-cyan-200',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="space-y-4">
        <p className="eyebrow">Administration</p>
        <h1 className="font-sans text-3xl md:text-4xl font-semibold text-ink tracking-tight text-balance">
          School <span className="text-ochre">admin</span>
        </h1>
        <p className="text-ink-muted max-w-xl leading-relaxed text-sm sm:text-base">
          Manage rosters, timetable, and a full audit log of all system changes.
        </p>
        <div className="rule-paper" />
      </header>

      {/* Main tabs */}
      <div className="flex gap-1 bg-card p-1.5 rounded-2xl border border-cream-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setMainTab(t.id); setMessage(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all',
                mainTab === t.id ? 'bg-ochre text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-cream',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-card p-8 md:p-10 rounded-3xl border border-cream-border">
        {/* Students tab header */}
        {mainTab === 'students' && (
          <>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-11 h-11 bg-cream rounded-xl flex items-center justify-center border border-cream-border">
                <UserPlus className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="eyebrow">Roster</p>
                <h2 className="font-sans text-xl font-semibold text-ink tracking-tight">Add students</h2>
              </div>
            </div>
            <div className="flex gap-1 mb-8 border-b border-cream-border">
              <button
                onClick={() => { setStudentTab('single'); setMessage(null); }}
                className={cn('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px', studentTab === 'single' ? 'border-ochre text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
              >
                Single entry
              </button>
              <button
                onClick={() => { setStudentTab('bulk'); setMessage(null); }}
                className={cn('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px', studentTab === 'bulk' ? 'border-ochre text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
              >
                Bulk upload
              </button>
            </div>
          </>
        )}

        {/* Timetable tab header */}
        {mainTab === 'timetable' && (
          <>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-11 h-11 bg-cream rounded-xl flex items-center justify-center border border-cream-border">
                <Calendar className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="eyebrow">Schedule</p>
                <h2 className="font-sans text-xl font-semibold text-ink tracking-tight">Manage timetable</h2>
              </div>
            </div>
            <div className="flex gap-1 mb-8 border-b border-cream-border">
              <button
                onClick={() => { setTimetableTab('visual'); setMessage(null); }}
                className={cn('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px', timetableTab === 'visual' ? 'border-ochre text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
              >
                Visual Editor
              </button>
              <button
                onClick={() => { setTimetableTab('csv'); setMessage(null); }}
                className={cn('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px', timetableTab === 'csv' ? 'border-ochre text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
              >
                CSV Upload
              </button>
            </div>
          </>
        )}

        {/* Logs tab header + category filter */}
        {mainTab === 'logs' && (
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-11 h-11 bg-cream rounded-xl flex items-center justify-center border border-cream-border">
                <ClipboardList className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="eyebrow">Audit trail</p>
                <h2 className="font-sans text-xl font-semibold text-ink tracking-tight">Activity log</h2>
              </div>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-ink-muted shrink-0" />
              {categoryFilters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setLogCategory(f.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      logCategory === f.id
                        ? 'bg-night text-white border-night'
                        : 'bg-cream text-ink-muted border-cream-border hover:text-ink',
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status message */}
        {message && (
          <div className={cn('p-4 rounded-xl mb-6 flex items-start gap-3 border', message.type === 'success' ? 'bg-emerald-50 border-emerald-200/70 text-emerald-800' : 'bg-rose-50 border-rose-200/70 text-rose-800')}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="font-medium text-sm">{message.text}</p>
          </div>
        )}

        {/* Single student form */}
        {mainTab === 'students' && studentTab === 'single' && (
          <AddStudentForm isLoading={isLoading} onSubmit={handleSingleSubmit} />
        )}

        {/* Bulk student form */}
        {mainTab === 'students' && studentTab === 'bulk' && (
          <BulkStudentUpload isLoading={isLoading} onSubmit={handleBulkSubmit} />
        )}

        {/* Timetable form */}
        {mainTab === 'timetable' && timetableTab === 'visual' && (
          <AdminTimetableEditor />
        )}

        {mainTab === 'timetable' && timetableTab === 'csv' && (
          <TimetableUpload isLoading={isLoading} onSubmit={handleTimetableSubmit} />
        )}

        {/* Logs table */}
        {mainTab === 'logs' && (
          <AdminLogsTable logs={logs} isLoadingLogs={isLoadingLogs} logCategory={logCategory} />
        )}
      </div>
    </div>
  );
}
