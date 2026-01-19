'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unit';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors',
        {
          'bg-secondary text-secondary-foreground':
            variant === 'default',
          'bg-muted text-muted-foreground':
            variant === 'secondary',
          'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved))]':
            variant === 'success',
          'bg-[hsl(var(--status-testing-bg))] text-[hsl(var(--status-testing))]':
            variant === 'info',
          'bg-[hsl(var(--color-amber-light))] text-[hsl(var(--color-amber-dark))]':
            variant === 'warning',
          'bg-[hsl(var(--status-archived-bg))] text-[hsl(var(--status-archived))]':
            variant === 'destructive',
          'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300':
            variant === 'unit',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
