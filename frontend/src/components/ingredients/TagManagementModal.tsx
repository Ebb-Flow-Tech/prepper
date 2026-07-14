'use client';

import { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  useSupplierIngredientTags,
  useCreateSupplierIngredientTag,
  useDeleteSupplierIngredientTag,
  useTagsForSupplierIngredient,
  useAddTagToSupplierIngredient,
  useRemoveTagFromSupplierIngredient,
} from '@/lib/hooks';

interface TagManagementModalProps {
  siId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function TagManagementModal({ siId, isOpen, onClose }: TagManagementModalProps) {
  const [newTagName, setNewTagName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: allTags = [] } = useSupplierIngredientTags();
  const { data: linkedTags = [] } = useTagsForSupplierIngredient(siId);

  const createTag = useCreateSupplierIngredientTag();
  const deleteTag = useDeleteSupplierIngredientTag();
  const addTag = useAddTagToSupplierIngredient();
  const removeTag = useRemoveTagFromSupplierIngredient();

  const linkedIds = new Set(linkedTags.map((t) => t.id));

  function handleToggle(tagId: number) {
    if (linkedIds.has(tagId)) {
      removeTag.mutate({ siId, tagId });
    } else {
      addTag.mutate({ siId, tagId });
    }
  }

  async function handleCreate() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const tag = await createTag.mutateAsync(name);
      setNewTagName('');
      addTag.mutate({ siId, tagId: tag.id });
    } catch {
      // duplicate or network error — ignore
    }
  }

  function handleDeleteGlobal(tagId: number) {
    setConfirmDeleteId(tagId);
  }

  function confirmDelete() {
    if (confirmDeleteId !== null) {
      deleteTag.mutate(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage tags" maxWidth="max-w-sm">
      {/* Existing tags */}
      <div className="space-y-1 mb-5 max-h-64 overflow-y-auto">
        {allTags.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No tags yet. Create one below.</p>
        )}
        {allTags.map((tag) => {
          const linked = linkedIds.has(tag.id);
          return (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary group"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={linked}
                  onChange={() => handleToggle(tag.id)}
                  className="h-4 w-4 rounded border-input accent-[var(--color-brand-accent)] cursor-pointer"
                />
                <span className="text-sm text-foreground truncate">{tag.name}</span>
              </label>
              {confirmDeleteId === tag.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={confirmDelete}
                    className="text-xs text-[var(--color-feedback-error)] font-medium hover:underline"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDeleteGlobal(tag.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-lg text-muted-foreground hover:text-[var(--color-feedback-error)] transition-opacity"
                  aria-label={`Delete tag ${tag.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new tag */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          New tag
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Tag name..."
            className="flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleCreate}
            disabled={!newTagName.trim() || createTag.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {createTag.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
