'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface DropdownButtonProps {
  label: string;
  icon?: React.ReactNode;
  items: DropdownItem[];
  className?: string;
}

export function DropdownButton({ label, icon, items, className }: DropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-10 px-4 rounded-lg font-medium text-sm transition-colors',
          'border border-border bg-card hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          open && 'bg-accent text-accent-foreground'
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            // Menu: overlay surface, 12px radius, elevation-2 (§12.7)
            'absolute right-0 z-50 mt-1 min-w-[220px] rounded-xl border border-border bg-popover shadow-elevation-2',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
        >
          <div className="p-1">
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left',
                  'transition-colors hover:bg-accent hover:text-accent-foreground',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
              >
                {item.icon && (
                  <span className="text-muted-foreground">{item.icon}</span>
                )}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
