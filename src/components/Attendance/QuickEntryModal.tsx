import { motion } from 'motion/react';
import { X, Zap, UserX } from 'lucide-react';

interface QuickEntryModalProps {
  quickEntryInput: string;
  quickEntryError: string | null;
  setQuickEntryInput: (val: string) => void;
  setShowQuickEntry: (val: boolean) => void;
  setQuickEntryError: (val: string | null) => void;
  handleQuickEntry: (mode: 'absent' | 'present') => void;
  markAllPresent: () => void;
  markAllAbsent: () => void;
}

export function QuickEntryModal({
  quickEntryInput,
  quickEntryError,
  setQuickEntryInput,
  setShowQuickEntry,
  setQuickEntryError,
  handleQuickEntry,
  markAllPresent,
  markAllAbsent,
}: QuickEntryModalProps) {
  return (
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
            Enter the last digits of roll numbers (e.g. 1, 2, 5), separated by commas.
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
  );
}
