import React, { useState, type FormEvent } from 'react';
import { Building2, User, Mail, Phone, MessageSquare, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

interface RequestAccessFormProps {
  onBack: () => void;
}

export default function RequestAccessForm({ onBack }: RequestAccessFormProps) {
  const [formData, setFormData] = useState({
    school_name: '',
    contact_name: '',
    contact_email: '',
    phone: '',
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      const { error } = await supabase
        .from('institution_requests')
        .insert([formData]);

      if (error) throw error;

      setStatus({ type: 'success', text: 'Application submitted successfully! We will contact you shortly.' });
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'Failed to submit application' });
    } finally {
      setIsLoading(false);
    }
  };

  if (status?.type === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/50 p-8 shadow-lg text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="font-sans text-xl font-semibold text-emerald-900">Application Received</h3>
        <p className="text-emerald-700 text-sm leading-relaxed">
          Thank you for your interest in Edumark. Our team will review your application and contact you at <strong>{formData.contact_email}</strong> shortly.
        </p>
        <button
          onClick={onBack}
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-border bg-card/90 p-6 sm:p-8 shadow-lg shadow-ochre/5 ring-1 ring-aqua/10 backdrop-blur-md">
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </button>
        <p className="eyebrow">Partner with us</p>
        <h2 className="font-sans text-2xl font-semibold text-ink mt-1 tracking-tight">
          Request Institution Access
        </h2>
        <p className="text-ink-muted mt-2 text-sm leading-relaxed">
          Fill out this form to request a dedicated workspace for your school.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {status?.type === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 text-rose-700 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-200/70"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{status.text}</span>
          </motion.div>
        )}

        <div className="space-y-1.5">
          <label className="eyebrow block">School Name</label>
          <div className="relative group">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
            <input
              required
              value={formData.school_name}
              onChange={e => setFormData(p => ({ ...p, school_name: e.target.value }))}
              className="w-full pl-11 pr-4 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-sm text-ink placeholder:text-ink/30"
              placeholder="e.g. Lincoln High School"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="eyebrow block">Contact Name</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
              <input
                required
                value={formData.contact_name}
                onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))}
                className="w-full pl-11 pr-3 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-sm text-ink placeholder:text-ink/30"
                placeholder="John Doe"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="eyebrow block">Official Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
              <input
                type="email"
                required
                value={formData.contact_email}
                onChange={e => setFormData(p => ({ ...p, contact_email: e.target.value }))}
                className="w-full pl-11 pr-3 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-sm text-ink placeholder:text-ink/30"
                placeholder="admin@school.edu"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="eyebrow block">Phone (Optional)</label>
          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              className="w-full pl-11 pr-4 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-sm text-ink placeholder:text-ink/30"
              placeholder="+1 234 567 8900"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="eyebrow block">Message (Optional)</label>
          <div className="relative group">
            <MessageSquare className="absolute left-4 top-3 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
            <textarea
              value={formData.message}
              onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
              rows={3}
              className="w-full pl-11 pr-4 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-sm text-ink placeholder:text-ink/30 resize-none"
              placeholder="Tell us about your institution's needs..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="group w-full bg-night hover:bg-black text-white font-semibold py-3.5 px-4 rounded-xl shadow-md mt-2 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-70 transition-all"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Submit Application</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
