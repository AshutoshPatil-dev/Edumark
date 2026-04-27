import React from 'react';
import { BookOpen, Calendar as CalendarIcon, ChevronDown, Hash, UserCheck, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/attendance';
import type { SubjectId, DivisionId } from '../../constants';

interface AttendanceFiltersProps {
  isPractical: boolean;
  availableSubjects: readonly string[];
  selectedSubject: SubjectId;
  setSelectedSubject: (val: SubjectId) => void;
  isSubjectDropdownOpen: boolean;
  setIsSubjectDropdownOpen: (val: boolean) => void;
  subjectDropdownRef: React.RefObject<HTMLDivElement>;
  date: string;
  setDate: (val: string) => void;
  validDivisions: DivisionId[];
  selectedDivision: DivisionId;
  setSelectedDivision: (val: DivisionId) => void;
  validBatches: string[];
  selectedBatch: string;
  setSelectedBatch: (val: string) => void;
  validLectures: number[];
  lectureNo: number;
  setLectureNo: (val: number) => void;
  handleConfigChange: (setter: any, val: any) => void;
}

export function AttendanceFilters({
  isPractical,
  availableSubjects,
  selectedSubject,
  setSelectedSubject,
  isSubjectDropdownOpen,
  setIsSubjectDropdownOpen,
  subjectDropdownRef,
  date,
  setDate,
  validDivisions,
  selectedDivision,
  setSelectedDivision,
  validBatches,
  selectedBatch,
  setSelectedBatch,
  validLectures,
  lectureNo,
  setLectureNo,
  handleConfigChange,
}: AttendanceFiltersProps) {
  return (
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
                      handleConfigChange((val: any) => {
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
  );
}
