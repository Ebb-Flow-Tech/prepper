'use client';

import { useState } from 'react';
import { Pencil, Check, Trash2, SendHorizonal, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui';
import {
  useCreateMenuSketchComment,
  useUpdateMenuSketchComment,
  useResolveMenuSketchComment,
  useDeleteMenuSketchComment,
} from '@/lib/hooks';
import type { MenuSketchSectionItemComment } from '@/types';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}

interface DishCommentsModalProps {
  itemId: number;
  dishName: string;
  comments: MenuSketchSectionItemComment[];
  onClose: () => void;
}

export function DishCommentsModal({ itemId, dishName, comments, onClose }: DishCommentsModalProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newText, setNewText] = useState('');

  const createComment = useCreateMenuSketchComment();
  const updateComment = useUpdateMenuSketchComment();
  const resolveComment = useResolveMenuSketchComment();
  const deleteComment = useDeleteMenuSketchComment();

  const visible = showResolved ? comments : comments.filter((c) => !c.resolved);
  const resolvedCount = comments.filter((c) => c.resolved).length;

  const addComment = () => {
    const text = newText.trim();
    if (!text) return;
    createComment.mutate(
      { menu_sketch_section_item_id: itemId, text },
      { onSuccess: () => setNewText('') }
    );
  };

  const saveEdit = (commentId: number) => {
    const text = editText.trim();
    if (!text) return;
    updateComment.mutate(
      { id: commentId, data: { text } },
      { onSuccess: () => { setEditingId(null); toast.success('Comment updated'); } }
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-[var(--color-scrim)]" onClick={onClose} />

        <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-elevation-3">
          {/* Header */}
          <div className="shrink-0 border-b border-border px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="truncate pr-4 text-sm font-medium text-foreground">
                {dishName || 'Unnamed dish'}
              </h3>
              <button
                onClick={onClose}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {resolvedCount > 0 && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-xs text-muted-foreground">Show resolved</span>
              </label>
            )}
          </div>

          {/* Comment list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {visible.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No comments yet.</p>
            )}
            {visible.map((comment) => (
              <div
                key={comment.id}
                className={`rounded-md border border-border bg-background p-2 space-y-1.5 ${
                  comment.resolved ? 'opacity-50' : ''
                }`}
              >
                {editingId === comment.id ? (
                  <div className="space-y-1.5">
                    <textarea
                      autoFocus
                      rows={2}
                      className="w-full resize-none rounded border border-border bg-muted px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(comment.id); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(comment.id)}
                        className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed text-foreground">{comment.text}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(comment.created_at)}
                      </span>
                      {comment.resolved ? (
                        <span className="text-[10px] italic text-muted-foreground">resolved</span>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <button
                            title="Edit"
                            onClick={() => { setEditingId(comment.id); setEditText(comment.text); }}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            title="Resolve"
                            onClick={() => resolveComment.mutate(comment.id)}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => setDeletingId(comment.id)}
                            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add comment */}
          <div className="shrink-0 border-t border-border px-4 py-3">
            <div className="relative">
              <textarea
                rows={1}
                placeholder="Add a comment…"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); }
                }}
                className="w-full resize-none rounded-md border border-border bg-muted px-2 py-1.5 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                title="Send"
                onClick={addComment}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <SendHorizonal className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId != null) { deleteComment.mutate(deletingId); }
          setDeletingId(null);
        }}
        title="Delete comment"
        message="Are you sure you want to delete this comment? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
      />
    </>
  );
}
