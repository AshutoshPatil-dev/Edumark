import { cn } from '../../utils/attendance';
import type { AdminLog, AdminLogCategory } from '../../types';

interface AdminLogsTableProps {
  logs: AdminLog[];
  isLoadingLogs: boolean;
  logCategory: AdminLogCategory | 'all';
}

export function AdminLogsTable({ logs, isLoadingLogs, logCategory }: AdminLogsTableProps) {
  const categoryBadge: Record<string, string> = {
    attendance: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border-emerald-200',
    student: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 border-sky-200',
    timetable: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 border-violet-200',
    teacher: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200',
    leave: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 border-cyan-200',
  };

  if (isLoadingLogs) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-ink/10 border-t-ochre rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-0">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-cream-border">
            <th className="px-4 py-3 eyebrow">When</th>
            <th className="px-4 py-3 eyebrow">User</th>
            <th className="px-4 py-3 eyebrow">Category</th>
            <th className="px-4 py-3 eyebrow">Action</th>
            <th className="px-4 py-3 eyebrow">Details</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-cream-border">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-16 text-center text-ink-muted">
                No activity found{logCategory !== 'all' ? ` in the "${logCategory}" category` : ''}.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-paper transition-colors">
                <td className="px-4 py-3 text-ink-muted tabular-nums whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                  {log.profiles?.full_name || 'Unknown'}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold border uppercase tracking-wider', categoryBadge[log.category] || 'bg-cream text-ink border-cream-border')}>
                    {log.category}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-ink">{log.action}</td>
                <td className="px-4 py-3 text-ink-muted max-w-[280px] truncate">{log.details || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
