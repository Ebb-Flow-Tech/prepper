'use client';

import { cn } from '@/lib/utils';

interface GroupSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  count?: number;
}

export function GroupSection({ title, children, className, count }: GroupSectionProps) {
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}
