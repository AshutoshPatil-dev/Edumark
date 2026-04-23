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
  Building2,
  Shield,
  Briefcase,
  Mail,
  MapPin,
  Save,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useInstitution } from '../context/InstitutionContext';
import { DIVISIONS, type DivisionId } from '../constants';
import { cn, getCorrectBatchesForDivision } from '../utils/attendance';
import type { AdminLog, AdminLogCategory, Profile } from '../types';
import AdminTimetableEditor from '../components/AdminTimetableEditor';
import { writeAdminLog } from '../utils/admin';
import { motion, AnimatePresence } from 'motion/react';

function getDivisionFromRollNo(rollNo: string): DivisionId {
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
  const { institution, institutionId, scopeQuery } = useInstitution();
  const [mainTab, setMainTab] = useState<'students' | 'timetable' | 'staff' | 'logs' | 'institution'>('students');
  const [studentTab, setStudentTab] = useState<'single' | 'bulk'>('single');
  const [timetableTab, setTimetableTab] = useState<'visual' | 'csv'>('visual');

  const [institutionName, setInstitutionName] = useState('');
  const [institutionLogo, setInstitutionLogo] = useState('');
  const [institutionAddress, setInstitutionAddress] = useState('');
  const [institutionEmail, setInstitutionEmail] = useState('');

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [batch, setBatch] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [timetableCSV, setTimetableCSV] = useState('');

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
      
      query = scopeQuery(query);

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

  const fetchProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    const { data } = await scopeQuery(supabase.from('profiles').select('*'));
    setAllProfiles((data as Profile[]) ?? []);
    setIsLoadingProfiles(false);
  }, [scopeQuery]);

  useEffect(() => {
    if (mainTab === 'staff') fetchProfiles();
  }, [mainTab, fetchProfiles]);

  useEffect(() => {
    if (institution) {
      setInstitutionName(institution.name);
      setInstitutionLogo(institution.logo_url || '');
      setInstitutionAddress(institution.address || '');
      setInstitutionEmail(institution.contact_email || '');
    }
  }, [institution]);

  const handleRoleChange = async (targetProfileId: string, newRole: 'faculty' | 'admin') => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetProfileId);
    
    if (!error) {
      const actorId = await getCurrentUserId();
      if (actorId) {
        const p = allProfiles.find(ap => ap.id === targetProfileId);
        await writeAdminLog(actorId, 'teacher', `Updated role for ${p?.full_name || 'user'}`, `New role: ${newRole}`, institutionId);
      }
      fetchProfiles();
      setMessage({ type: 'success', text: 'Role updated successfully.' });
    }
  };

  const handleInstitutionUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase
      .from('institutions')
      .update({
        name: institutionName,
        logo_url: institutionLogo,
        address: institutionAddress,
        contact_email: institutionEmail
      })
      .eq('id', institutionId);
    
    if (!error) {
      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(actorId, 'timetable', 'Updated institution settings', `New name: ${institutionName}`, institutionId);
      }
      setMessage({ type: 'success', text: 'Institution updated successfully. Refresh to see changes.' });
    } else {
      setMessage({ type: 'error', text: error.message || 'Failed to update institution.' });
    }
    setIsLoading(false);
  };

  const getCurrentUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const division = getDivisionFromRollNo(rollNo);
      const { error } = await supabase
        .from('students')
        .upsert([{ name, roll_no: rollNo, division, batch: batch || null, institution_id: institutionId }], {
          onConflict: 'roll_no',
        });
      if (error) throw error;

      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(
          actorId,
          'student',
          'Added student',
          `${name} (${rollNo}) → Division ${division}${batch ? `, Batch ${batch}` : ''}`,
          institutionId,
        );
      }

      setMessage({ type: 'success', text: `Student ${name} added to Division ${division}.` });
      setName('');
      setRollNo('');
      setBatch('');
      await refreshData();
      if (mainTab === 'logs') fetchLogs(); // Refresh logs if on that tab
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add student.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      let lines = bulkText
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
        return { name: n, roll_no: r, division: d, batch: b || null, institution_id: institutionId };
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
          institutionId,
        );
      }

      setMessage({ type: 'success', text: `Successfully added ${studentsToInsert.length} students.` });
      setBulkText('');
      await refreshData();
      if (mainTab === 'logs') fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add students.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimetableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fallbackId = user?.id;

      const { data: profiles, error: profileError } = await scopeQuery(supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['faculty', 'admin']));
      if (profileError) throw profileError;

      const profileMap = new Map((profiles || []).map((p) => [(p.full_name || '').toLowerCase(), p.id]));

      let lines = timetableCSV.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
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
        return { day_of_week: day, subject_id: subject, division, faculty_id: facultyId, lecture_no: lectureNo, batch: b || null, institution_id: institutionId };
      });

      const { error } = await supabase.from('timetable').insert(timetableToInsert);
      if (error) throw error;

      if (fallbackId) {
        await writeAdminLog(
          fallbackId,
          'timetable',
          'Uploaded timetable',
          `${timetableToInsert.length} entries added`,
          institutionId,
        );
      }

      setMessage({ type: 'success', text: `Successfully added ${timetableToInsert.length} timetable entries.` });
      setTimetableCSV('');
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
    { id: 'staff' as const, label: 'Staff', icon: Users },
    { id: 'logs' as const, label: 'Activity Log', icon: FileText },
    { id: 'institution' as const, label: 'Institution', icon: Building2 },
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
          <form onSubmit={handleSingleSubmit} className="space-y-5 max-w-md">
            <div className="space-y-1.5">
              <label className="eyebrow block">Full name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink" placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow block">Roll number</label>
              <input type="text" required value={rollNo} onChange={(e) => setRollNo(e.target.value)} className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink font-mono" placeholder="25FC304" />
              <p className="text-[0.75rem] text-ink-muted mt-1.5">Division is inferred from the roll number automatically.</p>
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow block">Batch (optional)</label>
              <input type="text" value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink" placeholder="e.g. F1" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {getCorrectBatchesForDivision(getDivisionFromRollNo(rollNo)).map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBatch(b)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[0.65rem] font-bold border transition-all",
                      batch === b 
                        ? "bg-ochre text-white border-ochre" 
                        : "bg-paper text-ink-muted border-cream-border hover:border-ochre/40"
                    )}
                  >
                    {b}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBatch('')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[0.65rem] font-bold border transition-all",
                    batch === '' 
                      ? "bg-night text-white border-night" 
                      : "bg-paper text-ink-muted border-cream-border hover:border-ochre/40"
                  )}
                >
                  NONE
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span>{isLoading ? 'Adding…' : 'Add student'}</span>
            </button>
          </form>
        )}

        {/* Bulk student form */}
        {mainTab === 'students' && studentTab === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="eyebrow block">CSV data</label>
              <p className="text-[0.75rem] text-ink-muted mb-2">Format: <code className="font-mono bg-cream px-1.5 py-0.5 rounded">Name, RollNo, Batch</code>. One student per line.</p>
              <textarea required value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-mono text-sm text-ink" placeholder={"John Doe, 25FC304, F1\nJane Smith, 25FC205, F2"} />
            </div>
            <button type="submit" disabled={isLoading} className="bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              <span>{isLoading ? 'Processing…' : 'Upload students'}</span>
            </button>
          </form>
        )}

        {/* Timetable form */}
        {mainTab === 'timetable' && timetableTab === 'visual' && (
          <AdminTimetableEditor />
        )}

        {mainTab === 'timetable' && timetableTab === 'csv' && (
          <form onSubmit={handleTimetableSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="eyebrow block">CSV data</label>
              <p className="text-[0.75rem] text-ink-muted mb-2">
                Format: <code className="font-mono bg-cream px-1.5 py-0.5 rounded">Day, Subject, Division, FacultyName, LectureNo, Batch</code>. Day is 1 (Monday) through 5 (Friday). Batch is optional.
              </p>
              <textarea required value={timetableCSV} onChange={(e) => setTimetableCSV(e.target.value)} rows={10} className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-mono text-sm text-ink" placeholder={"1, DEIC, C, unknown, 2, \n3, AC, A, unknown, 1, F1"} />
            </div>
            <button type="submit" disabled={isLoading} className="bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              <span>{isLoading ? 'Processing…' : 'Upload timetable'}</span>
            </button>
          </form>
        )}

        {/* Logs table */}
        {mainTab === 'logs' && (
          isLoadingLogs ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-ink/10 border-t-ochre rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-cream-border">
                    <th className="px-4 py-3 eyebrow">When</th>
                    <th className="px-4 py-3 eyebrow">User</th>
                    <th className="px-4 py-3 eyebrow">Category</th>
                    <th className="px-4 py-3 eyebrow">Action</th>
                    <th className="px-4 py-3 eyebrow">Details</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-cream-border">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-ink-muted">
                        No activity found{logCategory !== 'all' ? ` in the "${logCategory}" category` : ''}.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-paper transition-colors">
                        <td className="px-4 py-3 text-ink-muted tabular-nums whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                          {log.profiles?.full_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold border uppercase tracking-wider', categoryBadge[log.category] || 'bg-cream text-ink border-cream-border')}>
                            {log.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{log.action}</td>
                        <td className="px-4 py-3 text-ink-muted max-w-[280px] truncate">{log.details || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Staff Management */}
        {mainTab === 'staff' && (
          isLoadingProfiles ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-ink/10 border-t-ochre rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-paper p-4 rounded-2xl border border-cream-border flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-ochre" />
                <p className="text-sm text-ink-muted">
                  New staff members will automatically appear here when they sign up with your institution. Use the "Role" toggle to grant Admin privileges.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-cream-border">
                      <th className="px-4 py-3 eyebrow">Staff Member</th>
                      <th className="px-4 py-3 eyebrow">Role</th>
                      <th className="px-4 py-3 eyebrow text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-border">
                    {allProfiles.map((p) => (
                      <tr key={p.id} className="hover:bg-paper transition-colors group">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-cream border border-cream-border flex items-center justify-center text-ink font-bold text-xs">
                              {p.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-ink leading-tight">{p.full_name || 'Unknown User'}</p>
                              <p className="text-[0.6875rem] text-ink-muted mt-0.5 font-mono">{p.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('px-2.5 py-1 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border', 
                            p.role === 'admin' ? 'bg-night text-white border-night' : 'bg-ochre/10 text-ochre-deep border-ochre/20'
                          )}>
                            {p.role}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleRoleChange(p.id, p.role === 'admin' ? 'faculty' : 'admin')}
                            className="text-xs font-bold text-ochre hover:text-ochre-deep px-3 py-1.5 rounded-lg border border-ochre/20 hover:bg-ochre/5 transition-all"
                          >
                            Set as {p.role === 'admin' ? 'Faculty' : 'Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Institution Settings */}
        {mainTab === 'institution' && (
          <form onSubmit={handleInstitutionUpdate} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="eyebrow flex items-center gap-2">
                  <Building2 className="w-3 h-3" /> Institution Name
                </label>
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
                />
              </div>
              <div className="space-y-1.5">
                <label className="eyebrow flex items-center gap-2">
                  <Mail className="w-3 h-3" /> Contact Email
                </label>
                <input
                  type="email"
                  value={institutionEmail}
                  onChange={(e) => setInstitutionEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
                  placeholder="admin@college.edu"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="eyebrow flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Address
              </label>
              <textarea
                value={institutionAddress}
                onChange={(e) => setInstitutionAddress(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink resize-none"
                placeholder="Full address of the campus..."
              />
            </div>

            <div className="pt-4 border-t border-cream-border flex items-center justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-night hover:bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:translate-y-[-1px] active:translate-y-0"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Saving...' : 'Update Institution'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
