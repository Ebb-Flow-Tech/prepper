'use client';

import { useCallback } from 'react';
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
import {
  useRecipeIngredients,
  useUpdateRecipeIngredient,
  useRemoveRecipeIngredient,
  useReorderRecipeIngredients,
} from '@/lib/hooks';
import { RecipeIngredientRow } from './RecipeIngredientRow';
import { Skeleton } from '@/components/ui';
import { toast } from 'sonner';

interface RecipeIngredientsListProps {
  recipeId: number;
  canEdit: boolean;
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
    </div>
  );
}
