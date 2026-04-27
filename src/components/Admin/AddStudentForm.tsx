import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import { cn, getCorrectBatchesForDivision } from '../../utils/attendance';
import { getDivisionFromRollNo } from '../../pages/AdminPage';

const studentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  rollNo: z.string().min(5, 'Roll number is too short').regex(/^\d{2}[A-Z]{2}\d{3}$/i, 'Must follow format e.g. 25FC304'),
  batch: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface AddStudentFormProps {
  isLoading: boolean;
  onSubmit: (data: { name: string; rollNo: string; batch: string }) => Promise<void>;
}

export function AddStudentForm({ isLoading, onSubmit }: AddStudentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: '', rollNo: '', batch: '' },
  });

  const rollNo = watch('rollNo');
  const currentBatch = watch('batch');

  const onFormSubmit = async (data: StudentFormData) => {
    await onSubmit({ name: data.name, rollNo: data.rollNo, batch: data.batch || '' });
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5 max-w-md">
      <div className="space-y-1.5">
        <label className="eyebrow block">Full name</label>
        <input
          {...register('name')}
          className={cn(
            "w-full px-4 py-3 bg-paper border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 font-medium text-ink",
            errors.name ? "border-rose-400 focus:border-rose-400" : "border-cream-border focus:border-ochre/60"
          )}
          placeholder="e.g. John Doe"
        />
        {errors.name && <p className="text-rose-600 text-xs font-medium">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow block">Roll number</label>
        <input
          {...register('rollNo')}
          className={cn(
            "w-full px-4 py-3 bg-paper border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 font-medium text-ink font-mono",
            errors.rollNo ? "border-rose-400 focus:border-rose-400" : "border-cream-border focus:border-ochre/60"
          )}
          placeholder="25FC304"
        />
        {errors.rollNo && <p className="text-rose-600 text-xs font-medium">{errors.rollNo.message}</p>}
        {!errors.rollNo && (
          <p className="text-[0.75rem] text-ink-muted mt-1.5">Division is inferred from the roll number automatically.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow block">Batch (optional)</label>
        <input
          {...register('batch')}
          className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
          placeholder="e.g. F1"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {getCorrectBatchesForDivision(getDivisionFromRollNo(rollNo || '')).map(b => (
            <button
              key={b}
              type="button"
              onClick={() => setValue('batch', b)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[0.65rem] font-bold border transition-all",
                currentBatch === b
                  ? "bg-ochre text-white border-ochre"
                  : "bg-paper text-ink-muted border-cream-border hover:border-ochre/40"
              )}
            >
              {b}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setValue('batch', '')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[0.65rem] font-bold border transition-all",
              !currentBatch
                ? "bg-night text-white border-night"
                : "bg-paper text-ink-muted border-cream-border hover:border-ochre/40"
            )}
          >
            NONE
          </button>
        </div>
      </div>

      <button type="submit" disabled={isLoading} className="w-full bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
        <UserPlus className="w-4 h-4" />
        <span>{isLoading ? 'Adding…' : 'Add student'}</span>
      </button>
    </form>
  );
}
