import { Save } from 'lucide-react';

interface AttendanceHeaderProps {
  isSaving: boolean;
  disabled: boolean;
  handleSave: () => void;
}

export function AttendanceHeader({ isSaving, disabled, handleSave }: AttendanceHeaderProps) {
  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Mark attendance</p>
          <h1 className="font-sans text-3xl md:text-4xl font-semibold text-ink mt-2 tracking-tight text-balance">
            Today&apos;s <span className="text-ochre">lecture</span>
          </h1>
          <p className="text-ink-muted mt-3 max-w-xl leading-relaxed text-sm sm:text-base">
            Pick the subject, date, and class - then set who was present or absent.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={disabled}
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
  );
}
