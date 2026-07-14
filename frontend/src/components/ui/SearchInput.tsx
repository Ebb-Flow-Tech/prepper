'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { forwardRef, InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    const hasValue = value && String(value).length > 0;

    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          ref={ref}
          type="text"
          value={value}
          className={cn(
            'h-10 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-sm text-foreground',
            'placeholder:text-[var(--color-text-tertiary)]',
            'transition-colors duration-[120ms] ease-out hover:border-[var(--border-strong)]',
            'focus-visible:outline-none focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className
          )}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[var(--color-text-tertiary)] transition-colors duration-[120ms] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
