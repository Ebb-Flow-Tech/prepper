'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

/**
 * Toggle / switch (§11). 999px track ~36x20, white knob, 150ms slide.
 * Off = --border-strong track; on = accent track (a named accent role, §4).
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, disabled, label, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          className={cn(
            'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full',
            'bg-[var(--border-strong)] transition-colors duration-150 ease-out',
            'checked:bg-primary',
            'disabled:cursor-not-allowed disabled:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            // Knob
            'before:pointer-events-none before:absolute before:left-0.5 before:top-0.5 before:content-[""]',
            'before:h-4 before:w-4 before:rounded-full before:bg-[var(--surface-base)]',
            'before:transition-transform before:duration-150 before:ease-out',
            'checked:before:translate-x-4',
            className
          )}
          {...props}
        />
        {label && (
          <label className="cursor-pointer select-none text-sm text-muted-foreground">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
