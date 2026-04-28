import React from 'react';
import { cn } from '../../utils/attendance';

/* ---------------------------------------------------------
   Card Molecule
   Slots: header, body (children), footer/actions
   Uses elevation tier from design system.
   --------------------------------------------------------- */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional header content */
  header?: React.ReactNode;
  /** Optional footer / action bar */
  footer?: React.ReactNode;
  /** Elevation tier */
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  /** Remove default padding (for full-bleed content) */
  flush?: boolean;
}

const elevationMap = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
} as const;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, header, footer, elevation = 'none', flush, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-card border border-cream-border rounded-2xl overflow-hidden',
          elevationMap[elevation],
          className,
        )}
        {...props}
      >
        {header && (
          <div className="px-6 py-4 border-b border-cream-border">{header}</div>
        )}
        <div className={flush ? '' : 'p-6'}>{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-cream-border bg-cream/30">
            {footer}
          </div>
        )}
      </div>
    );
  },
);

Card.displayName = 'Card';
