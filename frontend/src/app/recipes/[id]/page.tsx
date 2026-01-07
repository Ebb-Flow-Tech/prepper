'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, Eye, ImagePlus, Clock, Thermometer, Star, CheckCircle, AlertCircle, XCircle, Wine } from 'lucide-react';
import { useRecipe, useRecipeIngredients, useCosting } from '@/lib/hooks';
import { useRecipeTastingNotes, useRecipeTastingSummary } from '@/lib/hooks/useTastings';
import { useAppState } from '@/lib/store';
import { Badge, Button, Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency, formatTimer } from '@/lib/utils';
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
          className={`h-3.5 w-3.5 ${
            star <= rating
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

export default function RecipePage({ params }: RecipePageProps) {
  const { id } = use(params);
  const recipeId = parseInt(id, 10);
  const { userId } = useAppState();

  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(recipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(recipeId);
  const { data: costing, isLoading: costingLoading } = useCosting(recipeId);
  const { data: tastingNotes, isLoading: tastingLoading } = useRecipeTastingNotes(recipeId);
  const { data: tastingSummary } = useRecipeTastingSummary(recipeId);

  const isLoading = recipeLoading || ingredientsLoading || costingLoading || tastingLoading;

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
                  {/* Placeholder for hero image */}
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <ImagePlus className="h-8 w-8" />
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
                        <Link href={`/?recipe=${recipe.id}`}>
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

            {/* Costing & Ingredients Grid */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
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
    </div>
  );
}
