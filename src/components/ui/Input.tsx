import React from 'react';
import { cn } from '../../utils/attendance';

/* ---------------------------------------------------------
   Input Atom
   Always paired with a visible <label>.
   Includes focus-visible outline via base CSS.
   Supports error state and help text.
   --------------------------------------------------------- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visible label text */
  label?: string;
  /** Helper text shown below the input */
  helpText?: string;
  /** Error message — replaces helpText and turns border red */
  error?: string;
  /** Left-aligned icon component */
  icon?: React.ReactNode;
  /** Unique id for label association */
  inputId?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helpText, error, icon, inputId, id, ...props }, ref) => {
    const resolvedId = inputId || id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="eyebrow block" htmlFor={resolvedId}>
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink/30 group-focus-within:text-ochre pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={resolvedId}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${resolvedId}-error` : helpText ? `${resolvedId}-help` : undefined
            }
            className={cn(
              'w-full py-3 bg-input border rounded-xl font-medium text-ink placeholder:text-ink/30',
              'focus:outline-none focus:ring-4 focus:ring-ochre/10',
              icon ? 'pl-12 pr-4' : 'px-4',
              error
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-cream-border focus:border-ochre/60',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={`${resolvedId}-error`} className="text-rose-600 text-xs font-medium" role="alert">
            {error}
          </p>
        )}
        {!error && helpText && (
          <p id={`${resolvedId}-help`} className="text-[0.75rem] text-ink-muted">
            {helpText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
