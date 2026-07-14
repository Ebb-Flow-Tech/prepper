'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          // 8px radius (rounded-lg) is the functional default — there is no pill
          // button in product UI; pills are reserved for status/chips (§9).
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-colors duration-[120ms] ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Disabled is never opacity alone (§10.1).
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-[var(--color-text-disabled)]',
          {
            // Primary — accent fill. One per view (§4).
            'bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,white)] active:bg-[color-mix(in_srgb,var(--primary)_78%,white)] disabled:hover:bg-muted':
              variant === 'default',
            'border border-border bg-card text-foreground hover:bg-accent active:bg-background-contrast':
              variant === 'outline',
            'text-foreground hover:bg-accent active:bg-background-contrast':
              variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_88%,black)]':
              variant === 'destructive',
            'bg-secondary text-secondary-foreground hover:bg-background-contrast':
              variant === 'secondary',
          },
          {
            // Control heights track the density scale (§6.2).
            'h-10 px-4 text-sm': size === 'default',
            'h-8 px-3 text-sm': size === 'sm',
            'h-12 px-6 text-base': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
