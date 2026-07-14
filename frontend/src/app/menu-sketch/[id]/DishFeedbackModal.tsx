'use client';

import { X } from 'lucide-react';
import type { MenuSketchTastingNote } from '@/types';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface DishFeedbackModalProps {
  dishName: string;
  notes: MenuSketchTastingNote[];
  onClose: () => void;
}

export function DishFeedbackModal({ dishName, notes, onClose }: DishFeedbackModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--color-scrim)]" onClick={onClose} />

      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-elevation-3">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-foreground truncate pr-4">
              {dishName || 'Unnamed dish'}
            </h3>
            <p className="text-[11px] text-muted-foreground">Tasting feedback</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {notes.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No tasting feedback yet.</p>
          )}
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border border-border bg-background p-3 space-y-2"
            >
              {/* Meta row */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {note.taster_name ?? 'Anonymous'}
                  </p>
                  {note.session_name && (
                    <p className="text-[10px] text-muted-foreground">
                      {note.session_name}
                      {note.session_date ? ` · ${formatDate(note.session_date)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {note.overall_rating != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {'★'.repeat(note.overall_rating)}{'☆'.repeat(5 - note.overall_rating)}
                    </span>
                  )}
                  {note.decision && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      note.decision === 'approved'
                        ? 'bg-[var(--color-feedback-success-tint)] text-[var(--color-feedback-success)]'
                        : note.decision === 'rejected'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-[var(--color-feedback-warning-tint)] text-[var(--color-feedback-warning)]'
                    }`}>
                      {note.decision === 'approved' ? 'Approved' : note.decision === 'rejected' ? 'Rejected' : 'Needs work'}
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback text */}
              {note.feedback && (
                <p className="text-xs leading-relaxed text-foreground">{note.feedback}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
