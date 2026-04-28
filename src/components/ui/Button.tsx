import React from 'react';
import { cn } from '../../utils/attendance';

/* ---------------------------------------------------------
   Button Atom
   Size: xs | sm | md | lg | xl
   Variant: primary | secondary | ghost | danger
   Min touch target: 44px
   --------------------------------------------------------- */

const sizeClasses = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  xl: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
} as const;

const variantClasses = {
  primary:
    'bg-ochre text-white font-semibold shadow-sm hover:bg-ochre-deep active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  secondary:
    'bg-cream text-ink font-semibold border border-cream-border hover:bg-paper-deep active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  ghost:
    'bg-transparent text-ink-muted font-medium hover:bg-cream hover:text-ink active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  danger:
    'bg-rose-600 text-white font-semibold shadow-sm hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
} as const;

export type ButtonSize = keyof typeof sizeClasses;
export type ButtonVariant = keyof typeof variantClasses;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  /** Renders a loading spinner instead of children */
  loading?: boolean;
  /** Renders as a child element (e.g. <a>) */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'md', variant = 'primary', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap transition-all',
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <div
            className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
