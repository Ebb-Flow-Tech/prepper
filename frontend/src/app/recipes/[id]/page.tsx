'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, Eye, ImagePlus, Clock, Thermometer, Star, CheckCircle, AlertCircle, XCircle, Wine, Pencil, X, Loader2 } from 'lucide-react';
import { useRecipe, useRecipeIngredients, useCosting, useSubRecipes, useRecipes, useGenerateRecipeImage } from '@/lib/hooks';
import { useRecipeTastingNotes, useRecipeTastingSummary } from '@/lib/hooks/useTastings';
import { useAppState } from '@/lib/store';
import { Badge, Button, Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency, formatTimer, cn } from '@/lib/utils';
import type { RecipeStatus, TastingDecision } from '@/types';

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

const DECISION_CONFIG: Record<TastingDecision, { label: string; icon: typeof CheckCircle; variant: 'success' | 'warning' | 'destructive' }> = {
  approved: { label: 'Approved', icon: CheckCircle, variant: 'success' },
  needs_work: { label: 'Needs Work', icon: AlertCircle, variant: 'warning' },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' },
};

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-zinc-400">-</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'text-zinc-300 dark:text-zinc-600'
            }`}
        />
      ))}
    </div>
  );
}

function formatTastingDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: number;
  recipeName: string;
  ingredientNames: string[];
  currentImageUrl?: string | null;
}

function ImageEditModal({ isOpen, onClose, recipeId, recipeName, ingredientNames, currentImageUrl }: ImageEditModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateImage = useGenerateRecipeImage();

  const handleGenerateImage = () => {
    setError(null);
    generateImage.mutate(
      { recipeId, recipeName, ingredients: ingredientNames },
      {
        onSuccess: (data) => {
          setGeneratedImageUrl(data.image_url);
          // Close modal after successful storage
          if (data.stored) {
            onClose();
          }
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to generate image');
        },
      }
    );
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal opens, using current image if available
  useEffect(() => {
    if (isOpen) {
      setGeneratedImageUrl(currentImageUrl || null);
      setError(null);
    }
  }, [isOpen, currentImageUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl',
          'dark:bg-zinc-900 dark:border dark:border-zinc-800',
          'focus:outline-none'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2
            id="image-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Recipe Image
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Image Display */}
        <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-amber-100 via-orange-100 to-red-100 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-red-900/30 flex items-center justify-center overflow-hidden">
          {generateImage.isPending ? (
            <div className="text-center">
              <Loader2 className="h-16 w-16 mx-auto text-orange-400 dark:text-orange-600 mb-2 animate-spin" />
              <p className="text-sm text-orange-400 dark:text-orange-600">Generating image...</p>
            </div>
          ) : generatedImageUrl ? (
            <img
              src={generatedImageUrl}
              alt={`Generated image for ${recipeName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <ImagePlus className="h-16 w-16 mx-auto text-orange-300 dark:text-orange-700 mb-2" />
              <p className="text-sm text-orange-400 dark:text-orange-600">Click generate to create an image</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={handleGenerateImage}
            disabled={generateImage.isPending}
          >
            {generateImage.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : generatedImageUrl ? (
              'Regenerate Image'
            ) : (
              'Generate Image'
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RecipePage({ params }: RecipePageProps) {
  const { id } = use(params);
  const recipeId = parseInt(id, 10);
  const { userId, userType } = useAppState();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Check if user can edit the recipe (owner or admin)
  const canEdit = (recipe: { owner_id: string | null }) =>
    userType === 'admin' || (userId !== null && recipe.owner_id === userId);

  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(recipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(recipeId);
  const { data: costing, isLoading: costingLoading } = useCosting(recipeId);
  const { data: subRecipes, isLoading: subRecipesLoading } = useSubRecipes(recipeId);
  const { data: allRecipes } = useRecipes();
  const { data: tastingNotes, isLoading: tastingLoading } = useRecipeTastingNotes(recipeId);
  const { data: tastingSummary } = useRecipeTastingSummary(recipeId);

  const isLoading = recipeLoading || ingredientsLoading || costingLoading || subRecipesLoading || tastingLoading;

  // Create a map of recipe IDs to names for sub-recipe display
  const recipeMap = new Map<number, string>();
  allRecipes?.forEach((r) => recipeMap.set(r.id, r.name));

  if (recipeError) {
    return (
      <div className="p-6">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Recipes
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Recipe not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Recipes
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-lg" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : recipe ? (
          <>
            {/* Recipe Header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Recipe hero image */}
                  <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0">
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.name}
                        className="w-full h-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                        <ImagePlus className="h-8 w-8" />
                      </div>
                    )}
                    {canEdit(recipe) && (
                      <button
                        onClick={() => setIsImageModalOpen(true)}
                        className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-md transition-colors"
                        aria-label="Edit recipe image"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {recipe.name}
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                          Yield: {recipe.yield_quantity} {recipe.yield_unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {userId !== null && recipe.owner_id === userId && (
                          <Badge className="bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
                        )}
                        <Badge variant={STATUS_VARIANTS[recipe.status]}>
                          {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
                        </Badge>
                        <Link href={`/canvas?recipe=${recipe.id}`}>
                          <Button variant="outline" size="sm">
                            {userId !== null && recipe.owner_id === userId ? (
                              <Edit2 className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            {userId !== null && recipe.owner_id === userId ? 'Edit in Canvas' : 'View in Canvas'}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                      Created: {new Date(recipe.created_at).toLocaleDateString()}
                      {recipe.updated_at !== recipe.created_at && (
                        <span className="ml-4">
                          Updated: {new Date(recipe.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ingredients | Sub Recipes | Costing Grid */}
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              {/* Ingredients Card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Ingredients
                  </h2>

                  {ingredients && ingredients.length > 0 ? (
                    <ul className="space-y-2">
                      {ingredients.map((ri) => (
                        <li
                          key={ri.id}
                          className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                          <div>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {ri.ingredient?.name || `Ingredient #${ri.ingredient_id}`}
                            </span>
                          </div>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {ri.quantity} {ri.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No ingredients added yet
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Sub Recipes Card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Sub Recipes
                  </h2>

                  {subRecipes && subRecipes.length > 0 ? (
                    <ul className="space-y-2">
                      {[...subRecipes]
                        .sort((a, b) => a.position - b.position)
                        .map((sr) => (
                          <li
                            key={sr.id}
                            className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                          >
                            <div>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {recipeMap.get(sr.child_recipe_id) || `Recipe #${sr.child_recipe_id}`}
                              </span>
                            </div>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {sr.quantity} {sr.unit}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No sub-recipes added yet
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Costing Card */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Costing
                  </h2>

                  {costing ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-zinc-500 dark:text-zinc-400">Batch Cost</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(costing.total_batch_cost)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-zinc-500 dark:text-zinc-400">Cost per Portion</span>
                        <span className="font-semibold text-xl text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(costing.cost_per_portion)}
                        </span>
                      </div>

                      {recipe.selling_price_est && costing.cost_per_portion && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-500 dark:text-zinc-400">Margin</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {((1 - costing.cost_per_portion / recipe.selling_price_est) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No costing data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Instructions Card */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  Instructions
                </h2>

                {recipe.instructions_structured?.steps && recipe.instructions_structured.steps.length > 0 ? (
                  <ol className="space-y-4">
                    {recipe.instructions_structured.steps.map((step, index) => (
                      <li key={index} className="flex gap-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {step.order || index + 1}
                        </span>
                        <div className="flex-1 pt-0.5">
                          <p className="text-zinc-700 dark:text-zinc-300">{step.text}</p>
                          <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                            {step.timer_seconds && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTimer(step.timer_seconds)}
                              </span>
                            )}
                            {step.temperature_c && (
                              <span className="flex items-center gap-1">
                                <Thermometer className="h-4 w-4" />
                                {step.temperature_c}°C
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : recipe.instructions_raw ? (
                  <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      {recipe.instructions_raw}
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-400 dark:text-zinc-500">
                    No instructions added yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tasting History Card */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Tasting History
                    </h2>
                  </div>
                  {tastingSummary && tastingSummary.total_tastings > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-500">
                        {tastingSummary.total_tastings} tasting{tastingSummary.total_tastings !== 1 ? 's' : ''}
                      </span>
                      {tastingSummary.average_overall_rating && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-medium">{tastingSummary.average_overall_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {tastingNotes && tastingNotes.length > 0 ? (
                  <div className="space-y-3">
                    {tastingNotes.slice(0, 5).map((note) => {
                      const config = note.decision ? DECISION_CONFIG[note.decision] : null;
                      const Icon = config?.icon;
                      return (
                        <div
                          key={note.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={`/tastings/${note.session_id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400"
                              >
                                {note.session_name}
                              </Link>
                              {config && (
                                <Badge variant={config.variant} className="text-xs">
                                  {Icon && <Icon className="h-3 w-3 mr-1" />}
                                  {config.label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                              {note.session_date && (
                                <span>{formatTastingDate(note.session_date)}</span>
                              )}
                              {note.overall_rating && (
                                <StarRating rating={note.overall_rating} />
                              )}
                            </div>
                            {note.feedback && (
                              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">
                                &ldquo;{note.feedback}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {tastingNotes.length > 5 && (
                      <Link
                        href="/tastings"
                        className="block text-center text-sm text-purple-600 dark:text-purple-400 hover:underline pt-2"
                      >
                        View all {tastingNotes.length} tastings
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Wine className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No tastings recorded yet
                    </p>
                    <Link href="/tastings/new" className="mt-2 inline-block">
                      <Button variant="outline" size="sm">
                        Create Tasting Session
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Image Edit Modal */}
      <ImageEditModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        recipeId={recipe?.id || 0}
        recipeName={recipe?.name || ''}
        ingredientNames={ingredients?.map((ri) => ri.ingredient?.name || '').filter(Boolean) || []}
        currentImageUrl={recipe?.image_url}
      />
    </div>
  );
}
