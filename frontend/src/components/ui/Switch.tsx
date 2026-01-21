'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, disabled, label, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className={cn(
            'relative h-6 w-11 appearance-none rounded-full transition-colors',
            'bg-zinc-300 dark:bg-zinc-600',
            'checked:bg-blue-500 dark:checked:bg-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
            'cursor-pointer',
            // Slider effect using ::before pseudo-element via CSS
            'before:content-[""] before:absolute before:h-5 before:w-5 before:rounded-full before:bg-white dark:before:bg-zinc-200 before:transition-transform before:pointer-events-none',
            'before:left-0.5 before:top-0.5',
            'checked:before:translate-x-5',
            className
          )}
          {...props}
        />
        {label && (
          <label className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
