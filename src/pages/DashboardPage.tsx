/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import type { Student } from '../types';
import { calculateTWAS, getStatusColor } from '../utils/attendance';
import { DIVISIONS, type DivisionId } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/attendance';
import { useTheme } from '../context/ThemeContext';

interface DashboardPageProps {
  students: Student[];
}

export default function DashboardPage({ students }: DashboardPageProps) {
  const { theme } = useTheme();
  const [selectedDivision, setSelectedDivision] = useState<DivisionId | 'All'>(
    'All',
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const stats = useMemo(() => {
    let totalScore = 0;
    let studentCount = 0;
    let riskCount = 0;
    let healthyCount = 0;
    const behaviourDist = { Excellent: 0, Good: 0, Risky: 0, Critical: 0 };

    const filteredStudents =
      selectedDivision === 'All'
        ? students
        : students.filter((s) => s.division === selectedDivision);

    const atRiskStudents = filteredStudents
      .map((student) => {
        const allRecords = Object.values(student.attendance).flat();
        const { score: avgScore, status: finalStatus } = calculateTWAS(allRecords);

        behaviourDist[finalStatus]++;
        totalScore += avgScore;
        studentCount++;

        if (finalStatus === 'Risky' || finalStatus === 'Critical') {
          riskCount++;
          return { ...student, avgScore, status: finalStatus };
        }
        healthyCount++;
        return null;
      })
      .filter((s) => s !== null) as (Student & {
        avgScore: number;
        status: string;
      })[];

    return {
      avgAttendance: studentCount > 0 ? totalScore / studentCount : 0,
      riskCount,
      healthyCount,
      studentCount,
      behaviourData: Object.entries(behaviourDist).map(([name, value]) => ({
        name,
        value,
      })),
      atRiskStudents: atRiskStudents.sort((a, b) => a.avgScore - b.avgScore).slice(0, 15),
    };
  }, [students, selectedDivision]);

  const COLORS = useMemo(
    () => ({
      Excellent: '#10b981',
      Good: '#3b82f6',
      Risky: '#f97316',
      Critical: '#ef4444',
    }),
    [],
  );

  const chartChrome = useMemo(
    () =>
      theme === 'dark'
        ? {
          grid: '#2a3648',
          tick: '#94a3b8',
          cursor: 'rgba(34, 211, 238, 0.08)',
          tooltipBg: '#141c27',
          tooltipBorder: '#2a3648',
          tooltipShadow: '0 10px 30px -12px rgba(0,0,0,0.45)',
        }
        : {
          grid: '#cbd5e1',
          tick: '#64748b',
          cursor: '#eff6ff',
          tooltipBg: '#f8fafc',
          tooltipBorder: '#cbd5e1',
          tooltipShadow: '0 10px 30px -12px rgba(11,15,25,0.15)',
        },
    [theme],
  );

  const statCards = [
    {
      label: 'Students',
      value: stats.studentCount,
      caption: 'enrolled in view',
      icon: Users,
    },
    {
      label: 'Avg. TWAS',
      value: `${stats.avgAttendance.toFixed(1)}%`,
      caption: 'time-weighted score',
      icon: TrendingUp,
    },
    {
      label: 'At Risk',
      value: stats.riskCount,
      caption: 'require intervention',
      icon: AlertTriangle,
      tone: 'risk' as const,
    },
    {
      label: 'Healthy',
      value: stats.healthyCount,
      caption: 'above threshold',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Editorial masthead */}
      <header className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Faculty dashboard</p>
            <h1 className="font-sans text-3xl md:text-4xl font-semibold text-ink mt-2 tracking-tight text-balance">
              Attendance{' '}
              <span className="text-gradient-cool">overview</span>
            </h1>
            <p className="text-ink-muted mt-3 max-w-xl leading-relaxed text-sm sm:text-base">
              Snapshot of your cohort: averages, how students are distributed
              by tier, and who may need a follow-up.
            </p>
          </div>

          <div className="relative w-full md:w-56" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "w-full flex items-center justify-between pl-4 pr-4 py-3 bg-input border rounded-xl focus:outline-none transition-all",
                isDropdownOpen ? "border-ochre shadow-[0_0_0_4px_rgba(29,78,216,0.1)] ring-4 ring-ochre/10" : "border-cream-border hover:border-ochre/50"
              )}
            >
              <div className="flex items-center gap-3">
                <BookOpen className={cn("w-[18px] h-[18px] transition-colors", isDropdownOpen ? "text-ochre" : "text-ink/40")} />
                <span className="font-medium text-ink">
                  {selectedDivision === 'All' ? 'All Divisions' : `Division ${selectedDivision}`}
                </span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-ink/40 transition-transform duration-200", isDropdownOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute top-full left-0 right-0 z-50 mt-2 py-2 bg-card border border-cream-border rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl overflow-hidden"
                >
                  <button
                    onClick={() => {
                      setSelectedDivision('All');
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center px-4 py-2.5 text-[0.875rem] font-medium transition-colors",
                      selectedDivision === 'All' ? "bg-ochre/10 text-ochre-deep" : "text-ink hover:bg-cream-soft"
                    )}
                  >
                    All Divisions
                  </button>
                  {DIVISIONS.map((div) => (
                    <button
                      key={div}
                      onClick={() => {
                        setSelectedDivision(div);
                        setIsDropdownOpen(false);
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
        <div className="rule-spectrum max-w-md opacity-90" />
      </header>

      {/* Stat strip - editorial "column" figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-cream-border rounded-3xl overflow-hidden border border-cream-border">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="bg-card p-6 md:p-8 flex flex-col gap-5 min-h-[160px]"
            >
              <div className="flex items-center justify-between">
                <p className="eyebrow">{card.label}</p>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ochre/[0.06] to-aqua/[0.08] border border-cream-border flex items-center justify-center">
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      card.tone === 'risk' ? 'text-rose-700' : 'text-ink',
                    )}
                  />
                </div>
              </div>
              <div>
                <p
                  className={cn(
                    'font-sans font-bold tabular-nums text-4xl md:text-[2.75rem] leading-none tracking-tight',
                    card.tone === 'risk' ? 'text-rose-700' : 'text-ink',
                  )}
                  style={{ fontWeight: 400 }}
                >
                  {card.value}
                </p>
                <p className="text-[0.75rem] text-ink-muted mt-2">
                  {card.caption}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Feature row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 bg-card p-8 rounded-3xl border border-cream-border"
        >
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="eyebrow">Distribution</p>
              <h2 className="font-sans text-xl font-semibold text-ink mt-1 tracking-tight">
                Counts by behaviour tier
              </h2>
            </div>
            <div className="flex items-center gap-4 text-[0.6875rem] uppercase tracking-[0.18em] text-ink-muted">
              {Object.entries(COLORS).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="hidden sm:inline">{name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.behaviourData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  vertical={false}
                  stroke={chartChrome.grid}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartChrome.tick, fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartChrome.tick, fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: chartChrome.cursor }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-cream-border py-2.5 px-4 rounded-xl shadow-[0_15px_35px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted mb-1.5">{label}</p>
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-2.5 h-2.5 rounded-full shadow-sm" 
                              style={{ backgroundColor: COLORS[label as keyof typeof COLORS] }} 
                            />
                            <p className="text-sm font-bold text-ink">
                              {payload[0].value} <span className="text-[11px] text-ink-muted font-medium ml-1">students</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={56}>
                  {stats.behaviourData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.name as keyof typeof COLORS]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 bg-card text-ink p-8 rounded-3xl border border-cream-border border-l-4 border-l-aqua bg-gradient-to-br from-card to-aqua/[0.06] shadow-sm"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="eyebrow text-ink-muted">Intervention</p>
              <h2 className="font-sans text-xl font-semibold text-ink mt-1 tracking-tight">
                Students to check in
              </h2>
            </div>
            <Link
              to="/students"
              className="text-ochre hover:text-ochre-deep text-[0.8125rem] font-medium flex items-center gap-1 group"
            >
              Roster
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2 scrollbar-thin scroll-smooth">
            {stats.atRiskStudents.length > 0 ? (
              stats.atRiskStudents.map((student, i) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-paper border border-cream-border hover:border-ochre/25"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[0.8125rem] text-ink-muted tabular-nums w-5 font-medium">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <p className="font-semibold text-ink text-[0.9375rem] leading-tight">
                        {student.name}
                      </p>
                      <p className="text-[0.6875rem] text-ink-muted mt-0.5">
                        {student.rollNo} · Div {student.division}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-sans text-xl font-semibold tabular-nums leading-none',
                        student.status === 'Excellent' ? 'text-emerald-600' :
                        student.status === 'Good' ? 'text-ochre' :
                        student.status === 'Risky' ? 'text-amber-600' : 
                        'text-rose-600',
                      )}
                    >
                      {student.avgScore.toFixed(0)}%
                    </p>
                    <span className="text-[0.625rem] uppercase tracking-[0.14em] text-ink-muted mt-1 block">
                      {student.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-14">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto mb-3" />
                <p className="text-ink font-medium">No one flagged right now</p>
                <p className="text-[0.75rem] text-ink-muted mt-1">
                  Everyone in view is above the risky tiers.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Unused import guard - retained for potential expansion */}
      <span className="sr-only">{getStatusColor('Excellent')}</span>
    </div>
  );
}
