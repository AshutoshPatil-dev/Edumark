import { Search, Zap, UserX, UserCheck, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../utils/attendance';
import type { Student } from '../../types';

interface AttendanceRosterProps {
  filteredStudents: Student[];
  absenteeIds: Set<string>;
  toggleAbsentee: (id: string) => void;
  setShowQuickEntry: (show: boolean) => void;
  availableSubjects: readonly string[];
  validDivisions: string[];
  presentCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  justSaved: boolean;
  setActiveNoteStudent: (id: string) => void;
  remarks: Record<string, string>;
}

export function AttendanceRoster({
  filteredStudents,
  absenteeIds,
  toggleAbsentee,
  setShowQuickEntry,
  availableSubjects,
  validDivisions,
  presentCount,
  searchQuery,
  setSearchQuery,
  justSaved,
  setActiveNoteStudent,
  remarks,
}: AttendanceRosterProps) {
  return (
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
  );
}
