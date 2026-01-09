'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Calendar,
  MapPin,
  Users,
  ChefHat,
  X,
} from 'lucide-react';
import {
  useTastingSession,
  useDeleteTastingSession,
  useSessionRecipes,
  useAddRecipeToSession,
  useRemoveRecipeFromSession,
} from '@/lib/hooks/useTastings';
import { useRecipes } from '@/lib/hooks';
import {
  Button,
  Skeleton,
  Card,
  CardContent,
  Select,
} from '@/components/ui';
import type { Recipe, RecipeTasting } from '@/types';
import { useAppState } from '@/lib/store';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isSessionExpired(dateString: string): boolean {
  const sessionDate = new Date(dateString);
  const today = new Date();
  sessionDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
}

interface SessionRecipesSectionProps {
  sessionId: number;
  sessionRecipes: RecipeTasting[];
  allRecipes: Recipe[];
  isLoading: boolean;
  isExpired: boolean;
  onAddRecipe: (recipeId: number) => void;
  onRemoveRecipe: (recipeId: number) => void;
}

function SessionRecipesSection({
  sessionId,
  sessionRecipes,
  allRecipes,
  isLoading,
  isExpired,
  onAddRecipe,
  onRemoveRecipe,
}: SessionRecipesSectionProps) {
  const { userId } = useAppState();
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | ''>('');

  const linkedRecipeIds = sessionRecipes.map((sr) => sr.recipe_id);
  const availableRecipes = allRecipes.filter(
    (r) => !linkedRecipeIds.includes(r.id) && r.created_by === userId
  );

  const handleAddRecipe = () => {
    if (!selectedRecipeId) return;
    onAddRecipe(selectedRecipeId as number);
    setSelectedRecipeId('');
    setShowAddRecipe(false);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-purple-500" />
          Session Recipes
        </h2>
        <div className="flex items-center gap-2">
          {!showAddRecipe && (
            <Button
              size="sm"
              onClick={() => setShowAddRecipe(true)}
              disabled={isExpired}
              title={isExpired ? 'Cannot add recipes to past sessions' : undefined}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Recipe
            </Button>
          )}
        </div>
      </div>

      {showAddRecipe && (
        <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
          <CardContent className="pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Select Recipe
                </label>
                <Select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value ? Number(e.target.value) : '')}
                  options={[
                    { value: '', label: 'Select a recipe...' },
                    ...availableRecipes.map((r) => ({ value: String(r.id), label: r.name })),
                  ]}
                />
              </div>
              <Button onClick={handleAddRecipe} disabled={!selectedRecipeId}>
                Add
              </Button>
              <Button variant="outline" onClick={() => setShowAddRecipe(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}

      {!isLoading && sessionRecipes.length === 0 && !showAddRecipe && (
        <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
          <ChefHat className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
          <p className="text-zinc-500 dark:text-zinc-400">No recipes added to this session</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Add recipes to track what will be tasted
          </p>
        </div>
      )}

      {!isLoading && sessionRecipes.length > 0 && (
        <div className="space-y-2">
          {sessionRecipes.map((sr) => {
            const recipe = allRecipes.find((r) => r.id === sr.recipe_id);
            return (
              <div
                key={sr.id}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <Link
                  href={`/tastings/${sessionId}/r/${sr.recipe_id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400"
                >
                  {recipe?.name || `Recipe #${sr.recipe_id}`}
                </Link>
                {!isExpired && (
                  <button
                    onClick={() => onRemoveRecipe(sr.recipe_id)}
                    className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-600"
                    title="Remove from session"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TastingSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id ? Number(params.id) : null;

  const { data: session, isLoading: sessionLoading } = useTastingSession(sessionId);
  const { data: sessionRecipes, isLoading: recipesLoading } = useSessionRecipes(sessionId);
  const { data: recipes } = useRecipes();

  const deleteSession = useDeleteTastingSession();
  const addRecipeToSession = useAddRecipeToSession();
  const removeRecipeFromSession = useRemoveRecipeFromSession();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleAddRecipeToSession = async (recipeId: number) => {
    if (!sessionId) return;
    try {
      await addRecipeToSession.mutateAsync({
        sessionId,
        data: { recipe_id: recipeId },
      });
    } catch (error) {
      console.error('Failed to add recipe to session:', error);
    }
  };

  const handleRemoveRecipeFromSession = async (recipeId: number) => {
    if (!sessionId) return;
    if (!confirm('Remove this recipe from the session?')) return;
    try {
      await removeRecipeFromSession.mutateAsync({ sessionId, recipeId });
    } catch (error) {
      console.error('Failed to remove recipe from session:', error);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      await deleteSession.mutateAsync(sessionId);
      router.push('/tastings');
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  if (sessionLoading) {
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

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/tastings"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasting Sessions
          </Link>
        </div>

        {/* Session Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{session.name}</h1>
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
            {session.attendees && session.attendees.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-zinc-400" />
                <span>{session.attendees.join(', ')}</span>
              </div>
            )}
          </div>

          {session.notes && (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 italic">{session.notes}</p>
          )}
        </div>

        {/* Session Recipes Section */}
        {recipes && sessionId && (
          <SessionRecipesSection
            sessionId={sessionId}
            sessionRecipes={sessionRecipes || []}
            allRecipes={recipes}
            isLoading={recipesLoading}
            isExpired={isSessionExpired(session.date)}
            onAddRecipe={handleAddRecipeToSession}
            onRemoveRecipe={handleRemoveRecipeFromSession}
          />
        )}

        {/* Delete Session */}
        <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-700">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                Are you sure? This will delete the session and all its notes.
              </p>
              <Button variant="destructive" size="sm" onClick={handleDeleteSession}>
                Yes, Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete this session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
