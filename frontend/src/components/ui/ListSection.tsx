'use client';

import { cn } from '@/lib/utils';

interface ListSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  count?: number;
}

export function ListSection({ title, children, className, count }: ListSectionProps) {
  return (
    <section className={cn('mb-8', className)}>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-sm text-muted-foreground">
            ({count})
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 w-full">
        {children}
      </div>
    </section>
  );
}
