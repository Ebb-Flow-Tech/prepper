'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, ImagePlus, Clock, Thermometer } from 'lucide-react';
import { useRecipe, useRecipeIngredients, useCosting } from '@/lib/hooks';
import { Badge, Button, Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency, formatTimer } from '@/lib/utils';
import type { RecipeStatus } from '@/types';

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

export default function RecipePage({ params }: RecipePageProps) {
  const { id } = use(params);
  const recipeId = parseInt(id, 10);

  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(recipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(recipeId);
  const { data: costing, isLoading: costingLoading } = useCosting(recipeId);

  const isLoading = recipeLoading || ingredientsLoading || costingLoading;

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
                        <Badge variant={STATUS_VARIANTS[recipe.status]}>
                          {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
                        </Badge>
                        <Link href={`/?recipe=${recipe.id}`}>
                          <Button variant="outline" size="sm">
                            <Edit2 className="h-4 w-4" />
                            Edit in Canvas
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
          </>
        ) : null}
      </div>
    </div>
  );
}
