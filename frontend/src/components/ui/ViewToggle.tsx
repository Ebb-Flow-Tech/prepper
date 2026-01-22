'use client';

import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewType = 'grid' | 'list';

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-800 p-1 bg-white dark:bg-zinc-950">
      <button
        onClick={() => onViewChange('grid')}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          view === 'grid'
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        )}
        title="Grid view"
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          view === 'list'
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        )}
        title="List view"
        aria-label="List view"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
