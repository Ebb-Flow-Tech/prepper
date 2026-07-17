'use client';

import { forwardRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A bordered, horizontally-scrollable data table.
 *
 * `BrandAccessTab` and `UserManagementTab` both hand-rolled this with duplicated `px-6 py-3`
 * classes; both use it now. The `overflow-x-auto` wrapper is not decoration: wide content must
 * scroll inside its own container so the page body never scrolls horizontally.
 */

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table ref={ref} className={cn('w-full', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('bg-secondary', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y divide-border', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('text-left transition-colors hover:bg-accent/50', className)} {...props} />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-6 py-4 text-sm', className)} {...props} />
));
TableCell.displayName = 'TableCell';

/** A full-width row for "nothing here" — spans every column so the message centres properly. */
export const TableEmpty = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement> & { colSpan: number }
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-6 py-8 text-center text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableEmpty.displayName = 'TableEmpty';
