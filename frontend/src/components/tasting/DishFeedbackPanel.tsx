'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  useSessionNotes,
  useAddNoteToSession,
  useUpdateTastingNote,
  useDeleteTastingNote,
  useSyncTastingNoteImages,
} from '@/lib/hooks/useTastings';
import {
  FeedbackNoteCard,
  FeedbackForm,
  type FeedbackFormData,
} from '@/components/tasting/FeedbackShared';
import { Card, CardContent } from '@/components/ui';
import { useAppState } from '@/lib/store';
import type { TastingNote } from '@/types';
import type { ImageWithId } from '@/components/tasting/ImageUploadPreview';

interface Props {
  recipeId: number;
  sessionId: number;
  currentUserId: string | null;
  isParticipant: boolean;
}

export function DishFeedbackPanel({ recipeId, sessionId, currentUserId, isParticipant }: Props) {
  const { username } = useAppState();
  const { data: allNotes } = useSessionNotes(sessionId);
  const addNote = useAddNoteToSession();
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();
  const syncImages = useSyncTastingNoteImages();

  const recipeNotes = (allNotes ?? []).filter((n) => n.recipe_id === recipeId);

  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddNote = async (data: FeedbackFormData, imagesWithId: ImageWithId[] = []) => {
    const result = await addNote.mutateAsync({
      sessionId,
      data: {
        recipe_id: recipeId,
        user_id: currentUserId || undefined,
        taster_name: username || data.taster_name || null,
        decision: data.decision || null,
        feedback: data.feedback || null,
        action_items: data.action_items || null,
        taste_rating: data.taste_rating,
        presentation_rating: data.presentation_rating,
        texture_rating: data.texture_rating,
        overall_rating: data.overall_rating,
      },
      userId: currentUserId,
    });

    if (imagesWithId.length > 0 && result?.id) {
      try {
        await syncImages.mutateAsync({ tastingNoteId: result.id, images: imagesWithId });
      } catch (imageError) {
        console.error('Failed to sync images:', imageError);
      }
    }

    setShowAddForm(false);
  };

  const handleUpdateNote = async (noteId: number, data: Partial<TastingNote>) => {
    await updateNote.mutateAsync({ sessionId, noteId, data, userId: currentUserId });
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Remove this feedback from the tasting session?')) return;
    await deleteNote.mutateAsync({ sessionId, noteId, userId: currentUserId });
  };

  return (
    <div className="px-4 pt-3 pb-4 border-t border-border">
      {recipeNotes.length === 0 && !showAddForm ? (
        <div className="text-center py-6 border border-dashed border-border rounded-lg mb-3">
          <p className="text-sm text-muted-foreground">No feedback recorded yet</p>
        </div>
      ) : (
        <div>
          {recipeNotes.map((note) => (
            <FeedbackNoteCard
              key={note.id}
              note={note}
              currentUserId={currentUserId}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              showOwnerBadge
            />
          ))}
        </div>
      )}

      {isParticipant && (
        <div className="mt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAddForm ? 'rotate-180' : ''}`} />
            Add feedback
          </button>
          {showAddForm && (
            <Card className="border-border bg-muted/50">
              <CardContent className="pt-4">
                <FeedbackForm
                  initialData={{ taster_name: username || '' }}
                  onSubmit={handleAddNote}
                  onCancel={() => setShowAddForm(false)}
                  submitLabel="Add feedback"
                  showImages={true}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
