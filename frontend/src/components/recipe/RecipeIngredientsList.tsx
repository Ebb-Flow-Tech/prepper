'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Info } from 'lucide-react';
import {
  useRecipeIngredients,
  useUpdateRecipeIngredient,
  useRemoveRecipeIngredient,
  useReorderRecipeIngredients,
  useCosting,
} from '@/lib/hooks';
import { RecipeIngredientRow } from './RecipeIngredientRow';
import { Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface RecipeIngredientsListProps {
  recipeId: number;
  canEdit: boolean;
}

function CostSummary({ recipeId }: { recipeId: number }) {
  const { data: costing, isLoading, error } = useCosting(recipeId);
  const [showTooltip, setShowTooltip] = useState(false);

  if (isLoading) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-5 w-32" />
      </div>
    );
  }

  if (error || !costing) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
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
                Calculated from ingredient base costs and current yield of{' '}
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

export function RecipeIngredientsList({ recipeId, canEdit }: RecipeIngredientsListProps) {
  const { data: ingredients, isLoading, error } = useRecipeIngredients(recipeId);
  const updateIngredient = useUpdateRecipeIngredient();
  const removeIngredient = useRemoveRecipeIngredient();
  const reorderIngredients = useReorderRecipeIngredients();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleQuantityChange = useCallback(
    (ingredientId: number, quantity: number) => {
      updateIngredient.mutate(
        { recipeId, ingredientId, data: { quantity } },
        { onError: () => toast.error('Failed to update quantity') }
      );
    },
    [recipeId, updateIngredient]
  );

  const handleUnitChange = useCallback(
    (ingredientId: number, unit: string) => {
      updateIngredient.mutate(
        { recipeId, ingredientId, data: { unit } },
        { onError: () => toast.error('Failed to update unit') }
      );
    },
    [recipeId, updateIngredient]
  );

  const handleUnitPriceChange = useCallback(
    (ingredientId: number, unitPrice: number, baseUnit: string) => {
      updateIngredient.mutate(
        { recipeId, ingredientId, data: { unit_price: unitPrice, base_unit: baseUnit } },
        { onError: () => toast.error('Failed to update unit price') }
      );
    },
    [recipeId, updateIngredient]
  );

  const handleSupplierChange = useCallback(
    (ingredientId: number, supplierId: number | null, unitPrice: number, baseUnit: string) => {
      updateIngredient.mutate(
        {
          recipeId,
          ingredientId,
          data: { supplier_id: supplierId, unit_price: unitPrice, base_unit: baseUnit },
        },
        { onError: () => toast.error('Failed to update supplier') }
      );
    },
    [recipeId, updateIngredient]
  );

  const handleRemove = useCallback(
    (ingredientId: number) => {
      removeIngredient.mutate(
        { recipeId, ingredientId },
        {
          onSuccess: () => toast.success('Ingredient removed'),
          onError: () => toast.error('Failed to remove ingredient'),
        }
      );
    },
    [recipeId, removeIngredient]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !ingredients) return;

      const oldIndex = ingredients.findIndex((i) => i.id === active.id);
      const newIndex = ingredients.findIndex((i) => i.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(ingredients, oldIndex, newIndex);
        const orderedIds = newOrder.map((i) => i.id);

        reorderIngredients.mutate(
          { recipeId, data: { ordered_ids: orderedIds } },
          { onError: () => toast.error('Failed to reorder ingredients') }
        );
      }
    },
    [ingredients, recipeId, reorderIngredients]
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
        Failed to load ingredients
      </div>
    );
  }

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
        <p className="text-zinc-500">No ingredients yet</p>
        <p className="mt-1 text-sm text-zinc-400">
          Drag ingredients from the right panel to add them
        </p>
      </div>
    );
  }

  const sortedIngredients = [...ingredients].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedIngredients.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedIngredients.map((ingredient) => (
              <RecipeIngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                canEdit={canEdit}
                onQuantityChange={(qty) => handleQuantityChange(ingredient.id, qty)}
                onUnitChange={(unit) => handleUnitChange(ingredient.id, unit)}
                onUnitPriceChange={(unitPrice, baseUnit) =>
                  handleUnitPriceChange(ingredient.id, unitPrice, baseUnit)
                }
                onSupplierChange={(supplierId, unitPrice, baseUnit) =>
                  handleSupplierChange(ingredient.id, supplierId, unitPrice, baseUnit)
                }
                onRemove={() => handleRemove(ingredient.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <CostSummary recipeId={recipeId} />
    </div>
  );
}
