/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface InstitutionOnboardingProps {
  profileId: string;
  onComplete: () => Promise<void>;
}

export default function InstitutionOnboarding({ profileId, onComplete }: InstitutionOnboardingProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      // 1. Create the institution
      const { data: inst, error: instError } = await supabase
        .from('institutions')
        .insert({ name, slug: cleanSlug })
        .select()
        .single();

      if (instError) throw instError;

      // 2. Link the admin profile to this institution
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ institution_id: inst.id })
        .eq('id', profileId);

      if (profileUpdateError) throw profileUpdateError;

      // 3. Refresh app state
      await onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to create institution');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card p-8 rounded-3xl border border-cream-border shadow-xl space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-ochre/10 text-ochre rounded-2xl flex items-center justify-center mx-auto mb-4 border border-ochre/20">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="font-sans text-3xl font-bold text-ink tracking-tight">Setup your institution</h1>
          <p className="text-ink-muted leading-relaxed">
            Welcome to EduMark. Create your institution profile to start managing attendance and students.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="space-y-1.5">
            <label className="eyebrow block">Institution Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="e.g. DPGU STR"
              className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
            />
          </div>

          <div className="space-y-1.5">
            <label className="eyebrow block">URL Slug</label>
            <div className="relative">
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="college-name"
                className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink pl-[5.5rem]"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-medium">
                edumark/
              </span>
            </div>
            <p className="text-[0.65rem] text-ink-muted mt-1 px-1">
              Used as a unique identifier for your college.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-ochre hover:bg-ochre-deep text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <span>{isLoading ? 'Creating...' : 'Launch Institution'}</span>
            {!isLoading && <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
          </button>
        </form>

        <div className="pt-4 border-t border-cream-border grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-ink-muted">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Multi-department
          </div>
          <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-ink-muted">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Audit Logging
          </div>
        </div>
      </motion.div>
    </div>
  );
}
