'use client';

import { useState } from 'react';
import {
  ChefHat,
  Calendar,
  MapPin,
  Users,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { useAppState } from '@/lib/store';
import {
  useSessionNotes,
  useAddNoteToSession,
  useUpdateTastingNote,
  useDeleteTastingNote,
  useSyncTastingNoteImages,
} from '@/lib/hooks/useTastings';
import { useRecipeForTasting, useRecipeAllergens, useRecipeIngredients } from '@/lib/hooks';
import { type ImageWithId } from '@/components/tasting/ImageUploadPreview';
import {
  FeedbackNoteCard,
  type FeedbackFormData,
} from '@/components/tasting/FeedbackShared';
import { AddFeedbackModal } from '@/components/tasting/AddFeedbackModal';
import {
  Button,
  Modal,
  Badge,
  Skeleton,
} from '@/components/ui';
import type { TastingSession, RecipeTastingIngredient } from '@/types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface RecipeFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  recipeId: number;
  session: TastingSession;
  ingredients?: RecipeTastingIngredient[];
}

export function RecipeFeedbackModal({
  isOpen,
  onClose,
  sessionId,
  recipeId,
  session,
  ingredients = [],
}: RecipeFeedbackModalProps) {
  const { userId, username } = useAppState();

  const { data: recipe, isLoading: recipeLoading } = useRecipeForTasting(isOpen ? recipeId : null);
  const { data: allergens = [] } = useRecipeAllergens(isOpen ? recipeId : null);
  const { data: allNotes } = useSessionNotes(isOpen ? sessionId : null);

  const addNote = useAddNoteToSession();
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();
  const syncImages = useSyncTastingNoteImages();

  const recipeNotes = allNotes?.filter((n) => n.recipe_id === recipeId) || [];

  const isInvited = userId && session?.participants?.some((p) => p.user_id === userId) === true;

  const [showAddForm, setShowAddForm] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

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

      if (imagesWithId.length > 0 && result?.id) {
        try {
          await syncImages.mutateAsync({
            tastingNoteId: result.id,
            images: imagesWithId,
          });
        } catch (imageError) {
          console.error('Failed to sync images:', imageError);
        }
      }

      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleUpdateNote = async (noteId: number, data: Partial<import('@/types').TastingNote>) => {
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

  // When AddFeedbackModal is open, Escape/backdrop should only close that modal
  const handleOuterClose = () => {
    if (showAddForm) {
      setShowAddForm(false);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleOuterClose}
        title=""
        maxWidth="max-w-2xl"
        maxHeight="max-h-[85vh]"
      >
        {recipeLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !recipe ? (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Recipe not found.
          </div>
        ) : (
          <div>
            {/* Recipe header */}
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <ChefHat className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{recipe.name}</h2>
              </div>

              {/* Session meta row */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(session.date)}</span>
                </div>
                {session.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{session.location}</span>
                  </div>
                )}
                {session.participants && session.participants.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{session.participants.map((p) => p.username).join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Allergens */}
              {allergens.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Allergens:</span>
                  {allergens.map((allergen) => (
                    <Badge key={allergen.id} variant="warning" className="text-xs">{allergen.name}</Badge>
                  ))}
                </div>
              )}

              {/* Description */}
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {recipe.description?.trim() || <span className="italic">No Description</span>}
              </p>

              {/* Collapsible Ingredients */}
              {ingredients.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowIngredients(!showIngredients)}
                    className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showIngredients ? 'rotate-0' : '-rotate-90'}`} />
                    Ingredients ({ingredients.length})
                  </button>
                  {showIngredients && (
                    <ul className="mt-2 space-y-1 pl-6">
                      {ingredients.map((ing) => (
                        <li key={ing.id} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
                          {ing.name}
                          {ing.base_unit && (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">({ing.base_unit})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 mb-5" />

            {/* Feedback section */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Feedback ({recipeNotes.length})
              </h3>
              {isInvited && (
                <Button
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Feedback
                </Button>
              )}
            </div>

            {/* Feedback notes list */}
            {recipeNotes.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">No feedback recorded yet</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
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
        )}
      </Modal>

      {/* Stacked Add Feedback Modal */}
      {recipe && (
        <AddFeedbackModal
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          recipeName={recipe.name}
          initialData={{ taster_name: username || '' }}
          onSubmit={handleAddNote}
        />
      )}
    </>
  );
}
