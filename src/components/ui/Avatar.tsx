import React from 'react';
import { cn } from '../../utils/attendance';

/* ---------------------------------------------------------
   Avatar Atom
   Fallback chain: image → initials → silhouette
   Square grid per design principles.
   --------------------------------------------------------- */

const sizeMap = {
  xs: 'w-6 h-6 text-[0.5rem]',
  sm: 'w-8 h-8 text-[0.6875rem]',
  md: 'w-10 h-10 text-[0.8125rem]',
  lg: 'w-12 h-12 text-[0.9375rem]',
  xl: 'w-16 h-16 text-lg',
} as const;

export type AvatarSize = keyof typeof sizeMap;

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Full name — used for initials fallback */
  name?: string;
  /** Image URL */
  src?: string;
  /** Size preset */
  size?: AvatarSize;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, src, size = 'md', ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const showImage = src && !imgError;
    const initials = name ? getInitials(name) : '?';

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl bg-ochre/10 text-ochre-deep font-bold shrink-0 overflow-hidden border border-cream-border',
          sizeMap[size],
          className,
        )}
        role="img"
        aria-label={name || 'User avatar'}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="select-none">{initials}</span>
        )}
      </div>
    );
  },
);

Avatar.displayName = 'Avatar';
