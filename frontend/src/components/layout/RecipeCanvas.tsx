'use client';

import { useDroppable } from '@dnd-kit/core';
import { Plus, ChefHat } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useRecipe, useCreateRecipe, useCosting } from '@/lib/hooks';
import { RecipeIngredientsList } from '@/components/recipe/RecipeIngredientsList';
import { SubRecipesList } from '@/components/recipe/SubRecipesList';
import { Instructions } from '@/components/recipe/Instructions';
import { Button, Skeleton } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

function EmptyState() {
  const { selectRecipe, userId } = useAppState();
  const createRecipe = useCreateRecipe();

  const handleCreate = () => {
    createRecipe.mutate(
      {
        name: 'Untitled Recipe',
        yield_quantity: 10,
        yield_unit: 'portion',
        status: 'draft',
        created_by: userId || undefined,
      },
      {
        onSuccess: (newRecipe) => {
          selectRecipe(newRecipe.id);
          toast.success('Recipe created');
        },
        onError: () => toast.error('Failed to create recipe'),
      }
    );
  };

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="rounded-full bg-zinc-100 p-6 dark:bg-zinc-800">
        <ChefHat className="h-12 w-12 text-zinc-400" />
      </div>
      <h2 className="mt-6 text-xl font-semibold">No recipe selected</h2>
      <p className="mt-2 max-w-sm text-zinc-500">
        Select a recipe from the left panel or create a new one to get started.
      </p>
      <Button className="mt-6" onClick={handleCreate} disabled={createRecipe.isPending}>
        <Plus className="h-4 w-4" />
        Create your first recipe
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-6">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="mt-8 h-8 w-48" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  );
}

function CostSummary({ recipeId }: { recipeId: number }) {
  const { data: costing, isLoading, error } = useCosting(recipeId);
  const [showTooltip, setShowTooltip] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-5 w-32" />
      </div>
    );
  }

  if (error || !costing) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">Total batch cost:</span>
        <span className="font-semibold">{formatCurrency(costing.total_batch_cost)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm text-zinc-500">Cost per portion:</span>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-md bg-zinc-900 p-2 text-xs text-white shadow-lg dark:bg-zinc-700">
                Calculated from ingredient and sub-recipe costs with yield of{' '}
                {costing.yield_quantity} {costing.yield_unit}.
              </div>
            )}
          </div>
        </div>
        <span className="font-semibold">{formatCurrency(costing.cost_per_portion)}</span>
      </div>
    </div>
  );
}

export function RecipeCanvas() {
  const { selectedRecipeId, userId, userType } = useAppState();
  const { data: recipe, isLoading, error } = useRecipe(selectedRecipeId);

  // Determine if the current user can edit this recipe
  // Allowed if: user is admin OR user is the owner of the recipe
  const canEdit =
    userType === 'admin' || (userId !== null && recipe?.owner_id === userId);

  const { setNodeRef, isOver } = useDroppable({
    id: 'recipe-canvas',
    disabled: !canEdit,
  });

  if (!selectedRecipeId) {
    return (
      <main className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        <EmptyState />
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        <LoadingState />
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        <div className="flex h-full items-center justify-center">
          <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
            <p className="text-red-600 dark:text-red-400">Failed to load recipe</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={setNodeRef}
      className={cn(
        'flex-1 overflow-y-auto bg-white dark:bg-zinc-950',
        isOver && 'ring-2 ring-inset ring-blue-400'
      )}
    >
      <div className="mx-auto max-w-4xl p-6">
        {/* Ingredients Section */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Ingredients</h2>
            <p className="text-sm text-zinc-500">
              Drag ingredients from the right panel to add them
            </p>
          </div>
          <RecipeIngredientsList recipeId={recipe.id} canEdit={canEdit} />
        </section>

        {/* Sub-Recipes Section */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Sub-Recipes</h2>
            <p className="text-sm text-zinc-500">
              Add other recipes as components of this recipe
            </p>
          </div>
          <SubRecipesList recipeId={recipe.id} canEdit={canEdit} />
        </section>

        {/* Cost Summary Section */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Cost Summary</h2>
          </div>
          <CostSummary recipeId={recipe.id} />
        </section>

        {/* Instructions Section */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Instructions</h2>
          </div>
          <Instructions recipe={recipe} canEdit={canEdit} />
        </section>
      </div>
    </main>
  );
}
