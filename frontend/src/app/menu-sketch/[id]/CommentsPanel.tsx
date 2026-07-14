'use client';

import { useState } from 'react';
import { Pencil, Check, Trash2, SendHorizonal } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui';
import {
  useCreateMenuSketchComment,
  useUpdateMenuSketchComment,
  useResolveMenuSketchComment,
  useDeleteMenuSketchComment,
} from '@/lib/hooks';
import type { MenuSketchSection, MenuSketchSectionItem, MenuSketchSectionItemComment } from '@/types';

interface CommentsPanelProps {
  sections: MenuSketchSection[];
  itemsBySection: Record<number, MenuSketchSectionItem[]>;
  commentsByItemId: Record<number, MenuSketchSectionItemComment[]>;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}

export function CommentsPanel({ sections, itemsBySection, commentsByItemId }: CommentsPanelProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newCommentText, setNewCommentText] = useState<Record<number, string>>({});

  const createComment = useCreateMenuSketchComment();
  const updateComment = useUpdateMenuSketchComment();
  const resolveComment = useResolveMenuSketchComment();
  const deleteComment = useDeleteMenuSketchComment();

  const addComment = (itemId: number) => {
    const text = (newCommentText[itemId] ?? '').trim();
    if (!text) return;
    createComment.mutate(
      { menu_sketch_section_item_id: itemId, text },
      { onSuccess: () => setNewCommentText((m) => ({ ...m, [itemId]: '' })) }
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

  const allItems = sections.flatMap((s) =>
    (itemsBySection[s.id] ?? []).map((item) => ({ sectionName: s.name, item }))
  );

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3 space-y-2">
        <h3 className="text-sm font-medium text-foreground">Comments</h3>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <span className="text-xs text-muted-foreground">Show resolved</span>
        </label>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {allItems.length === 0 && (
          <p className="pt-6 text-center text-xs text-muted-foreground">No dishes yet.</p>
        )}

        {allItems.map(({ item }) => {
          const allItemComments = commentsByItemId[item.id] ?? [];
          const visible = showResolved
            ? allItemComments
            : allItemComments.filter((c) => !c.resolved);

          return (
            <div key={item.id} className="space-y-1.5">
              <p className="truncate text-xs font-semibold text-foreground">
                {item.recipe_name || 'Unnamed dish'}
              </p>

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
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit(comment.id);
                          }
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

              {/* Add comment form */}
              <div className="relative">
                <textarea
                  rows={1}
                  placeholder="Add a comment…"
                  value={newCommentText[item.id] ?? ''}
                  onChange={(e) =>
                    setNewCommentText((m) => ({ ...m, [item.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addComment(item.id);
                    }
                  }}
                  className="w-full resize-none rounded-md border border-border bg-muted px-2 py-1.5 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  title="Send"
                  onClick={() => addComment(item.id)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <SendHorizonal className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId != null) deleteComment.mutate(deletingId);
          setDeletingId(null);
        }}
        title="Delete comment"
        message="Are you sure you want to delete this comment? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
