'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

/**
 * Checkbox (§11). 18px box, 1px --border-input, 4px radius.
 * Checked = brand accent fill + white glyph — the checked state is one of the
 * accent's four named roles (§4). It is never blue.
 */
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
            'relative h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-sm border bg-card',
            'border-input transition-colors duration-[120ms] ease-out',
            'checked:border-primary checked:bg-primary',
            'hover:enabled:border-[var(--border-strong)]',
            'disabled:cursor-not-allowed disabled:bg-muted disabled:border-[var(--border-default)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            // Checkmark glyph
            'after:absolute after:hidden after:content-[""] checked:after:block',
            'after:left-[5px] after:top-[1px] after:h-[9px] after:w-[5px]',
            'after:rotate-45 after:border-b-2 after:border-r-2 after:border-[var(--color-text-inverse)]',
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

Checkbox.displayName = 'Checkbox';
