'use client';

import Link from 'next/link';
import { useAppState } from '@/lib/store';
import { useRecipe, useRecipeTastingNotes } from '@/lib/hooks';
import { Card, CardContent, Skeleton } from '@/components/ui';
import type { TastingNoteWithRecipe } from '@/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function TastingNoteCard({ note }: { note: TastingNoteWithRecipe }) {
  return (
    <Link href={`/tastings/${note.session_id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-secondary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-foreground">
              {note.session_name || 'Untitled Session'}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(note.session_date)}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-3">
            Tasted by: {note.taster_name || 'Anonymous'}
          </div>

          {note.feedback && (
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Feedback
              </div>
              <p className="text-sm text-muted-foreground">{note.feedback}</p>
            </div>
          )}

          {note.action_items && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Action Items
              </div>
              <p className="text-sm text-muted-foreground">{note.action_items}</p>
            </div>
          )}

          {!note.feedback && !note.action_items && (
            <div className="text-sm text-muted-foreground italic">
              No feedback recorded
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function TastingNotesList({ recipeId }: { recipeId: number }) {
  const { data: notes, isLoading, error } = useRecipeTastingNotes(recipeId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !notes) {
    return (
      <div className="text-sm text-muted-foreground">
        Failed to load tasting notes.
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No tasting notes recorded for this recipe yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note: TastingNoteWithRecipe) => (
        <TastingNoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}

export function TastingTab() {
  const { selectedRecipeId } = useAppState();
  const { data: recipe, isLoading, error } = useRecipe(selectedRecipeId);

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a recipe from the left panel to view its tasting notes
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 text-foreground">
          Tasting Notes
        </h2>
        <TastingNotesList recipeId={recipe.id} />
      </div>
    </div>
  );
}
