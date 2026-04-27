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
import { AttendanceHeader } from '../components/Attendance/AttendanceHeader';
import { QuickEntryModal } from '../components/Attendance/QuickEntryModal';
import { NoteModal } from '../components/Attendance/NoteModal';
import { AttendanceRoster } from '../components/Attendance/AttendanceRoster';
import { AttendanceFilters } from '../components/Attendance/AttendanceFilters';

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
      <AttendanceHeader 
        isSaving={isSaving} 
        disabled={isSaving || availableSubjects.length === 0 || validDivisions.length === 0} 
        handleSave={handleSave} 
      />

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
            <span>Saved - your attendance is on record.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Control column */}
        <AttendanceFilters
          isPractical={isPractical}
          availableSubjects={availableSubjects}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          isSubjectDropdownOpen={isSubjectDropdownOpen}
          setIsSubjectDropdownOpen={setIsSubjectDropdownOpen}
          subjectDropdownRef={subjectDropdownRef}
          date={date}
          setDate={setDate}
          validDivisions={validDivisions}
          selectedDivision={selectedDivision}
          setSelectedDivision={setSelectedDivision}
          validBatches={validBatches}
          selectedBatch={selectedBatch}
          setSelectedBatch={setSelectedBatch}
          validLectures={validLectures}
          lectureNo={lectureNo}
          setLectureNo={setLectureNo}
          handleConfigChange={handleConfigChange}
        />

        {/* Student grid */}
        <AttendanceRoster
          filteredStudents={filteredStudents}
          absenteeIds={absenteeIds}
          toggleAbsentee={toggleAbsentee}
          setShowQuickEntry={setShowQuickEntry}
          availableSubjects={availableSubjects}
          validDivisions={validDivisions}
          presentCount={presentCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          justSaved={justSaved}
          setActiveNoteStudent={setActiveNoteStudent}
          remarks={remarks}
        />
      </div>

      {/* Note Modal */}
      <AnimatePresence>
        {activeNoteStudent && (
          <NoteModal
            activeNoteStudent={activeNoteStudent}
            remarks={remarks}
            setActiveNoteStudent={setActiveNoteStudent}
            handleRemarkChange={handleRemarkChange}
          />
        )}
      </AnimatePresence>

      {/* Quick Entry Modal */}
      <AnimatePresence>
        {showQuickEntry && (
          <QuickEntryModal
            quickEntryInput={quickEntryInput}
            quickEntryError={quickEntryError}
            setQuickEntryInput={setQuickEntryInput}
            setShowQuickEntry={setShowQuickEntry}
            setQuickEntryError={setQuickEntryError}
            handleQuickEntry={handleQuickEntry}
            markAllPresent={markAllPresent}
            markAllAbsent={markAllAbsent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
