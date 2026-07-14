'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // 1px --border-input (#807d76, 4.1:1) — a hairline fails as a control
          // boundary under WCAG 1.4.11 (§3.4). 8px radius, 40px comfortable (§11).
          'flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground',
          'placeholder:text-[var(--color-text-tertiary)]',
          'transition-colors duration-[120ms] ease-out hover:border-[var(--border-strong)]',
          'focus-visible:outline-none focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-[var(--color-text-disabled)]',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
