/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Moon, Sun } from 'lucide-react';
import { cn } from '../utils/attendance';
import { useTheme } from '../context/ThemeContext';

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-2',
        'text-ink-muted hover:text-ink hover:bg-cream-soft',
        'border border-transparent hover:border-cream-border',
        className,
      )}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" strokeWidth={2} />
      ) : (
        <Moon className="h-[18px] w-[18px]" strokeWidth={2} />
      )}
    </button>
  );
}
