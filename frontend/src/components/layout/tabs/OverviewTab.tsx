'use client';

import Link from 'next/link';
import { ImagePlus, Clock, Thermometer, Star, CheckCircle, AlertCircle, XCircle, Wine, Wand2, Edit2, Check, X, ChevronDown } from 'lucide-react';
import { useRecipe, useRecipeIngredients, useCosting, useSubRecipes, useRecipes, useUpdateRecipe, useMainRecipeImage } from '@/lib/hooks';
import { useRecipeTastingNotes, useRecipeTastingSummary } from '@/lib/hooks/useTastings';
import { useSummarizeFeedback } from '@/lib/hooks/useAgents';
import { useAppState } from '@/lib/store';
import { Badge, Card, CardContent, Skeleton, Button, Modal } from '@/components/ui';
import { formatCurrency, formatTimer } from '@/lib/utils';
import { RecipeImageCarousel } from '@/components/recipe/RecipeImageCarousel';
import { useState, useEffect } from 'react';
import type { RecipeStatus, TastingDecision } from '@/types';

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

export function OverviewTab() {
  const { selectedRecipeId, userId } = useAppState();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isFeedbacksOpen, setIsFeedbacksOpen] = useState(false);

  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(selectedRecipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(selectedRecipeId);
  const { data: costing, isLoading: costingLoading } = useCosting(selectedRecipeId);
  const { data: subRecipes, isLoading: subRecipesLoading } = useSubRecipes(selectedRecipeId);
  const { data: allRecipes } = useRecipes();
  const { data: tastingNotes, isLoading: tastingLoading } = useRecipeTastingNotes(selectedRecipeId);
  const { data: tastingSummary } = useRecipeTastingSummary(selectedRecipeId);
  const { data: mainImage } = useMainRecipeImage(selectedRecipeId);
  const { mutate: updateRecipe, isPending: isUpdating } = useUpdateRecipe();
  const { mutate: summarizeFeedback, data: feedbackSummary, isPending: isSummarizingFeedback, error: feedbackSummaryError } = useSummarizeFeedback();

  const isLoading = recipeLoading || ingredientsLoading || costingLoading || subRecipesLoading || tastingLoading;

  // Save feedback summary to recipe when it's generated
  useEffect(() => {
    if (feedbackSummary?.summary && feedbackSummary.success && selectedRecipeId) {
      updateRecipe(
        { id: selectedRecipeId, data: { summary_feedback: feedbackSummary.summary } },
        {
          onError: (error) => {
            console.error('Failed to save feedback summary to recipe:', error);
          },
        }
      );
    }
  }, [feedbackSummary?.summary, feedbackSummary?.success, selectedRecipeId, updateRecipe]);

  const canEditRecipe = userId !== null && recipe?.owner_id === userId;

  // Initialize description value when recipe loads
  useEffect(() => {
    if (recipe) {
      setDescriptionValue(recipe.description || '');
    }
  }, [recipe?.id]);

  // Trigger feedback summary when user enters a recipe with tasting notes
  useEffect(() => {
    // Only trigger if: recipe has tasting notes AND not currently summarizing
    if (
      selectedRecipeId &&
      tastingNotes &&
      tastingNotes.length > 0 &&
      !isSummarizingFeedback
    ) {
      summarizeFeedback(selectedRecipeId);
    }
    // Only re-trigger when recipe changes, not on other rerenders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecipeId]);

  const handleSaveDescription = () => {
    if (selectedRecipeId && descriptionValue !== recipe?.description) {
      updateRecipe(
        { id: selectedRecipeId, data: { description: descriptionValue } },
        {
          onSuccess: () => {
            setIsEditingDescription(false);
          },
        }
      );
    } else {
      setIsEditingDescription(false);
    }
  };

  // Create a map of recipe IDs to names for sub-recipe display
  const recipeMap = new Map<number, string>();
  allRecipes?.forEach((r) => recipeMap.set(r.id, r.name));

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            Select a recipe from the left panel to view its overview
          </p>
        </div>
      </div>
    );
  }

  if (recipeError) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
      <div className="p-6 max-w-5xl mx-auto">
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
                  {/* Recipe hero image with edit button */}
                  <div className="relative shrink-0 group">
                    {mainImage?.image_url ? (
                      <img
                        src={mainImage.image_url}
                        alt={recipe.name}
                        className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                        <ImagePlus className="h-8 w-8" />
                      </div>
                    )}
                    {canEditRecipe && (
                      <button
                        onClick={() => setIsImageModalOpen(true)}
                        className="absolute bottom-1 right-1 rounded-full h-8 w-8 bg-[hsl(var(--primary))] hover:opacity-90 text-black flex items-center justify-center transition-colors shadow-lg"
                        title="Edit recipe image"
                      >
                        <Wand2 className="h-4 w-4" />
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
                        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                          Based on: {recipe.root_id
                            ? (allRecipes?.find((r) => r.id === recipe.root_id)?.name || `Recipe #${recipe.root_id}`)
                            : 'N/A'}
                        </p>
                        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
                          Version: {recipe.version}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">v{recipe.version}</Badge>
                        {userId !== null && recipe.owner_id === userId && (
                          <Badge className="bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
                        )}
                        <Badge variant={STATUS_VARIANTS[recipe.status]}>
                          {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <div>
                        Created: {new Date(recipe.created_at).toLocaleDateString()}
                        {recipe.updated_at !== recipe.created_at && (
                          <span className="ml-4">
                            Updated: {new Date(recipe.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {recipe.created_by && (
                        <div>
                          Created by: <span className="font-medium text-zinc-600 dark:text-zinc-300">{recipe.created_by}</span>
                        </div>
                      )}
                      {recipe.owner_id && (
                        <div>
                          Owner ID: <span className="font-medium text-zinc-600 dark:text-zinc-300">{recipe.owner_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description Section */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                      Description
                    </h2>
                    {isEditingDescription ? (
                      <div className="space-y-3">
                        <textarea
                          value={descriptionValue}
                          onChange={(e) => setDescriptionValue(e.target.value)}
                          className="w-full p-3 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                          placeholder="Enter recipe description..."
                          rows={4}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveDescription}
                            disabled={isUpdating}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--status-approved))] hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium transition-colors disabled:pointer-events-none"
                          >
                            <Check className="h-4 w-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingDescription(false);
                              setDescriptionValue(recipe?.description || '');
                            }}
                            disabled={isUpdating}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] disabled:opacity-50 text-[hsl(var(--foreground))] text-sm font-medium transition-colors disabled:pointer-events-none"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {recipe?.description ? (
                          <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                            {recipe.description}
                          </p>
                        ) : (
                          <p className="text-zinc-400 dark:text-zinc-500 italic">
                            No description added yet
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {canEditRecipe && !isEditingDescription && (
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--primary))] hover:opacity-90 text-black text-sm font-medium transition-colors mt-1 shrink-0"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                  )}
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

            {/* Tasting History - Summary Card */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Tasting History
                  </h2>
                </div>

                {tastingSummary && tastingSummary.total_tastings > 0 && tastingNotes && tastingNotes.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary Section - AI Generated */}
                    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Feedback Summary</p>
                      <br></br>
                      {isSummarizingFeedback ? (
                        <div className="space-y-2">
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-5/6" />
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-4/6" />
                        </div>
                      ) : feedbackSummaryError ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 italic">
                          Unable to generate summary. Please try again.
                        </p>
                      ) : recipe?.summary_feedback ? (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {recipe.summary_feedback}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">
                          No summary generated yet.
                        </p>
                      )}
                    </div>

                    {/* Feedbacks Section - Collapsible */}
                    <div>
                      <button
                        onClick={() => setIsFeedbacksOpen(!isFeedbacksOpen)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Feedbacks ({tastingNotes?.length || 0})
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-zinc-500 transition-transform ${isFeedbacksOpen ? 'rotate-180' : ''
                            }`}
                        />
                      </button>

                      {isFeedbacksOpen && (
                        <div className="mt-3 space-y-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
                          {tastingNotes?.map((note) => {
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
                                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                                      &ldquo;{note.feedback}&rdquo;
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
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

        {/* Image Carousel Modal */}
        <Modal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          title="Recipe Images"
          maxWidth="max-w-2xl"
        >
          {recipe && (
            <RecipeImageCarousel
              recipeId={recipe.id}
              recipeName={recipe.name}
              ingredients={ingredients?.map(i => i.ingredient?.name).filter(Boolean) as string[] | undefined}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}
