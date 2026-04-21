import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, AlertCircle, CheckCircle2, Calendar, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DIVISIONS, type DivisionId } from '../constants';
import { cn } from '../utils/attendance';
import type { AttendanceLog } from '../types';
import AdminTimetableEditor from '../components/AdminTimetableEditor';

function getDivisionFromRollNo(rollNo: string): DivisionId {
  // Format: 25FC304 -> Index 4 is the division number (3 -> C)
  if (rollNo && rollNo.length >= 5) {
    const divChar = rollNo.charAt(4);
    const divNum = parseInt(divChar, 10);
    if (!isNaN(divNum) && divNum >= 1 && divNum <= 26) {
      const divLetter = String.fromCharCode(64 + divNum); // 1 -> A, 2 -> B, 3 -> C
      if (DIVISIONS.includes(divLetter as DivisionId)) {
        return divLetter as DivisionId;
      }
    }
  }
  return 'A'; // Fallback if format is invalid
}

export default function AdminPage() {
  const [mainTab, setMainTab] = useState<'students' | 'timetable' | 'logs'>('students');
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [timetableTab, setTimetableTab] = useState<'visual' | 'upload'>('visual');
  
  // Single student state
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [batch, setBatch] = useState('');
  
  // Bulk upload state
  const [bulkText, setBulkText] = useState('');
  
  // Timetable state
  const [timetableCSV, setTimetableCSV] = useState('');
  
  // Logs state
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (mainTab === 'logs') {
      fetchLogs();
    }
  }, [mainTab]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setLogs(data as any);
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const division = getDivisionFromRollNo(rollNo);
      const { error } = await supabase.from('students').upsert([
        { name, roll_no: rollNo, division, batch: batch || null }
      ], {
        onConflict: 'roll_no'
      });

      if (error) throw error;

      setMessage({ type: 'success', text: `Student ${name} added successfully to Division ${division}.` });
      setName('');
      setRollNo('');
      setBatch('');
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
      // Parse CSV format: Name, RollNo, Batch
      let lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Skip header if present
      if (lines.length > 0 && lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('roll')) {
        lines = lines.slice(1);
      }

      const studentsToInsert = lines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) {
          throw new Error(`Invalid format on line ${index + 1}. Expected: Name, RollNo, Batch(optional)`);
        }
        const [n, r, b] = parts;
        const d = getDivisionFromRollNo(r);
        return { name: n, roll_no: r, division: d, batch: b || null };
      });

      const { error } = await supabase.from('students').upsert(studentsToInsert, {
        onConflict: 'roll_no'
      });

      if (error) throw error;

      setMessage({ type: 'success', text: `Successfully added ${studentsToInsert.length} students.` });
      setBulkText('');
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
      // Get current user to use as fallback for testing
      const { data: { user } } = await supabase.auth.getUser();
      const fallbackId = user?.id;

      // Fetch all faculty profiles to map name to id
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['faculty', 'admin']); // Include admin so they can test

      if (profileError) throw profileError;

      const profileMap = new Map((profiles || []).map(p => [(p.full_name || '').toLowerCase(), p.id]));

      // Parse CSV format: Day(1-5), Subject, Division, FacultyName, LectureNo, Batch
      let lines = timetableCSV.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Skip header if present
      if (lines.length > 0 && lines[0].toLowerCase().includes('day') && lines[0].toLowerCase().includes('subject')) {
        lines = lines.slice(1);
      }

      const timetableToInsert = lines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 5) {
          throw new Error(`Invalid format on line ${index + 1}. Expected: Day, Subject, Division, FacultyName, LectureNo, Batch(optional)`);
        }
        const [dayStr, subject, division, facultyName, lectureStr, b] = parts;
        
        const day = parseInt(dayStr, 10);
        if (isNaN(day) || day < 1 || day > 5) throw new Error(`Invalid day "${dayStr}" on line ${index + 1}. Must be 1-5.`);
        
        const lectureNo = parseInt(lectureStr, 10);
        if (isNaN(lectureNo) || lectureNo < 1) throw new Error(`Invalid lecture number "${lectureStr}" on line ${index + 1}.`);

        let facultyId = profileMap.get(facultyName.toLowerCase());
        if (!facultyId) {
          // Fallback to current user if name is "unknown" or not found (great for testing)
          if (!fallbackId) throw new Error(`Faculty name "${facultyName}" not found on line ${index + 1}.`);
          facultyId = fallbackId;
        }

        return { day_of_week: day, subject_id: subject, division, faculty_id: facultyId, lecture_no: lectureNo, batch: b || null };
      });

      const { error } = await supabase.from('timetable').insert(timetableToInsert);

      if (error) throw error;

      setMessage({ type: 'success', text: `Successfully added ${timetableToInsert.length} timetable entries.` });
      setTimetableCSV('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add timetable.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex space-x-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <button
          onClick={() => { setMainTab('students'); setMessage(null); }}
          className={cn(
            "flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-bold text-sm transition-all",
            mainTab === 'students' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
          )}
        >
          <UserPlus className="w-4 h-4" />
          <span>Students</span>
        </button>
        <button
          onClick={() => { setMainTab('timetable'); setMessage(null); }}
          className={cn(
            "flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-bold text-sm transition-all",
            mainTab === 'timetable' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>Timetable</span>
        </button>
        <button
          onClick={() => { setMainTab('logs'); setMessage(null); }}
          className={cn(
            "flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-bold text-sm transition-all",
            mainTab === 'logs' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Logs</span>
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        {mainTab === 'students' && (
          <>
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Student Management</h2>
                <p className="text-slate-500">Add new students to the database manually or via bulk upload.</p>
              </div>
            </div>

            <div className="flex space-x-2 mb-8 bg-slate-50 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => { setActiveTab('single'); setMessage(null); }}
                className={cn(
                  "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                  activeTab === 'single' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Single Student
              </button>
              <button
                onClick={() => { setActiveTab('bulk'); setMessage(null); }}
                className={cn(
                  "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                  activeTab === 'bulk' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Bulk Upload
              </button>
            </div>
          </>
        )}

        {mainTab === 'timetable' && (
          <>
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Timetable Management</h2>
                <p className="text-slate-500">Easily manage and update the weekly schedule.</p>
              </div>
            </div>

            <div className="flex space-x-2 mb-8 bg-slate-50 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => { setTimetableTab('visual'); setMessage(null); }}
                className={cn(
                  "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                  timetableTab === 'visual' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Visual Editor
              </button>
              <button
                onClick={() => { setTimetableTab('upload'); setMessage(null); }}
                className={cn(
                  "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                  timetableTab === 'upload' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                CSV Upload
              </button>
            </div>
          </>
        )}

        {mainTab === 'logs' && (
          <>
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Attendance Logs</h2>
                <p className="text-slate-500">View actions taken by faculty (e.g., Holiday, No Lecture).</p>
              </div>
            </div>
          </>
        )}

        {message && (
          <div className={cn(
            "p-4 rounded-xl mb-6 flex items-start space-x-3 border",
            message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
          )}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="font-medium text-sm">{message.text}</p>
          </div>
        )}

        {mainTab === 'students' && (
          activeTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-6 max-w-md">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Roll Number</label>
                <input
                  type="text"
                  required
                  value={rollNo}
                  onChange={e => setRollNo(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300"
                  placeholder="e.g. 25FC304"
                />
                <p className="text-xs text-slate-500 mt-1">Division will be automatically determined from the roll number.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Batch (Optional)</label>
                <input
                  type="text"
                  value={batch}
                  onChange={e => setBatch(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300"
                  placeholder="e.g. F1"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 transform active:scale-[0.98]"
              >
                <UserPlus className="w-5 h-5" />
                <span>{isLoading ? 'Adding...' : 'Add Student'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">CSV Data (Name, RollNo, Batch)</label>
                <p className="text-xs text-slate-500 mb-2">Paste comma-separated values. One student per line. Division will be automatically determined from the roll number. Batch is optional.</p>
                <textarea
                  required
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-slate-300"
                  placeholder="John Doe, 25FC304, F1&#10;Jane Smith, 25FC205, F2"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-slate-200 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 transform active:scale-[0.98]"
              >
                <Upload className="w-5 h-5" />
                <span>{isLoading ? 'Processing...' : 'Upload Students'}</span>
              </button>
            </form>
          )
        )}

        {mainTab === 'timetable' && (
          timetableTab === 'visual' ? (
            <AdminTimetableEditor />
          ) : (
            <form onSubmit={handleTimetableSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">CSV Data (Day, Subject, Division, FacultyName, LectureNo, Batch)</label>
                <p className="text-xs text-slate-500 mb-2">Paste comma-separated values. Day is 1 (Monday) to 5 (Friday). If the name is "unknown" or not found, it will default to you for testing. Batch is optional.</p>
                <textarea
                  required
                  value={timetableCSV}
                  onChange={e => setTimetableCSV(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm placeholder:text-slate-300"
                  placeholder="1, DEIC, C, unknown, 2, &#10;3, AC, A, unknown, 1, F1"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 transform active:scale-[0.98]"
              >
                <Upload className="w-5 h-5" />
                <span>{isLoading ? 'Processing...' : 'Upload Timetable'}</span>
              </button>
            </form>
          )
        )}

        {mainTab === 'logs' && (
          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="pb-4 font-black">Date</th>
                  <th className="pb-4 font-black">Faculty</th>
                  <th className="pb-4 font-black">Details</th>
                  <th className="pb-4 font-black">Scope</th>
                  <th className="pb-4 font-black">Type</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center">
                        <FileText className="w-10 h-10 text-slate-100 mb-3" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No activity logs recorded</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-700 leading-none">{new Date(log.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                          <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{new Date(log.date).getFullYear()}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                            {(log.profiles?.full_name || 'U').charAt(0)}
                          </div>
                          <span className="font-bold text-slate-600">{log.profiles?.full_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight w-fit mb-1">{log.subject_id}</span>
                          <span className="text-xs text-slate-400 font-medium italic">{log.notes || 'Routine update'}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600">Division {log.division}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{log.batch || 'Entire Div'}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={cn(
                          "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                          log.action === 'Holiday' 
                            ? "bg-rose-50 text-rose-600 border-rose-100" 
                            : "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ... existing helper functions (getDivisionFromRollNo) should be preserved or moved outside ...

