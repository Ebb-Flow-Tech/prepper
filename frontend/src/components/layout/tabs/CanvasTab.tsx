'use client';

import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { GripVertical, Info } from 'lucide-react';
import { useState } from 'react';
import { useAppState } from '@/lib/store';
import { useRecipe, useCosting, useAddRecipeIngredient, useAddSubRecipe } from '@/lib/hooks';
import { RecipeIngredientsList } from '@/components/recipe/RecipeIngredientsList';
import { SubRecipesList } from '@/components/recipe/SubRecipesList';
import { Instructions } from '@/components/recipe/Instructions';
import { Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { LeftPanel } from '../LeftPanel';
import { RightPanel } from '../RightPanel';
import type { Ingredient, Recipe } from '@/types';

type DragItem =
  | { type: 'ingredient'; ingredient: Ingredient }
  | { type: 'recipe'; recipe: Recipe };

function DragOverlayContent({ item }: { item: DragItem }) {
  if (item.type === 'ingredient') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
        <GripVertical className="h-4 w-4 text-zinc-400" />
        <div>
          <p className="font-medium">{item.ingredient.name}</p>
          <p className="text-sm text-zinc-500">{item.ingredient.base_unit}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
      <GripVertical className="h-4 w-4 text-zinc-400" />
      <div>
        <p className="font-medium">{item.recipe.name}</p>
        <p className="text-sm text-zinc-500">{item.recipe.yield_quantity} {item.recipe.yield_unit}</p>
      </div>
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

function CanvasContent({ canEdit }: { canEdit: boolean }) {
  const { selectedRecipeId } = useAppState();
  const { data: recipe } = useRecipe(selectedRecipeId);

  if (!recipe) return null;

  return (
    <main className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
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
              Drag recipes from the right panel to add them
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

export function CanvasTab() {
  const { selectedRecipeId, userId, userType } = useAppState();
  const { data: recipe } = useRecipe(selectedRecipeId);
  const addIngredient = useAddRecipeIngredient();
  const addSubRecipe = useAddSubRecipe();
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);

  const canEdit =
    userType === 'admin' || (userId !== null && recipe?.owner_id === userId);

  const handleDragStart = (event: { active: { data: { current?: { type?: string; ingredient?: Ingredient; recipe?: Recipe } } } }) => {
    const { type, ingredient, recipe: dragRecipe } = event.active.data.current || {};
    if (type === 'ingredient' && ingredient) {
      setActiveDragItem({ type: 'ingredient', ingredient });
    } else if (type === 'recipe' && dragRecipe) {
      setActiveDragItem({ type: 'recipe', recipe: dragRecipe });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const dragItem = activeDragItem;
    setActiveDragItem(null);

    const { over } = event;

    if (!over || !dragItem || !selectedRecipeId) {
      return;
    }

    // Handle ingredient drops on the ingredients drop zone
    if (over.id === 'ingredients-drop-zone' && dragItem.type === 'ingredient') {
      const ingredient = dragItem.ingredient;

      // Check for preferred supplier, otherwise use ingredient defaults
      const preferredSupplier = ingredient.suppliers?.find((s) => s.is_preferred);
      const base_unit = preferredSupplier?.pack_unit ?? ingredient.base_unit;
      const unit_price = preferredSupplier?.cost_per_unit ?? ingredient.cost_per_base_unit ?? 0;
      const supplier_id = preferredSupplier ? parseInt(preferredSupplier.supplier_id, 10) : null;

      addIngredient.mutate(
        {
          recipeId: selectedRecipeId,
          data: {
            ingredient_id: ingredient.id,
            quantity: 1,
            unit: base_unit,
            base_unit,
            unit_price,
            supplier_id,
          },
        },
        {
          onSuccess: () => toast.success(`Added ${ingredient.name}`),
          onError: () => toast.error(`Couldn't add ${ingredient.name}`),
        }
      );
    }

    // Handle recipe drops on the sub-recipes drop zone
    if (over.id === 'sub-recipes-drop-zone' && dragItem.type === 'recipe') {
      const dragRecipe = dragItem.recipe;

      // Don't allow adding a recipe as its own sub-recipe
      if (dragRecipe.id === selectedRecipeId) {
        toast.error("Can't add a recipe as its own sub-recipe");
        return;
      }

      addSubRecipe.mutate(
        {
          recipeId: selectedRecipeId,
          data: {
            child_recipe_id: dragRecipe.id,
            quantity: 1,
          },
        },
        {
          onSuccess: () => toast.success(`Added ${dragRecipe.name} as sub-recipe`),
          onError: () => toast.error(`Couldn't add ${dragRecipe.name}`),
        }
      );
    }
  };

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <LeftPanel />
      <CanvasContent canEdit={canEdit} />
      {selectedRecipeId && <RightPanel />}
      <DragOverlay>
        {activeDragItem && <DragOverlayContent item={activeDragItem} />}
      </DragOverlay>
    </DndContext>
  );
}
