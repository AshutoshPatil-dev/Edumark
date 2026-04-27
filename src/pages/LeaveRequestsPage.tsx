/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Send,
  AlertCircle,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/attendance';
import { motion, AnimatePresence } from 'motion/react';
import type { Profile, LeaveRequest, LeaveStatus, LeaveType } from '../types';
import { writeAdminLog } from '../utils/admin';

import { LeaveRequestForm } from '../components/Leave/LeaveRequestForm';

interface LeaveRequestsPageProps {
  profile: Profile;
  studentId?: string;
}

const LEAVE_TYPES: { id: LeaveType; label: string }[] = [
  { id: 'medical', label: 'Medical' },
  { id: 'personal', label: 'Personal' },
  { id: 'academic', label: 'Academic' },
  { id: 'other', label: 'Other' },
];

const STATUS_FILTERS: { id: LeaveStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
];

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 border-rose-200',
};

const leaveTypeBadge: Record<string, string> = {
  medical: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 border-sky-200',
  personal: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 border-violet-200',
  academic: 'bg-ochre/10 text-ochre-deep border-ochre/30',
  other: 'bg-cream text-ink border-cream-border',
};

export default function LeaveRequestsPage({ profile, studentId }: LeaveRequestsPageProps) {
  const isStudentView = profile.role === 'student';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  // Student form state
  const [showForm, setShowForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);

    let query = supabase
      .from('leave_requests')
      .select('*, students(name, roll_no, division)')
      .order('created_at', { ascending: false });

    if (isStudentView && studentId) {
      query = query.eq('student_id', studentId);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    setRequests((data as LeaveRequest[]) ?? []);
    setIsLoading(false);
  }, [statusFilter, isStudentView, studentId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: string, action: 'approved' | 'rejected') => {
    setActionLoading(requestId);

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: action,
        reviewed_by: profile.id,
        review_note: reviewNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      const request = requests.find(r => r.id === requestId);
      await writeAdminLog(
        profile.id,
        'leave',
        `${action === 'approved' ? 'Approved' : 'Rejected'} leave request`,
        `${request?.students?.name || 'Unknown'} (${request?.students?.roll_no || 'â€”'}) Â· ${request?.start_date} to ${request?.end_date} Â· ${request?.leave_type}${reviewNote ? ` Â· Note: ${reviewNote}` : ''}`
      );
      setActiveReviewId(null);
      setReviewNote('');
      await fetchRequests();
    }
    setActionLoading(null);
  };

  const handleSubmitRequest = async (data: { startDate: string; endDate: string; reason: string; leaveType: LeaveType }) => {
    if (!studentId) return;
    setFormSubmitting(true);
    setFormMessage(null);

    const { error } = await supabase.from('leave_requests').insert({
      student_id: studentId,
      start_date: data.startDate,
      end_date: data.endDate,
      reason: data.reason,
      leave_type: data.leaveType,
      status: 'pending',
    });

    if (error) {
      setFormMessage({ type: 'error', text: error.message || 'Failed to submit request.' });
    } else {
      setFormMessage({ type: 'success', text: 'Leave request submitted successfully. Your faculty will review it.' });
      setShowForm(false);
      await fetchRequests();
    }
    setFormSubmitting(false);
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <p className="eyebrow">{isStudentView ? 'My requests' : 'Leave management'}</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-sans text-3xl md:text-4xl font-semibold text-ink tracking-tight text-balance">
              Leave <span className="text-ochre">requests</span>
            </h1>
            <p className="text-ink-muted mt-3 max-w-xl leading-relaxed text-sm sm:text-base">
              {isStudentView
                ? 'Submit and track your absence requests. Approved leaves are considered during attendance calculations.'
                : 'Review and manage student leave applications. Approved leaves exclude absences from TWAS penalties.'}
            </p>
          </div>
          {isStudentView && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-ochre hover:bg-ochre-deep text-white px-5 py-3 rounded-xl font-semibold shadow-[0_8px_24px_-8px_rgba(37,99,235,0.45)] flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{showForm ? 'Cancel' : 'New request'}</span>
            </button>
          )}
          {!isStudentView && pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-xl">
              <Clock className="w-4 h-4" />
              <span className="font-semibold text-sm">{pendingCount} pending</span>
            </div>
          )}
        </div>
        <div className="rule-paper" />
      </header>

      {/* Student form */}
      <AnimatePresence>
        {showForm && isStudentView && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <LeaveRequestForm formSubmitting={formSubmitting} onSubmit={handleSubmitRequest} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status message */}
      {formMessage && (
        <div className={cn('p-4 rounded-xl flex items-start gap-3 border', formMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200/70 text-emerald-800' : 'bg-rose-50 border-rose-200/70 text-rose-800')}>
          {formMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="font-medium text-sm">{formMessage.text}</p>
        </div>
      )}

      {/* Filter pills (for faculty/admin) */}
      {!isStudentView && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-ink-muted shrink-0" />
          {STATUS_FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  statusFilter === f.id
                    ? 'bg-night text-white border-night'
                    : 'bg-cream text-ink-muted border-cream-border hover:text-ink',
                )}
              >
                <Icon className="w-3 h-3" />
                {f.label}
                {f.id === 'pending' && pendingCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-white/20 text-[0.625rem] font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Requests list */}
      <div className="bg-card rounded-3xl border border-cream-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-ink/10 border-t-ochre rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-ink-muted">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No leave requests found</p>
            <p className="text-sm mt-1">
              {isStudentView ? 'Submit your first request using the button above.' : 'No requests match the current filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-cream-border">
            {requests.map((request, idx) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="p-5 md:p-6 hover:bg-paper transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left: student info + details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {!isStudentView && (
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-cream border border-cream-border flex items-center justify-center text-ink font-semibold text-sm">
                            {request.students?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-ink text-[0.9375rem] leading-tight">
                              {request.students?.name || 'Unknown'}
                            </p>
                            <p className="text-[0.6875rem] text-ink-muted mt-0.5">
                              {request.students?.roll_no || '-'} · Div {request.students?.division || '-'}
                            </p>
                          </div>
                        </div>
                      )}
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[0.625rem] font-semibold uppercase tracking-[0.15em] border', statusBadge[request.status])}>
                        {request.status}
                      </span>
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[0.625rem] font-semibold uppercase tracking-[0.15em] border', leaveTypeBadge[request.leave_type])}>
                        {request.leave_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-ink-muted">
                      <Calendar className="w-3.5 h-3.5 text-ochre" />
                      <span className="font-medium">
                        {new Date(request.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {request.start_date !== request.end_date && (
                          <> → {new Date(request.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                        )}
                      </span>
                      <span className="text-[0.6875rem] text-ink-muted">
                        Submitted {new Date(request.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-sm text-ink leading-relaxed bg-paper p-3 rounded-xl border border-cream-border">
                      {request.reason}
                    </p>

                    {request.review_note && (
                      <div className="flex items-start gap-2 text-sm text-ink-muted bg-cream p-3 rounded-xl border border-cream-border">
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-ochre shrink-0" />
                        <div>
                          <span className="font-semibold text-ink text-[0.75rem]">Reviewer note: </span>
                          {request.review_note}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: action buttons */}
                  {!isStudentView && request.status === 'pending' && (
                    <div className="flex flex-col gap-2 shrink-0 md:w-44">
                      {activeReviewId === request.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="Optional note..."
                            className="w-full px-3 py-2 bg-paper border border-cream-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-ink"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(request.id, 'approved')}
                              disabled={actionLoading === request.id}
                              className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[0.75rem] font-semibold disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(request.id, 'rejected')}
                              disabled={actionLoading === request.id}
                              className="flex-1 flex items-center justify-center gap-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[0.75rem] font-semibold disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                          <button
                            onClick={() => { setActiveReviewId(null); setReviewNote(''); }}
                            className="w-full py-1.5 text-[0.75rem] text-ink-muted hover:text-ink font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveReviewId(request.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-ochre hover:bg-ochre-deep text-white rounded-xl text-[0.8125rem] font-semibold"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
