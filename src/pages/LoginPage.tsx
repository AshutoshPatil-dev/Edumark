/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from 'react';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import EdumarkLogo from '../components/EdumarkLogo';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: fetchError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (data.user && !fetchError) {
        onLogin();
      } else {
        setError(fetchError?.message || 'Invalid email or password');
      }
    } catch (err) {
      setError('Database connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-2 bg-transparent relative">
      <div className="fixed top-4 right-4 z-50 sm:top-6 sm:right-6">
        <ThemeToggle className="bg-card/80 shadow-sm border border-cream-border/80" />
      </div>

      {/* Left Panel — Brand & Value Props */}
      <section className="order-2 lg:order-1 flex flex-col justify-center p-6 sm:p-10 lg:px-14 lg:py-12 border-b border-cream-border lg:border-b-0 lg:border-r min-h-[280px] sm:min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg mx-auto w-full"
        >
          <div className="flex items-center gap-3 mb-8 sm:mb-10">
            <EdumarkLogo size={48} variant={theme === 'dark' ? 'light' : 'dark'} />
            <div className="leading-none">
              <span
                className="font-display text-2xl tracking-tight text-ink block"
                style={{ fontWeight: 600 }}
              >
                Edu
                <span className="text-gradient-cool" style={{ fontWeight: 700 }}>
                  m
                </span>
                ark
              </span>
              <span className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-soft mt-1.5 block">
                For faculty &amp; students
              </span>
            </div>
          </div>

          <p className="eyebrow text-ink-muted mb-2">For your school</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight text-balance leading-tight">
            Edumark: Attendance management{' '}
            <span className="text-gradient-cool">in one place</span>.
          </h1>
          <p className="mt-4 text-ink-muted text-base sm:text-lg leading-relaxed text-pretty">
            Mark lessons, see who needs support, and keep a clear record your
            administration can use — without the extra noise.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
            {[
              {
                title: 'Advanced Analytics',
                desc: 'Time-weighted attendance (TWAS) identifies at-risk students before they fall behind, providing actionable insights for faculty.',
              },
              {
                title: 'Faculty Management',
                desc: 'Streamline timetable management and lesson tracking with an intuitive interface designed for busy educators.',
              },
              {
                title: 'Secure Portals',
                desc: 'Separate, secure access for staff and students ensures data privacy with real-time visibility into records.',
              },
              {
                title: 'Enterprise Reporting',
                desc: 'Generate and export comprehensive attendance reports compatible with institutional requirements.',
              },
            ].map((item) => (
              <div key={item.title}>
                <h2 className="font-display text-sm font-semibold text-ink uppercase tracking-wider mb-3">
                  {item.title}
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Right Panel — Sign In Form */}
      <section className="order-1 lg:order-2 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border border-cream-border bg-card/90 p-6 sm:p-8 shadow-lg ring-1 ring-ochre/5 backdrop-blur-md">
            <div className="mb-8">
              <p className="eyebrow">Sign in</p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink mt-2 tracking-tight">
                Sign in to your portal
              </h2>
              <p className="text-ink-muted mt-2 text-sm sm:text-base leading-relaxed">
                Use your school email. Faculty see classes; students see their own record.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-50 text-rose-700 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-200/70"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-[18px] h-[18px]" />}
                placeholder="name@institution.edu"
              />

              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-[18px] h-[18px]" />}
                placeholder="••••••••"
              />

              <Button
                type="submit"
                size="lg"
                variant="primary"
                loading={isLoading}
                className="w-full shadow-[0_10px_28px_-10px_rgba(0,112,243,0.35)]"
              >
                <span>Sign in to EduMark</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Button>

              <div className="pt-2">
                <div className="rule-paper my-6" />
                <p className="text-[0.75rem] text-ink-muted text-center leading-relaxed">
                  Authorised personnel only. All sessions are logged.
                  <br />
                  Contact your administrator for access.
                </p>
              </div>
            </form>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
