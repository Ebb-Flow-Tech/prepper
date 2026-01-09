'use client';

import { useCallback } from 'react';
import { useAppState, type CanvasTab } from '@/lib/store';
import { useRecipe } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const CANVAS_TABS: { id: CanvasTab; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'overview', label: 'Overview' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'costs', label: 'Costs' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'tasting', label: 'Tasting' },
  { id: 'versions', label: 'Versions' },
];

export function TopAppBar() {
  const { selectedRecipeId, canvasTab, setCanvasTab, canvasHasUnsavedChanges } = useAppState();
  const { data: recipe } = useRecipe(selectedRecipeId);

  const handleTabClick = useCallback(
    (tabId: CanvasTab) => {
      // Only show warning when leaving the canvas tab with unsaved changes
      if (canvasTab === 'canvas' && tabId !== 'canvas' && canvasHasUnsavedChanges) {
        const confirmed = window.confirm(
          'You have unsaved changes. If you leave now, your work will be lost.'
        );
        if (!confirmed) {
          return;
        }
      }
      setCanvasTab(tabId);
    },
    [canvasTab, canvasHasUnsavedChanges, setCanvasTab]
  );

  return (
    <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Tabs row */}
      {recipe && (
        <nav className="flex gap-1 px-4" aria-label="Recipe tabs">
          {CANVAS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                canvasTab === tab.id
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
