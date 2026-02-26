'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, disabled, label, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className={cn(
            'relative h-5 w-5 appearance-none rounded border-2 transition-all',
            'border-zinc-300 dark:border-zinc-600',
            'bg-white dark:bg-zinc-950',
            'checked:bg-blue-500 checked:border-blue-500 dark:checked:bg-blue-600 dark:checked:border-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-900',
            'hover:enabled:border-blue-400 dark:hover:enabled:border-blue-500',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950',
            'cursor-pointer',
            // Checkmark using ::after pseudo-element
            'after:content-[""] after:absolute after:hidden',
            'checked:after:block',
            'after:left-1.5 after:top-0.5 after:h-3 after:w-1.5',
            'after:border-r-2 after:border-b-2 after:border-white after:dark:border-white',
            'after:transform after:rotate-45',
            className
          )}
          {...props}
        />
        {label && (
          <label className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
