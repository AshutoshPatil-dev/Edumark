import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';

interface NoteModalProps {
  activeNoteStudent: string | null;
  remarks: Record<string, string>;
  setActiveNoteStudent: (id: string | null) => void;
  handleRemarkChange: (id: string, text: string) => void;
}

export function NoteModal({
  activeNoteStudent,
  remarks,
  setActiveNoteStudent,
  handleRemarkChange,
}: NoteModalProps) {
  if (!activeNoteStudent) return null;

  return (
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
  );
}
