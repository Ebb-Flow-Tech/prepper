'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useAppState, getCanvasSaveHandler, type CanvasTab } from '@/lib/store';
import { useRecipe } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui';

const CANVAS_TABS: { id: CanvasTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'canvas', label: 'Canvas' },
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
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

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

  const handleStay = useCallback(() => {
    setShowUnsavedModal(false);
    setPendingTabId(null);
  }, []);

  const handleLeave = useCallback(() => {
    setShowUnsavedModal(false);
    if (pendingTabId) {
      setCanvasTab(pendingTabId);
    }
    setPendingTabId(null);
  }, [pendingTabId, setCanvasTab]);

  const handleSaveAndLeave = useCallback(async () => {
    const saveHandler = getCanvasSaveHandler();
    if (!saveHandler) return;
    setIsSaving(true);
    try {
      await saveHandler();
      setShowUnsavedModal(false);
      if (pendingTabId) {
        setCanvasTab(pendingTabId);
      }
      setPendingTabId(null);
    } catch {
      // Save failed — stay on canvas
    } finally {
      setIsSaving(false);
    }
  }, [pendingTabId, setCanvasTab]);

  // Handle escape key
  useEffect(() => {
    if (!showUnsavedModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleStay();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showUnsavedModal, handleStay]);

  // Focus modal on open
  useEffect(() => {
    if (showUnsavedModal && modalRef.current) {
      modalRef.current.focus();
    }
  }, [showUnsavedModal]);

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

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-modal-title"
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div
            ref={modalRef}
            tabIndex={-1}
            className={cn(
              'relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl',
              'dark:bg-zinc-900 dark:border dark:border-zinc-800',
              'focus:outline-none'
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 id="unsaved-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Unsaved Changes
              </h2>
              <button
                onClick={handleStay}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              You have unsaved changes. If you leave now, your work will be lost.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleStay}>
                Stay
              </Button>
              {canvasTab === 'canvas' && (
                <Button onClick={handleSaveAndLeave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save & Leave'}
                </Button>
              )}
              <Button variant="destructive" onClick={handleLeave} disabled={isSaving}>
                Leave
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
