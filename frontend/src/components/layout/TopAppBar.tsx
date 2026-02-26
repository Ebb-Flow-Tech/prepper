'use client';

import { useCallback, useState } from 'react';
import { useAppState, type CanvasTab } from '@/lib/store';
import { useRecipe } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const CANVAS_TABS: { id: CanvasTab; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'overview', label: 'Overview' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'costs', label: 'Costs' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'tasting', label: 'Tasting' },
  { id: 'versions', label: 'Iterations' },
];

export function TopAppBar() {
  const { selectedRecipeId, canvasTab, setCanvasTab, canvasHasUnsavedChanges } = useAppState();
  const { data: recipe } = useRecipe(selectedRecipeId);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingTabId, setPendingTabId] = useState<CanvasTab | null>(null);

  const handleTabClick = useCallback(
    (tabId: CanvasTab) => {
      // Only show warning when leaving the canvas tab with unsaved changes
      if (canvasTab === 'canvas' && tabId !== 'canvas' && canvasHasUnsavedChanges) {
        setPendingTabId(tabId);
        setShowUnsavedModal(true);
        return;
      }
      setCanvasTab(tabId);
    },
    [canvasTab, canvasHasUnsavedChanges, setCanvasTab]
  );

  const handleConfirmLeave = useCallback(() => {
    setShowUnsavedModal(false);
    if (pendingTabId) {
      setCanvasTab(pendingTabId);
    }
    setPendingTabId(null);
  }, [pendingTabId, setCanvasTab]);

  const handleCancelLeave = useCallback(() => {
    setShowUnsavedModal(false);
    setPendingTabId(null);
  }, []);

  return (
    <>
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <nav className="flex items-center gap-1 px-4 py-1" aria-label="Recipe tabs">
          {CANVAS_TABS.map((tab) => {
            if (tab.id !== 'canvas' && !recipe) {
              return null;
            }
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
                  canvasTab === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <ConfirmModal
        isOpen={showUnsavedModal}
        onClose={handleCancelLeave}
        onConfirm={handleConfirmLeave}
        title="Unsaved Changes"
        message="You have unsaved changes. If you leave now, your work will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
      />
    </>
  );
}
