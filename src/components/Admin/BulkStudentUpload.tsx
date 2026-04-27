import { Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../utils/attendance';

const bulkSchema = z.object({
  csvData: z.string().min(1, 'CSV data is required'),
});

interface BulkStudentUploadProps {
  isLoading: boolean;
  onSubmit: (csvData: string) => Promise<void>;
}

export function BulkStudentUpload({ isLoading, onSubmit }: BulkStudentUploadProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ csvData: string }>({
    resolver: zodResolver(bulkSchema),
  });

  const onFormSubmit = async (data: { csvData: string }) => {
    await onSubmit(data.csvData);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <label className="eyebrow block">CSV data</label>
        <p className="text-[0.75rem] text-ink-muted mb-2">
          Format: <code className="font-mono bg-cream px-1.5 py-0.5 rounded">Name, RollNo, Batch</code>. One student per line.
        </p>
        <textarea
          {...register('csvData')}
          rows={10}
          className={cn(
            "w-full px-4 py-3 bg-paper border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 font-mono text-sm text-ink",
            errors.csvData ? "border-rose-400 focus:border-rose-400" : "border-cream-border focus:border-ochre/60"
          )}
          placeholder={"John Doe, 25FC304, F1\nJane Smith, 25FC205, F2"}
        />
        {errors.csvData && <p className="text-rose-600 text-xs font-medium">{errors.csvData.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Upload className="w-4 h-4" />
        <span>{isLoading ? 'Processing…' : 'Upload students'}</span>
      </button>
    </form>
  );
}
