/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Hash, BookOpen, Save, UserX, UserCheck, Search, Users, Zap } from 'lucide-react';
import { SUBJECTS, DIVISIONS, type SubjectId, type DivisionId } from '../constants';
import type { Student, Profile } from '../types';
import { cn } from '../utils/attendance';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface AttendancePageProps {
  students: Student[];
  refreshData: () => Promise<void>;
  profile: Profile;
}

export default function AttendancePage({ students, refreshData, profile }: AttendancePageProps) {
  const availableSubjects = profile.role === 'admin' 
    ? SUBJECTS 
    : SUBJECTS.filter(sub => 
        profile.assigned_subjects.includes(sub) || 
        (sub === 'DEIC-T' && profile.assigned_subjects.includes('DEIC'))
      );

  const [selectedSubject, setSelectedSubject] = useState<SubjectId>(
    availableSubjects[0] || SUBJECTS[0]
  );
  const [lectureNo, setLectureNo] = useState(1);
  // Get local date string in YYYY-MM-DD format
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getLocalDateString());
  const [absenteeIds, setAbsenteeIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [validDivisions, setValidDivisions] = useState<DivisionId[]>([...DIVISIONS]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [validBatches, setValidBatches] = useState<string[]>([]);
  const [validLectures, setValidLectures] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  // Quick Entry State
  const [quickEntryInput, setQuickEntryInput] = useState('');

  const isPractical = selectedSubject.endsWith('L') || selectedSubject === 'PBL';

  const filteredStudents = students.filter(s => 
    s.division === selectedDivision &&
    (!selectedBatch || s.batch === selectedBatch) &&
    (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleQuickEntry = (mode: 'absent' | 'present') => {
    const input = quickEntryInput.trim();
    if (!input) return;

    const rollNumbers = input.split(/[, ]+/).map(s => s.trim()).filter(Boolean).map(Number);
    
    const matchedStudentIds = filteredStudents.filter(s => {
      const match = s.rollNo.match(/\d+$/);
      if (!match) return false;
      const fullNum = parseInt(match[0], 10);
      
      const lastTwoMatch = s.rollNo.match(/\d{1,2}$/);
      const shortNum = lastTwoMatch ? parseInt(lastTwoMatch[0], 10) : -1;
      
      return rollNumbers.includes(fullNum) || rollNumbers.includes(shortNum);
    }).map(s => s.id);

    setAbsenteeIds(prev => {
      const next = new Set(prev);
      if (mode === 'absent') {
        matchedStudentIds.forEach(id => next.add(id));
      } else {
        matchedStudentIds.forEach(id => next.delete(id));
      }
      return next;
    });
    
    setQuickEntryInput('');
  };

  const markAllPresent = () => {
    setAbsenteeIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.delete(s.id));
      return next;
    });
  };

  const markAllAbsent = () => {
    setAbsenteeIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.add(s.id));
      return next;
    });
  };

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [profile.assigned_subjects, profile.role]);

  // Reset batch if subject is not practical
  useEffect(() => {
    if (!isPractical) {
      setSelectedBatch('');
    }
  }, [isPractical]);

  // Fetch valid divisions from timetable
  useEffect(() => {
    const fetchValidDivisions = async () => {
      const d = new Date(date);
      const dayOfWeek = d.getDay();
      
      let query = supabase
        .from('timetable')
        .select('division')
        .eq('day_of_week', dayOfWeek)
        .eq('subject_id', selectedSubject);

      if (profile.role !== 'admin') {
        query = query.eq('faculty_id', profile.id);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const uniqueDivs = Array.from(new Set(data.map(d => d.division as DivisionId))).sort();
        setValidDivisions(uniqueDivs);
        if (!uniqueDivs.includes(selectedDivision)) {
          setSelectedDivision(uniqueDivs[0]);
        }
      } else {
        setValidDivisions([]);
      }
    };

    fetchValidDivisions();
  }, [date, selectedSubject]);

  // Fetch valid batches from timetable
  useEffect(() => {
    const fetchValidBatches = async () => {
      if (!isPractical) {
        setValidBatches([]);
        setSelectedBatch('');
        return;
      }

      const d = new Date(date);
      const dayOfWeek = d.getDay();
      
      let query = supabase
        .from('timetable')
        .select('batch')
        .eq('day_of_week', dayOfWeek)
        .eq('subject_id', selectedSubject)
        .eq('division', selectedDivision)
        .not('batch', 'is', null);

      if (profile.role !== 'admin') {
        query = query.eq('faculty_id', profile.id);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const uniqueBatches = Array.from(new Set(data.map(d => d.batch as string))).sort();
        setValidBatches(uniqueBatches);
        if (!uniqueBatches.includes(selectedBatch)) {
          setSelectedBatch(uniqueBatches[0]);
        }
      } else {
        setValidBatches([]);
        setSelectedBatch('');
      }
    };

    fetchValidBatches();
  }, [date, selectedSubject, selectedDivision, isPractical]);

  // Fetch valid lectures from timetable
  useEffect(() => {
    const fetchValidLectures = async () => {
      const d = new Date(date);
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday...
      
      let query = supabase
        .from('timetable')
        .select('lecture_no')
        .eq('day_of_week', dayOfWeek)
        .eq('subject_id', selectedSubject)
        .eq('division', selectedDivision);

      if (profile.role !== 'admin') {
        query = query.eq('faculty_id', profile.id);
      }

      if (isPractical && selectedBatch) {
        query = query.eq('batch', selectedBatch);
      } else if (!isPractical) {
        query = query.is('batch', null);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        let uniqueLectures = Array.from(new Set(data.map(d => d.lecture_no))).sort((a, b) => a - b);
        
        if (isPractical && uniqueLectures.length > 0) {
          // For practicals, we only need one attendance entry per block.
          // A block is defined as consecutive lectures.
          const blocks: number[] = [];
          for (let i = 0; i < uniqueLectures.length; i++) {
            if (i === 0 || uniqueLectures[i] !== uniqueLectures[i - 1] + 1) {
              blocks.push(uniqueLectures[i]);
            }
          }
          uniqueLectures = blocks;
        }

        setValidLectures(uniqueLectures);
        if (!uniqueLectures.includes(lectureNo)) {
          setLectureNo(uniqueLectures[0]);
        }
      } else {
        setValidLectures([]);
      }
    };

    fetchValidLectures();
  }, [date, selectedSubject, selectedDivision, selectedBatch, isPractical]);

  // Fetch existing attendance when date, subject, or lecture changes
  useEffect(() => {
    const fetchExistingAttendance = async () => {
      setIsLoadingAttendance(true);
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('date', date)
        .eq('subject', selectedSubject)
        .eq('lecture_no', lectureNo);

      if (!error && data) {
        const absentees = new Set<string>();
        data.forEach(record => {
          if (record.status === 0) {
            absentees.add(record.student_id);
          }
        });
        setAbsenteeIds(absentees);
      }
      setIsLoadingAttendance(false);
    };

    fetchExistingAttendance();
  }, [date, selectedSubject, lectureNo]);

  const toggleAbsentee = (id: string) => {
    const newAbsentees = new Set(absenteeIds);
    if (newAbsentees.has(id)) {
      newAbsentees.delete(id);
    } else {
      newAbsentees.add(id);
    }
    setAbsenteeIds(newAbsentees);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Prepare records for Supabase (for all students in the selected division and batch, ignoring search query)
    const studentsToSave = students.filter(s => 
      s.division === selectedDivision &&
      (!selectedBatch || s.batch === selectedBatch)
    );

    const recordsToUpsert = studentsToSave.map(student => {
      const isAbsent = absenteeIds.has(student.id);
      return {
        student_id: student.id,
        subject: selectedSubject,
        date: date,
        lecture_no: lectureNo,
        status: isAbsent ? 0 : 1,
        marked_by: profile.id
      };
    });

    // Upsert into Supabase (insert or update if exists)
    const { error } = await supabase
      .from('attendance')
      .upsert(recordsToUpsert, { 
        onConflict: 'student_id,subject,date,lecture_no' 
      });

    if (!error) {
      await refreshData();
      setShowSuccess(true);
      setJustSaved(true);
      
      setTimeout(() => {
        setJustSaved(false);
      }, 300); // Flash blue for 300ms

      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance. Please check your connection.');
    }
    
    setIsSaving(false);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mark Attendance</h1>
          <p className="text-slate-500 mt-1">Select subject and lecture to record attendance</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || availableSubjects.length === 0 || validDivisions.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
        </button>
      </header>

      {availableSubjects.length === 0 && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center space-x-3">
          <UserX className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">You have no subjects assigned. Please contact an administrator to assign subjects to your profile before marking attendance.</p>
        </div>
      )}

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-500 text-white p-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 font-bold"
          >
            <UserCheck className="w-5 h-5" />
            <span>Attendance saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>Subject</span>
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value as SubjectId)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                {availableSubjects.length > 0 ? (
                  availableSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))
                ) : (
                  <option disabled>No subjects assigned</option>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4 text-blue-500" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
            </div>

            {validDivisions.length > 0 ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    <span>Division</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {validDivisions.map(div => (
                      <button
                        key={div}
                        onClick={() => {
                          setSelectedDivision(div);
                          setSelectedBatch(''); // Reset batch when division changes
                        }}
                        className={cn(
                          "flex-1 min-w-[60px] py-3 rounded-xl font-bold text-sm transition-all",
                          selectedDivision === div 
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" 
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {div}
                      </button>
                    ))}
                  </div>
                </div>

                {isPractical && validBatches.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>Batch</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {validBatches.map(batch => (
                        <button
                          key={batch}
                          onClick={() => setSelectedBatch(batch)}
                          className={cn(
                            "flex-1 min-w-[60px] py-3 rounded-xl font-bold text-sm transition-all",
                            selectedBatch === batch 
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {batch}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-blue-500" />
                    <span>Lecture Number</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {validLectures.map(num => (
                      <button
                        key={num}
                        onClick={() => setLectureNo(num)}
                        className={cn(
                          "flex-1 min-w-[40px] py-3 rounded-xl font-bold text-sm transition-all",
                          lectureNo === num 
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" 
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {isPractical ? `${num}-${num + 1}` : num}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm font-medium">
                No lectures scheduled for {selectedSubject} on this date.
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-slate-900 font-bold flex items-center">
              <Zap className="w-4 h-4 mr-2 text-amber-500" />
              Quick Entry
            </h3>
            <p className="text-slate-500 text-sm">
              Enter the last digits of roll numbers (e.g., 1, 2, 5) separated by commas.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={quickEntryInput}
                onChange={(e) => setQuickEntryInput(e.target.value)}
                placeholder="e.g. 1, 2, 3, 4"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Default to marking absent on enter
                    handleQuickEntry('absent');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickEntry('absent')}
                  className="flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 py-2 rounded-xl font-bold text-sm transition-colors border border-rose-200"
                >
                  Mark as Absent
                </button>
                <button
                  onClick={() => handleQuickEntry('present')}
                  className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 py-2 rounded-xl font-bold text-sm transition-colors border border-emerald-200"
                >
                  Mark as Present
                </button>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bulk Actions</span>
              <div className="flex gap-2">
                <button onClick={markAllPresent} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">All Present</button>
                <button onClick={markAllAbsent} className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors">All Absent</button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search students by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredStudents.map((student) => {
              const isAbsent = absenteeIds.has(student.id);
              return (
                <motion.button
                  layout
                  key={student.id}
                  onClick={() => toggleAbsentee(student.id)}
                  disabled={availableSubjects.length === 0 || validDivisions.length === 0 || justSaved}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-300 text-left group relative overflow-hidden",
                    (availableSubjects.length === 0 || validDivisions.length === 0) && "opacity-50 cursor-not-allowed",
                    justSaved 
                      ? "bg-blue-500 border-blue-600 shadow-md scale-[0.98]" 
                      : isAbsent 
                        ? "bg-rose-50 border-rose-200 shadow-sm" 
                        : "bg-white border-slate-100 hover:border-blue-200 hover:shadow-md"
                  )}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className={cn("font-bold transition-colors duration-300", 
                        justSaved ? "text-white" : isAbsent ? "text-rose-900" : "text-slate-900"
                      )}>
                        {student.name}
                      </p>
                      <p className={cn("text-xs font-medium transition-colors duration-300", 
                        justSaved ? "text-blue-100" : isAbsent ? "text-rose-600" : "text-slate-500"
                      )}>
                        {student.rollNo}
                      </p>
                    </div>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 mt-2",
                      justSaved ? "bg-white/20 text-white" : isAbsent ? "bg-rose-600 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500"
                    )}>
                      {isAbsent ? <UserX className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                    </div>
                  </div>
                  {isAbsent && !justSaved && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-bl-2xl uppercase tracking-widest shadow-sm">
                        Absent
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
