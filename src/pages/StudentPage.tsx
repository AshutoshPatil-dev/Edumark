/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  User,
  Calendar,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  BookOpen,
  Users,
  List,
  ChevronDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Student } from '../types';
import { SUBJECTS, DIVISIONS, type SubjectId, type DivisionId } from '../constants';
import { calculateTWAS, cn } from '../utils/attendance';
import { motion, AnimatePresence } from 'motion/react';
import { AttendanceLogs } from '../components/AttendanceLogs';

interface StudentPageProps {
  students: Student[];
  isStudentView?: boolean;
  isLoading?: boolean;
}

export default function StudentPage({
  students,
  isStudentView,
  isLoading,
}: StudentPageProps) {
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [isDivDropdownOpen, setIsDivDropdownOpen] = useState(false);
  const divDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (divDropdownRef.current && !divDropdownRef.current.contains(event.target as Node)) {
        setIsDivDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [showStudentLogs, setShowStudentLogs] = useState(false);

  const divisionStudents = useMemo(
    () =>
      isStudentView
        ? students
        : students.filter((s) => s.division === selectedDivision),
    [students, selectedDivision, isStudentView],
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    divisionStudents[0]?.id || '',
  );
  const [selectedSubject, setSelectedSubject] = useState<SubjectId | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedStudent = useMemo(
    () =>
      isStudentView
        ? students[0]
        : divisionStudents.find((s) => s.id === selectedStudentId),
    [divisionStudents, selectedStudentId, isStudentView, students],
  );

  const filteredStudents = useMemo(() =>
    divisionStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    [divisionStudents, searchQuery]
  );

  const studentStats = useMemo(() => {
    if (!selectedStudent) return null;

    let records: typeof selectedStudent.attendance[SubjectId] = [];

    if (selectedSubject === 'All') {
      records = Object.values(selectedStudent.attendance).flat();
    } else {
      records = selectedStudent.attendance[selectedSubject] || [];
    }

    const twas = calculateTWAS(records);

    const lastAbsences = records
      .filter((r) => r.status === 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const chartData = [...records]
      .sort((a, b) => a.date.localeCompare(b.date) || a.lectureNo - b.lectureNo)
      .map((_, idx, arr) => {
        const slice = arr.slice(0, idx + 1);
        const { score } = calculateTWAS(slice);
        return {
          name: `L${idx + 1}`,
          score: Math.round(score),
          date: arr[idx].date,
        };
      })
      .slice(-10);

    return { twas, lastAbsences, chartData };
  }, [selectedStudent, selectedSubject]);

  const getTwasTone = (score?: number) => {
    if (score === undefined) return 'text-ink';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-ochre-deep';
    if (score >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6 min-h-[calc(100vh-12rem)]',
        !isStudentView && 'lg:grid-cols-12',
      )}
    >
      {/* Sidebar */}
      {!isStudentView && (
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div>
            <p className="eyebrow mb-3">Students</p>
            <div className="relative" ref={divDropdownRef}>
              <button
                onClick={() => setIsDivDropdownOpen(!isDivDropdownOpen)}
                className={cn(
                  "w-full flex items-center justify-between pl-4 pr-4 py-3 bg-card border rounded-xl focus:outline-none transition-all",
                  isDivDropdownOpen ? "border-ochre shadow-[0_0_0_4px_rgba(29,78,216,0.1)] ring-4 ring-ochre/10" : "border-cream-border hover:border-ochre/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Users className={cn("w-[18px] h-[18px] transition-colors", isDivDropdownOpen ? "text-ochre" : "text-ink/40")} />
                  <span className="font-medium text-ink">
                    Division {selectedDivision}
                  </span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-ink/40 transition-transform duration-200", isDivDropdownOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isDivDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full left-0 right-0 z-50 mt-2 py-2 bg-card border border-cream-border rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl overflow-hidden"
                  >
                    {DIVISIONS.map((div) => (
                      <button
                        key={div}
                        onClick={() => {
                          setSelectedDivision(div);
                          const firstInDiv = students.find((s) => s.division === div);
                          if (firstInDiv) setSelectedStudentId(firstInDiv.id);
                          setIsDivDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center px-4 py-2.5 text-[0.875rem] font-medium transition-colors",
                          selectedDivision === div ? "bg-ochre/10 text-ochre-deep" : "text-ink hover:bg-cream-soft"
                        )}
                      >
                        Division {div}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink/40 group-focus-within:text-ochre" />
            <input
              type="text"
              placeholder="Search by name or roll no…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink placeholder:text-ink/30"
            />
          </div>

          <div className="bg-card rounded-3xl border border-cream-border overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-cream-border flex items-center justify-between">
              <p className="eyebrow">Students</p>
              <span className="text-[0.6875rem] text-ink-muted tabular-nums">
                {filteredStudents.length}
              </span>
            </div>
            <div className="p-2 space-y-1 max-h-[420px] overflow-y-auto overscroll-contain scrollbar-thin">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl group',
                    selectedStudentId === student.id
                      ? 'bg-ochre/10 text-ink border border-ochre/25'
                      : 'hover:bg-cream text-ink border border-transparent',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm border',
                        selectedStudentId === student.id
                          ? 'bg-ochre text-white border-ochre/40'
                          : 'bg-cream text-ink border-cream-border',
                      )}
                    >
                      {student.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[0.875rem] leading-tight">
                        {student.name}
                      </p>
                      <p
                        className={cn(
                          'text-[0.625rem] uppercase tracking-[0.15em] mt-1 font-medium',
                          selectedStudentId === student.id
                            ? 'text-ink/70'
                            : 'text-ink-muted',
                        )}
                      >
                        {student.rollNo}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'w-4 h-4',
                      selectedStudentId === student.id
                        ? 'text-ochre'
                        : 'text-ink/30 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 shrink-0">
            <AttendanceLogs students={students} compact={true} className="h-full" />
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div
        className={cn(
          'pr-1',
          !isStudentView ? 'lg:col-span-8' : 'max-w-4xl mx-auto w-full',
        )}
      >
        <AnimatePresence mode="wait">
          {selectedStudent ? (
            <motion.div
              key={selectedStudent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pb-16"
            >
              {/* Profile masthead */}
              <div className="bg-card p-8 md:p-10 rounded-3xl border border-cream-border relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div
                      className="w-20 h-20 bg-ochre rounded-2xl flex items-center justify-center text-white font-sans text-4xl font-semibold relative"
                    >
                      {selectedStudent.name.charAt(0)}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-ochre-deep"
                        title="On roster"
                        aria-hidden
                      />
                    </div>
                    <div>
                      <p className="eyebrow">Student</p>
                      <h2 className="font-sans text-2xl md:text-3xl font-semibold text-ink tracking-tight mt-1 text-balance">
                        {selectedStudent.name}
                      </h2>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="flex items-center text-[0.8125rem] font-medium text-ink-muted">
                          <User className="w-3.5 h-3.5 mr-1.5 text-ochre" />
                          {selectedStudent.rollNo}
                        </span>
                        <span className="w-1 h-1 bg-cream-border rounded-full" />
                        <span className="flex items-center text-[0.8125rem] font-medium text-ink-muted">
                          <BookOpen className="w-3.5 h-3.5 mr-1.5 text-ochre" />
                          Division {selectedStudent.division}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <button
                      onClick={() => setShowStudentLogs(!showStudentLogs)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[0.8125rem] font-semibold border',
                        showStudentLogs
                          ? 'bg-ochre text-white border-ochre'
                          : 'bg-card text-ink border-cream-border hover:border-ochre/40',
                      )}
                    >
                      <List className="w-4 h-4" />
                      <span>{showStudentLogs ? 'Hide logs' : 'View logs'}</span>
                    </button>

                    <div className="flex items-center bg-cream border border-cream-border rounded-xl p-1">
                      <span className="eyebrow px-3">Subject</span>
                      <div className="relative">
                        <select
                          value={selectedSubject}
                          onChange={(e) =>
                            setSelectedSubject(e.target.value as SubjectId | 'All')
                          }
                          className="appearance-none bg-card border border-cream-border rounded-lg pl-3 pr-8 py-1.5 text-[0.8125rem] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-ochre/30 cursor-pointer"
                        >
                          <option value="All">All</option>
                          {SUBJECTS.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/40 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {showStudentLogs ? (
                  <div className="mt-8 h-96">
                    <AttendanceLogs
                      students={students}
                      studentId={selectedStudent.id}
                      className="h-full"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    {/* TWAS score card */}
                    <div className="bg-paper p-6 rounded-2xl border border-cream-border flex flex-col justify-between min-h-[180px]">
                      <div className="flex items-center justify-between">
                        <p className="eyebrow">TWAS</p>
                        <span className="text-[0.625rem] uppercase tracking-[0.2em] text-ink-muted">
                          {studentStats?.twas.status}
                        </span>
                      </div>
                      <div>
                        <p
                          className={cn(
                            'font-sans text-5xl sm:text-6xl font-bold tabular-nums leading-none tracking-tight',
                            getTwasTone(studentStats?.twas.score),
                          )}
                          style={{ fontWeight: 400 }}
                        >
                          {studentStats?.twas.score.toFixed(0)}
                          <span className="text-2xl text-ink-muted ml-1">%</span>
                        </p>
                        <p className="text-[0.75rem] text-ink-muted mt-2">
                          Time-weighted attendance score
                        </p>
                      </div>
                    </div>

                    {/* Trend chart */}
                    <div className="md:col-span-2 bg-paper p-6 rounded-2xl border border-cream-border">
                      <div className="flex items-center justify-between mb-4">
                        <p className="eyebrow">Trend (last 10)</p>
                        <TrendingUp className="w-4 h-4 text-ochre" />
                      </div>
                      <div className="h-[140px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={studentStats?.chartData}>
                            <CartesianGrid
                              strokeDasharray="2 4"
                              vertical={false}
                              stroke="var(--color-cream-border)"
                            />
                            <XAxis dataKey="name" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-card border border-cream-border py-2.5 px-4 rounded-xl shadow-[0_15px_35px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted mb-1.5">
                                        {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </p>
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-ochre shadow-sm" />
                                        <p className="text-sm font-bold text-ink">
                                          {payload[0].value}% <span className="text-[11px] text-ink-muted font-medium ml-1">Score</span>
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="var(--color-ochre)"
                              strokeWidth={2.5}
                              dot={{ fill: 'var(--color-ochre)', strokeWidth: 0, r: 3 }}
                              activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                stroke: 'var(--color-paper)',
                                fill: 'var(--color-ochre)',
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!showStudentLogs && (
                <div className="bg-card p-8 rounded-3xl border border-cream-border">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="eyebrow">The Absences</p>
                      <h3 className="font-sans text-lg font-semibold text-ink mt-1 tracking-tight">
                        Recent missed lectures
                      </h3>
                    </div>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </div>
                  {studentStats?.lastAbsences.length! > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {studentStats?.lastAbsences.map((abs, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-4 p-4 bg-paper rounded-2xl border border-cream-border"
                        >
                          <div className="bg-rose-100 p-2.5 rounded-xl border border-rose-200/60">
                            <Calendar className="w-4 h-4 text-rose-700" />
                          </div>
                          <div>
                            <p className="font-semibold text-ink">
                              {new Date(abs.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-[0.6875rem] uppercase tracking-[0.15em] text-ink-muted mt-1">
                              Lecture #{abs.lectureNo}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-paper rounded-2xl border border-dashed border-cream-border">
                      <p className="text-ink-muted font-medium">
                        No recent absences recorded{' '}
                        {selectedSubject === 'All'
                          ? 'across all subjects'
                          : 'for this subject'}
                      </p>
                      <p className="text-[0.75rem] text-ink-muted/70 mt-1">
                        A clean page — let&apos;s keep it that way.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              {isStudentView ? (
                isLoading ? (
                  <>
                    <div className="w-10 h-10 border-[3px] border-ink/15 border-t-ochre rounded-full animate-spin mb-6" />
                    <h2 className="font-sans text-xl font-semibold text-ink tracking-tight">
                      Loading your record
                    </h2>
                    <p className="text-ink-muted mt-2 max-w-xs">
                      Retrieving your attendance from the archive.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-cream rounded-2xl flex items-center justify-center mb-6 border border-cream-border">
                      <AlertCircle className="w-8 h-8 text-rose-700" />
                    </div>
                    <p className="eyebrow">Unavailable</p>
                    <h2 className="font-sans text-xl font-semibold text-ink tracking-tight mt-1">
                      Record not found
                    </h2>
                    <p className="text-ink-muted mt-2 max-w-xs leading-relaxed">
                      We couldn&apos;t find your student record. Please ensure your
                      roll number is correctly registered in the system.
                    </p>
                  </>
                )
              ) : (
                <>
                  <div className="w-20 h-20 bg-cream rounded-2xl flex items-center justify-center mb-6 border border-cream-border">
                    <User className="w-8 h-8 text-ink/30" />
                  </div>
                  <p className="eyebrow">The Directory</p>
                  <h2 className="font-sans text-xl font-semibold text-ink tracking-tight mt-1">
                    Select a student
                  </h2>
                  <p className="text-ink-muted mt-2 max-w-xs leading-relaxed">
                    Choose a student from the directory to view their detailed
                    performance and attendance analytics.
                  </p>
                </>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
