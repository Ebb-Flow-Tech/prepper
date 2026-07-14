'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unit';
  className?: string;
}

/**
 * Status pill (§12.4). 999px radius, sentence case, 12px/500.
 * Always a feedback tint background + its matching text tone — never a
 * saturated fill for inline table use. Plain/neutral states get the beige pill.
 */
export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-[1.4]',
        'transition-colors duration-[120ms] ease-out',
        {
          // Neutral beige pill — plain states, counts, and unit chips.
          'bg-muted text-muted-foreground':
            variant === 'default' || variant === 'secondary' || variant === 'unit',
          'bg-[var(--color-feedback-success-tint)] text-[var(--color-feedback-success)]':
            variant === 'success',
          'bg-[var(--color-feedback-info-tint)] text-[var(--color-feedback-info)]':
            variant === 'info',
          'bg-[var(--color-feedback-warning-tint)] text-[var(--color-feedback-warning)]':
            variant === 'warning',
          'bg-[var(--color-feedback-error-tint)] text-[var(--color-feedback-error)]':
            variant === 'destructive',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
