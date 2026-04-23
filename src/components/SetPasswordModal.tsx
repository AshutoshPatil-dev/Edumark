import React, { useState } from 'react';
import { Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';

export default function SetPasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-night/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card p-8 rounded-3xl w-full max-w-md shadow-2xl border border-cream-border relative"
      >
        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-sans text-xl font-semibold text-ink">Password Set Successfully</h3>
            <p className="text-ink-muted text-sm">Your account is now fully secured. You can use this password to log in next time.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-ochre/10 rounded-full flex items-center justify-center mx-auto text-ochre-deep mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-sans text-2xl font-semibold text-ink">Set Your Password</h3>
              <p className="text-ink-muted text-sm mt-2">Welcome to Edumark! Please set a secure password to finalize your account setup.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="eyebrow block">New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-ink placeholder:text-ink/30"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="eyebrow block">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-ink/30 group-focus-within:text-ochre" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-input border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-medium text-ink placeholder:text-ink/30"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-ochre hover:bg-ochre-deep text-white font-semibold py-3.5 px-4 rounded-xl shadow-[0_8px_24px_-8px_rgba(37,99,235,0.45)] mt-6 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-70 transition-all"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Save Password & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
