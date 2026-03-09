'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAppState } from '@/lib/store';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  ChefHat,
  Plus,
} from 'lucide-react';
import {
  useTastingSession,
  useSessionNotes,
  useAddNoteToSession,
  useUpdateTastingNote,
  useDeleteTastingNote,
  useSyncTastingNoteImages,
} from '@/lib/hooks/useTastings';
import { useRecipeForTasting, useRecipeAllergens } from '@/lib/hooks';
import { type ImageWithId } from '@/components/tasting/ImageUploadPreview';
import {
  FeedbackForm,
  FeedbackNoteCard,
  type FeedbackFormData,
} from '@/components/tasting/FeedbackShared';
import {
  Button,
  Skeleton,
  Card,
  CardContent,
  Badge,
} from '@/components/ui';
import type { TastingNote } from '@/types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function RecipeTastingPage() {
  const params = useParams();
  const sessionId = params.id ? Number(params.id) : null;
  const recipeId = params.recipeId ? Number(params.recipeId) : null;

  const { userId, username } = useAppState();

  const { data: session, isLoading: sessionLoading } = useTastingSession(sessionId);
  const isInvited = userId && session?.participants?.some((p) => p.user_id === userId) === true;
  const { data: recipe, isLoading: recipeLoading } = useRecipeForTasting(recipeId);
  const { data: allergens = [] } = useRecipeAllergens(recipeId);
  const { data: allNotes } = useSessionNotes(sessionId);

  const addNote = useAddNoteToSession();
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();
  const syncImages = useSyncTastingNoteImages();

  // Filter notes for this specific recipe
  const recipeNotes = allNotes?.filter((n) => n.recipe_id === recipeId) || [];

  // For new notes
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddNote = async (data: FeedbackFormData, imagesWithId: ImageWithId[] = []) => {
    if (!sessionId || !recipeId) return;
    try {
      const result = await addNote.mutateAsync({
        sessionId,
        data: {
          recipe_id: recipeId,
          user_id: userId || undefined,
          taster_name: username || data.taster_name || null,
          decision: data.decision || null,
          feedback: data.feedback || null,
          action_items: data.action_items || null,
          taste_rating: data.taste_rating,
          presentation_rating: data.presentation_rating,
          texture_rating: data.texture_rating,
          overall_rating: data.overall_rating,
        },
        userId,
      });

      // If there are images to sync, sync them after note creation
      if (imagesWithId.length > 0 && result?.id) {
        try {
          await syncImages.mutateAsync({
            tastingNoteId: result.id,
            images: imagesWithId,
          });
        } catch (imageError) {
          console.error('Failed to sync images:', imageError);
          // Don't fail the note creation if images fail to sync
        }
      }

      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleUpdateNote = async (noteId: number, data: Partial<TastingNote>) => {
    if (!sessionId) return;
    try {
      await updateNote.mutateAsync({ sessionId, noteId, data, userId });
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!sessionId) return;
    if (!confirm('Remove this feedback from the tasting session?')) return;
    try {
      await deleteNote.mutateAsync({ sessionId, noteId, userId });
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  if (sessionLoading || recipeLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Tasting session not found.
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Recipe not found.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/tastings/${sessionId}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Session
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat className="h-6 w-6 text-purple-500" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{recipe.name}</h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">{session.name}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <span>{formatDate(session.date)}</span>
            </div>
            {session.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-zinc-400" />
                <span>{session.location}</span>
              </div>
            )}
            {session.participants && session.participants.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-zinc-400" />
                <span>{session.participants.map((p) => p.username).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Allergens */}
          {allergens.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Allergens:</span>
              {allergens.map((allergen) => (
                <Badge key={allergen.id} variant="warning" className="text-xs">{allergen.name}</Badge>
              ))}
            </div>
          )}

          {/* Recipe Description */}
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {recipe.description?.trim() || 'No description'}
          </p>
        </div>

        {/* Feedback Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Feedback ({recipeNotes.length})
          </h2>
          {!showAddForm && isInvited && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Feedback
            </Button>
          )}
        </div>

        {/* Add Feedback Form */}
        {showAddForm && (
          <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
            <CardContent className="pt-4">
              <FeedbackForm
                initialData={{ taster_name: username || '' }}
                onSubmit={handleAddNote}
                onCancel={() => setShowAddForm(false)}
                submitLabel="Add Feedback"
                showImages={true}
              />
            </CardContent>
          </Card>
        )}

        {/* Feedback Notes List */}
        {recipeNotes.length === 0 && !showAddForm ? (
          <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
            <p className="text-zinc-500 dark:text-zinc-400">No feedback recorded yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              Add feedback to record tasting notes
            </p>
          </div>
        ) : (
          <div>
            {recipeNotes.map((note) => (
              <FeedbackNoteCard
                key={note.id}
                note={note}
                currentUserId={userId}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
