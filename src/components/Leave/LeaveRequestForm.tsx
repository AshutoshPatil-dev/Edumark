import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { cn } from '../../utils/attendance';
import type { LeaveType } from '../../types';

const LEAVE_TYPES: { id: LeaveType; label: string }[] = [
  { id: 'medical', label: 'Medical' },
  { id: 'personal', label: 'Personal' },
  { id: 'academic', label: 'Academic' },
  { id: 'other', label: 'Other' },
];

const leaveRequestSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  leaveType: z.enum(['medical', 'personal', 'academic', 'other']),
  reason: z.string().min(10, 'Please provide a more detailed reason (min 10 characters)'),
}).refine((data) => data.startDate <= data.endDate, {
  message: "End date cannot be before start date",
  path: ["endDate"],
});

type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

interface LeaveRequestFormProps {
  formSubmitting: boolean;
  onSubmit: (data: { startDate: string; endDate: string; reason: string; leaveType: LeaveType }) => Promise<void>;
}

export function LeaveRequestForm({ formSubmitting, onSubmit }: LeaveRequestFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { startDate: '', endDate: '', leaveType: 'medical', reason: '' },
  });

  const watchStartDate = watch('startDate');
  const watchLeaveType = watch('leaveType');

  const onFormSubmit = async (data: LeaveRequestFormData) => {
    await onSubmit({
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      leaveType: data.leaveType,
    });
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="bg-card p-8 rounded-3xl border border-cream-border space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 bg-cream rounded-xl flex items-center justify-center border border-cream-border">
          <Send className="w-5 h-5 text-ink" />
        </div>
        <div>
          <p className="eyebrow">Submit</p>
          <h2 className="font-sans text-xl font-semibold text-ink tracking-tight">New leave request</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="eyebrow block">From date</label>
          <input
            type="date"
            {...register('startDate')}
            className={cn(
              "w-full px-4 py-3 bg-paper border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 font-medium text-ink",
              errors.startDate ? "border-rose-400 focus:border-rose-400" : "border-cream-border focus:border-ochre/60"
            )}
          />
          {errors.startDate && <p className="text-rose-600 text-xs font-medium">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="eyebrow block">To date</label>
          <input
            type="date"
            {...register('endDate')}
            min={watchStartDate}
            className={cn(
              "w-full px-4 py-3 bg-paper border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 font-medium text-ink",
              errors.endDate ? "border-rose-400 focus:border-rose-400" : "border-cream-border focus:border-ochre/60"
            )}
          />
          {errors.endDate && <p className="text-rose-600 text-xs font-medium">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow block">Leave type</label>
        <div className="flex flex-wrap gap-2">
          {LEAVE_TYPES.map((lt) => (
            <button
              key={lt.id}
              type="button"
              onClick={() => setValue('leaveType', lt.id)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                watchLeaveType === lt.id
                  ? 'bg-ochre text-white border-ochre'
                  : 'bg-paper text-ink border-cream-border hover:border-ochre/50',
              )}
            >
              {lt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow block">Reason</label>
        <textarea
          {...register('reason')}
          rows={3}
          placeholder="Describe the reason for your leave..."
          className={cn(
            "w-full px-4 py-3 bg-paper border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 font-medium text-ink resize-none",
            errors.reason ? "border-rose-400 focus:border-rose-400" : "border-cream-border focus:border-ochre/60"
          )}
        />
        {errors.reason && <p className="text-rose-600 text-xs font-medium">{errors.reason.message}</p>}
      </div>

      <button
        type="submit"
        disabled={formSubmitting}
        className="bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        <span>{formSubmitting ? 'Submitting…' : 'Submit request'}</span>
      </button>
    </form>
  );
}
