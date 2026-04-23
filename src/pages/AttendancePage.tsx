/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Hash,
  BookOpen,
  Save,
  UserX,
  UserCheck,
  Search,
  Users,
  Zap,
  X,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { SUBJECTS, DIVISIONS, type SubjectId, type DivisionId } from '../constants';
import type { Student, Profile } from '../types';
import { cn, getCorrectBatchesForDivision } from '../utils/attendance';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useSync } from '../context/SyncContext';

interface AttendancePageProps {
  students: Student[];
  refreshData: () => Promise<void>;
  profile: Profile;
}

export default function AttendancePage({
  students,
  refreshData,
  profile,
}: AttendancePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOnline, addToQueue } = useSync();

  const availableSubjects =
    profile.role === 'admin'
      ? SUBJECTS
      : SUBJECTS.filter(
        (sub) =>
          profile.assigned_subjects.includes(sub) ||
          (sub === 'DEIC-T' && profile.assigned_subjects.includes('DEIC')),
      );

  const [selectedSubject, setSelectedSubject] = useState<SubjectId>(
    availableSubjects[0] || SUBJECTS[0],
  );
  const [lectureNo, setLectureNo] = useState(1);

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getLocalDateString());
  const [absenteeIds, setAbsenteeIds] = useState<Set<string>>(new Set());
  const [initialAbsenteeIds, setInitialAbsenteeIds] = useState<Set<string>>(new Set());
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [initialRemarks, setInitialRemarks] = useState<Record<string, string>>({});
  const [activeNoteStudent, setActiveNoteStudent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [validDivisions, setValidDivisions] = useState<DivisionId[]>([...DIVISIONS]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [validBatches, setValidBatches] = useState<string[]>([]);
  const [validLectures, setValidLectures] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [, setIsLoadingAttendance] = useState(false);

  const [quickEntryInput, setQuickEntryInput] = useState('');
  const [quickEntryError, setQuickEntryError] = useState<string | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleSubjectOutside(event: MouseEvent) {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleSubjectOutside);
    return () => document.removeEventListener('mousedown', handleSubjectOutside);
  }, []);

  // Feature 3: Pre-fill form from URL query params (e.g. from "Mark Now" button)
  useEffect(() => {
    const qSubject = searchParams.get('subject') as SubjectId | null;
    const qDivision = searchParams.get('division') as DivisionId | null;
    const qDate = searchParams.get('date');
    const qLecture = searchParams.get('lecture');
    const qBatch = searchParams.get('batch');

    if (qSubject || qDivision || qDate || qLecture) {
      if (qSubject && availableSubjects.includes(qSubject)) {
        setSelectedSubject(qSubject);
      }
      if (qDate) setDate(qDate);
      if (qDivision && DIVISIONS.includes(qDivision)) {
        setSelectedDivision(qDivision);
      }
      if (qLecture) setLectureNo(parseInt(qLecture, 10));
      if (qBatch) setSelectedBatch(qBatch);

      // Clear the query params so a page refresh doesn't re-apply them
      setSearchParams({}, { replace: true });
    }
  }, []); // only on mount

  useEffect(() => {
    (window as any).hasUnsavedAttendanceChanges = hasUnsavedChanges;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved attendance changes. Leave without saving?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let hasChanges = false;
    if (absenteeIds.size !== initialAbsenteeIds.size) hasChanges = true;
    else {
      for (let id of absenteeIds) {
        if (!initialAbsenteeIds.has(id)) {
          hasChanges = true;
          break;
        }
      }
    }
    if (!hasChanges) {
      if (Object.keys(remarks).length !== Object.keys(initialRemarks).length) hasChanges = true;
      else {
        for (let key in remarks) {
          if (remarks[key] !== initialRemarks[key]) {
            hasChanges = true;
            break;
          }
        }
      }
    }
    setHasUnsavedChanges(hasChanges);
  }, [absenteeIds, remarks, initialAbsenteeIds, initialRemarks]);

  const handleConfigChange = (setter: (val: any) => void, val: any) => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved attendance changes. If you proceed, your changes will be lost. Do you want to proceed?')) {
        setHasUnsavedChanges(false);
        setter(val);
      }
    } else {
      setter(val);
    }
  };

  const isPractical = selectedSubject.endsWith('L') || selectedSubject === 'PBL';

  const filteredStudents = useMemo(() =>
    students.filter(
      (s) =>
        s.division === selectedDivision &&
        (!selectedBatch || s.batch === selectedBatch) &&
        (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())),
    ),
    [students, selectedDivision, selectedBatch, searchQuery]
  );

  const handleQuickEntry = (mode: 'absent' | 'present') => {
    setQuickEntryError(null);
    const input = quickEntryInput.trim();
    if (!input) return;

    const rollNumbers = input
      .split(/[, ]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n));

    if (rollNumbers.length === 0) return;

    const matchedIds: string[] = [];
    const unmatchedNumbers: number[] = [];

    rollNumbers.forEach((num) => {
      const student = filteredStudents.find((s) => {
        const match = s.rollNo.match(/\d+$/);
        if (!match) return false;
        const fullNum = parseInt(match[0], 10);
        const lastTwoMatch = s.rollNo.match(/\d{1,2}$/);
        const shortNum = lastTwoMatch ? parseInt(lastTwoMatch[0], 10) : -1;

        return num === fullNum || num === shortNum;
      });

      if (student) {
        matchedIds.push(student.id);
      } else {
        unmatchedNumbers.push(num);
      }
    });

    if (matchedIds.length > 0) {
      setHasUnsavedChanges(true);
      setAbsenteeIds((prev) => {
        const next = new Set(prev);
        if (mode === 'absent') {
          matchedIds.forEach((id) => next.add(id));
        } else {
          matchedIds.forEach((id) => next.delete(id));
        }
        return next;
      });
    }

    if (unmatchedNumbers.length > 0) {
      setQuickEntryError(`Roll numbers not found: ${unmatchedNumbers.join(', ')}`);
      setQuickEntryInput(unmatchedNumbers.join(', '));
    } else {
      setQuickEntryInput('');
      setShowQuickEntry(false);
      setQuickEntryError(null);
    }
  };

  const markAllPresent = () => {
    setAbsenteeIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => next.delete(s.id));
      return next;
    });
  };

  const markAllAbsent = () => {
    setAbsenteeIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => next.add(s.id));
      return next;
    });
  };

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [profile.assigned_subjects, profile.role]);

  useEffect(() => {
    if (!isPractical) {
      setSelectedBatch('');
    }
  }, [isPractical]);

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
        const uniqueDivs = Array.from(new Set(data.map((d) => d.division as DivisionId))).sort();
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
        const allowedBatches = new Set(getCorrectBatchesForDivision(selectedDivision));
        
        const uniqueBatches = Array.from(new Set(data.map((d) => d.batch as string)))
          .filter(b => allowedBatches.has(b))
          .sort();

        setValidBatches(uniqueBatches);
        if (uniqueBatches.length > 0 && !uniqueBatches.includes(selectedBatch)) {
          setSelectedBatch(uniqueBatches[0]);
        } else if (uniqueBatches.length === 0) {
          setSelectedBatch('');
        }
      } else {
        setValidBatches([]);
        setSelectedBatch('');
      }
    };

    fetchValidBatches();
  }, [date, selectedSubject, selectedDivision, isPractical]);

  useEffect(() => {
    const fetchValidLectures = async () => {
      const d = new Date(date);
      const dayOfWeek = d.getDay();

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
        let uniqueLectures = Array.from(new Set(data.map((d) => d.lecture_no))).sort(
          (a, b) => a - b,
        );

        if (isPractical && uniqueLectures.length > 0) {
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

  useEffect(() => {
    const fetchExistingAttendance = async () => {
      setIsLoadingAttendance(true);
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status, remark')
        .eq('date', date)
        .eq('subject', selectedSubject)
        .eq('lecture_no', lectureNo);

      if (!error && data) {
        const absentees = new Set<string>();
        const loadedRemarks: Record<string, string> = {};
        data.forEach((record) => {
          if (record.status === 0) {
            absentees.add(record.student_id);
            if (record.remark) loadedRemarks[record.student_id] = record.remark;
          }
        });
        setAbsenteeIds(absentees);
        setInitialAbsenteeIds(new Set(absentees));
        setRemarks(loadedRemarks);
        setInitialRemarks({ ...loadedRemarks });
      } else {
        setAbsenteeIds(new Set());
        setInitialAbsenteeIds(new Set());
        setRemarks({});
        setInitialRemarks({});
      }
      setIsLoadingAttendance(false);
    };

    fetchExistingAttendance();
  }, [date, selectedSubject, lectureNo]);

  const toggleAbsentee = (id: string) => {
    const newAbsentees = new Set(absenteeIds);
    if (newAbsentees.has(id)) {
      newAbsentees.delete(id);
      setRemarks(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      newAbsentees.add(id);
    }
    setAbsenteeIds(newAbsentees);
  };

  const handleRemarkChange = (id: string, text: string) => {
    setRemarks(prev => ({ ...prev, [id]: text }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    const studentsToSave = students.filter(
      (s) =>
        s.division === selectedDivision &&
        (!selectedBatch || s.batch === selectedBatch),
    );

    const recordsToUpsert = studentsToSave.map((student) => {
      const isAbsent = absenteeIds.has(student.id);
      return {
        student_id: student.id,
        subject: selectedSubject,
        date,
        lecture_no: lectureNo,
        status: isAbsent ? 0 : 1,
        marked_by: profile.id,
        remark: remarks[student.id] || null,
      };
    });

    if (!isOnline) {
      await addToQueue('attendance', recordsToUpsert);
      setInitialAbsenteeIds(new Set(absenteeIds));
      setInitialRemarks({ ...remarks });
      setIsOfflineSaved(true);
      setShowSuccess(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 300);
      setTimeout(() => setShowSuccess(false), 4000);
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from('attendance')
      .upsert(recordsToUpsert, { onConflict: 'student_id,subject,date,lecture_no' });

    if (!error) {
      setInitialAbsenteeIds(new Set(absenteeIds));
      setInitialRemarks({ ...remarks });
      // Write to unified admin log
      await supabase.from('admin_logs').insert({
        actor_id: profile.id,
        category: 'attendance',
        action: 'Marked attendance',
        details: `${selectedSubject} · Div ${selectedDivision}${selectedBatch ? ` Batch ${selectedBatch}` : ''} · Lecture ${lectureNo} · ${date} · ${absenteeIds.size} absent`,
      });
      await refreshData();
      setShowSuccess(true);
      setJustSaved(true);

      setTimeout(() => setJustSaved(false), 300);
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance. Please check your connection.');
    }

    setIsSaving(false);
  };

  const presentCount = filteredStudents.length - filteredStudents.filter(s => absenteeIds.has(s.id)).length;

  return (
    <div className="space-y-10">
      {/* Masthead */}
      <header className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Mark attendance</p>
            <h1 className="font-sans text-3xl md:text-4xl font-semibold text-ink mt-2 tracking-tight text-balance">
              Today&apos;s{' '}
              <span className="text-ochre">lecture</span>
            </h1>
            <p className="text-ink-muted mt-3 max-w-xl leading-relaxed text-sm sm:text-base">
              Pick the subject, date, and class—then set who was present or
              absent.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              availableSubjects.length === 0 ||
              validDivisions.length === 0
            }
            className="bg-ochre hover:bg-ochre-deep text-white px-6 py-3.5 rounded-xl font-semibold shadow-[0_8px_24px_-8px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving…' : 'Save attendance'}</span>
          </button>
        </div>
        <div className="rule-paper" />
      </header>

      {availableSubjects.length === 0 && (
        <div className="bg-cream border border-cream-border text-ink p-5 rounded-2xl flex items-center gap-3">
          <UserX className="w-5 h-5 flex-shrink-0 text-rose-700" />
          <p className="font-medium text-sm leading-relaxed">
            You have no subjects assigned. Please contact an administrator to assign
            subjects to your profile before marking attendance.
          </p>
        </div>
      )}

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-night text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-medium"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-ochre" />
            <span>Saved — your attendance is on record.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Control column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-cream-border space-y-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Lecture slot</p>
              <span className="text-[0.625rem] uppercase tracking-[0.2em] text-ink-muted">
                {isPractical ? 'Practical' : 'Theory'}
              </span>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-[0.75rem] font-semibold text-ink flex items-center gap-2">
                <BookOpen className="w-[14px] h-[14px] text-ochre" />
                <span>Subject</span>
              </label>
              <div className="relative" ref={subjectDropdownRef}>
                <button
                  onClick={() => availableSubjects.length > 0 && setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 bg-paper border rounded-xl focus:outline-none transition-all font-medium text-ink',
                    isSubjectDropdownOpen
                      ? 'border-ochre ring-4 ring-ochre/10'
                      : 'border-cream-border hover:border-ochre/50',
                    availableSubjects.length === 0 && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className={cn('w-[14px] h-[14px] transition-colors', isSubjectDropdownOpen ? 'text-ochre' : 'text-ink/40')} />
                    <span>{availableSubjects.length > 0 ? selectedSubject : 'No subjects assigned'}</span>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-ink/40 transition-transform duration-200', isSubjectDropdownOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {isSubjectDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-full left-0 right-0 z-50 mt-2 py-2 bg-card border border-cream-border rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)] backdrop-blur-xl overflow-hidden max-h-56 overflow-y-auto"
                    >
                      {availableSubjects.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => {
                            handleConfigChange(setSelectedSubject, sub as SubjectId);
                            setIsSubjectDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-[0.875rem] font-medium transition-colors',
                            selectedSubject === sub
                              ? 'bg-ochre/10 text-ochre-deep'
                              : 'text-ink hover:bg-cream-soft',
                          )}
                        >
                          {selectedSubject === sub && (
                            <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0" />
                          )}
                          <span className={selectedSubject !== sub ? 'ml-[14px]' : ''}>{sub}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-[0.75rem] font-semibold text-ink flex items-center gap-2">
                <CalendarIcon className="w-[14px] h-[14px] text-ochre" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => handleConfigChange(setDate, e.target.value)}
                className="w-full p-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
              />
            </div>

            {validDivisions.length > 0 ? (
              <>
                {/* Division */}
                <div className="space-y-2">
                  <label className="text-[0.75rem] font-semibold text-ink flex items-center gap-2">
                    <UserCheck className="w-[14px] h-[14px] text-ochre" />
                    <span>Division</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {validDivisions.map((div) => (
                      <button
                        key={div}
                        onClick={() => {
                          handleConfigChange((val) => {
                            setSelectedDivision(val);
                            setSelectedBatch('');
                          }, div);
                        }}
                        className={cn(
                          'flex-1 min-w-[56px] py-3 rounded-xl font-semibold text-sm tabular-nums border transition-all',
                          selectedDivision === div
                            ? 'bg-ochre text-white border-ochre'
                            : 'bg-paper text-ink border-cream-border hover:border-ochre/50',
                        )}
                      >
                        {div}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Batch */}
                {isPractical && validBatches.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[0.75rem] font-semibold text-ink flex items-center gap-2">
                      <Users className="w-[14px] h-[14px] text-ochre" />
                      <span>Batch</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {validBatches.map((batch) => (
                        <button
                          key={batch}
                          onClick={() => handleConfigChange(setSelectedBatch, batch)}
                          className={cn(
                            'flex-1 min-w-[60px] py-3 rounded-xl font-semibold text-sm border',
                            selectedBatch === batch
                              ? 'bg-ochre text-white border-ochre'
                              : 'bg-paper text-ink border-cream-border hover:border-ochre/50',
                          )}
                        >
                          {batch}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lecture No */}
                <div className="space-y-2">
                  <label className="text-[0.75rem] font-semibold text-ink flex items-center gap-2">
                    <Hash className="w-[14px] h-[14px] text-ochre" />
                    <span>Lecture number</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {validLectures.map((num) => (
                      <button
                        key={num}
                        onClick={() => handleConfigChange(setLectureNo, num)}
                        className={cn(
                          'flex-1 min-w-[44px] py-3 rounded-xl font-semibold text-sm tabular-nums border transition-all',
                          lectureNo === num
                            ? 'bg-ochre text-white border-ochre'
                            : 'bg-paper text-ink border-cream-border hover:border-ochre/50',
                        )}
                      >
                        {isPractical ? `${num}–${num + 1}` : num}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-cream border border-cream-border text-ink p-4 rounded-xl text-sm font-medium">
                No lectures scheduled for {selectedSubject} on this date.
              </div>
            )}
          </div>
        </div>

        {/* Student grid */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1 mb-1">
            <h2 className="font-sans text-lg font-semibold text-ink tracking-tight">Roster</h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowQuickEntry(true)}
                disabled={availableSubjects.length === 0 || validDivisions.length === 0}
                className="px-3 py-1.5 bg-ochre/10 text-ochre-deep hover:bg-ochre/20 rounded-lg text-[0.75rem] font-bold tracking-wide transition-colors flex items-center gap-1.5 border border-transparent hover:border-ochre/30 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                <Zap className="w-3.5 h-3.5" />
                QUICK ENTRY
              </button>
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/70 text-[0.75rem] font-bold tracking-wide flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {presentCount}/{filteredStudents.length} PRESENT
              </div>
              <div className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200/70 text-[0.75rem] font-bold tracking-wide flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {filteredStudents.filter((s) => absenteeIds.has(s.id)).length} ABSENT
              </div>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink/40 group-focus-within:text-ochre" />
            <input
              type="text"
              placeholder="Search by name or roll number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-card border border-cream-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink placeholder:text-ink/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredStudents.map((student) => {
              const isAbsent = absenteeIds.has(student.id);
              return (
                <motion.button
                  layout
                  key={student.id}
                  onClick={() => toggleAbsentee(student.id)}
                  disabled={
                    availableSubjects.length === 0 ||
                    validDivisions.length === 0 ||
                    justSaved
                  }
                  className={cn(
                    'group relative p-4 rounded-2xl border text-left overflow-hidden',
                    (availableSubjects.length === 0 || validDivisions.length === 0) &&
                    'opacity-50 cursor-not-allowed',
                    justSaved
                      ? 'bg-night text-white border-night scale-[0.98]'
                      : isAbsent
                        ? 'bg-rose-50 border-rose-200/80 hover:border-rose-300'
                        : 'bg-card border-cream-border hover:border-ochre/40 hover:shadow-[0_8px_20px_-12px_rgba(11,15,25,0.15)]',
                  )}
                >
                  <div className="flex items-center justify-between relative z-10 gap-3">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'font-semibold text-[0.9375rem] leading-tight truncate',
                          justSaved
                            ? 'text-white'
                            : isAbsent
                              ? 'text-rose-900'
                              : 'text-ink',
                        )}
                      >
                        {student.name}
                      </p>
                      <p
                        className={cn(
                          'text-[0.6875rem] uppercase tracking-[0.12em] mt-1 font-medium',
                          justSaved
                            ? 'text-white/50'
                            : isAbsent
                              ? 'text-rose-700/80'
                              : 'text-ink-muted',
                        )}
                      >
                        {student.rollNo}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAbsent && !justSaved && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveNoteStudent(student.id);
                          }}
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center border transition-all',
                            remarks[student.id]
                              ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-sm'
                              : 'bg-white/50 text-rose-400 border-dashed border-rose-300 hover:text-rose-600 hover:border-rose-400 hover:bg-white',
                          )}
                          title={remarks[student.id] ? `Note: ${remarks[student.id]}` : 'Add note'}
                        >
                          <MessageSquare className={cn('w-4 h-4', remarks[student.id] && 'fill-rose-200')} />
                        </button>
                      )}
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-colors',
                          justSaved
                            ? 'bg-white/10 text-white border-white/20'
                            : isAbsent
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-cream text-ink border-cream-border group-hover:bg-night group-hover:text-white group-hover:border-night',
                        )}
                      >
                        {isAbsent ? (
                          <UserX className="w-5 h-5" />
                        ) : (
                          <UserCheck className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Note Modal */}
      <AnimatePresence>
        {activeNoteStudent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setActiveNoteStudent(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-card p-6 rounded-3xl border border-cream-border space-y-4 relative z-10 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-ink font-semibold flex items-center text-lg">
                <MessageSquare className="w-5 h-5 mr-2 text-ochre" />
                Add absence note
              </h3>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Medical leave, Late, etc."
                value={remarks[activeNoteStudent] || ''}
                onChange={(e) => handleRemarkChange(activeNoteStudent, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveNoteStudent(null);
                }}
                className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
              />
              <button
                onClick={() => setActiveNoteStudent(null)}
                className="w-full bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-colors"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Entry Modal */}
      <AnimatePresence>
        {showQuickEntry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => {
                setShowQuickEntry(false);
                setQuickEntryError(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-card p-6 md:p-8 rounded-3xl border border-cream-border space-y-6 relative z-10 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-ink font-semibold flex items-center text-lg">
                    <Zap className="w-5 h-5 mr-2 text-ochre" />
                    Quick entry
                  </h3>
                  <p className="text-ink-muted text-sm mt-1">
                    Enter roll numbers to quickly mark attendance.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowQuickEntry(false);
                    setQuickEntryError(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-cream hover:bg-cream-border text-ink-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-ink-muted text-[0.8125rem] leading-relaxed">
                  Enter the last digits of roll numbers (e.g. 1, 2, 5), separated by
                  commas.
                </p>
                {quickEntryError && (
                  <div className="bg-rose-50 border border-rose-200/60 p-3 rounded-xl text-sm font-medium text-rose-700 flex items-start gap-2">
                    <UserX className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{quickEntryError}</p>
                  </div>
                )}
                <input
                  type="text"
                  value={quickEntryInput}
                  onChange={(e) => setQuickEntryInput(e.target.value)}
                  placeholder="e.g. 1, 2, 3, 4"
                  className="w-full p-4 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickEntry('absent');
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuickEntry('absent')}
                    className="flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 py-3 rounded-xl font-semibold text-[0.8125rem] border border-rose-200/70"
                  >
                    Mark absent
                  </button>
                  <button
                    onClick={() => handleQuickEntry('present')}
                    className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 py-3 rounded-xl font-semibold text-[0.8125rem] border border-emerald-200/70"
                  >
                    Mark present
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-cream-border flex justify-between items-center">
                <span className="eyebrow">Bulk Actions</span>
                <div className="flex gap-2">
                  <button
                    onClick={markAllPresent}
                    className="text-[0.75rem] font-semibold text-ink hover:text-ochre-deep bg-cream hover:bg-cream-soft px-4 py-2 rounded-lg border border-cream-border"
                  >
                    All present
                  </button>
                  <button
                    onClick={markAllAbsent}
                    className="text-[0.75rem] font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-lg border border-rose-200/70"
                  >
                    All absent
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
