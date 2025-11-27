'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300':
            variant === 'default',
          'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400':
            variant === 'secondary',
          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300':
            variant === 'success',
          'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300':
            variant === 'warning',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
