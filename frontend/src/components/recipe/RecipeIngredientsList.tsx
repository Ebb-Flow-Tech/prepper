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
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useRecipeIngredients,
  useUpdateRecipeIngredient,
  useRemoveRecipeIngredient,
} from '@/lib/hooks';
import { RecipeIngredientRow } from './RecipeIngredientRow';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { convertUnitPrice } from '@/lib/unitConversion';

interface RecipeIngredientsListProps {
  recipeId: number;
  canEdit: boolean;
}

export function RecipeIngredientsList({ recipeId, canEdit }: RecipeIngredientsListProps) {
  const { data: ingredients, isLoading, error } = useRecipeIngredients(recipeId);
  const updateIngredient = useUpdateRecipeIngredient();
  const removeIngredient = useRemoveRecipeIngredient();
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
    (ingredientId: number, newUnit: string, oldUnit: string, currentUnitPrice: number | null, currentBaseUnit: string | null) => {
      const data: Record<string, unknown> = { unit: newUnit };

      // Recalculate unit price when unit changes
      if (currentUnitPrice != null) {
        const fromUnit = currentBaseUnit || oldUnit;
        const converted = convertUnitPrice(currentUnitPrice, fromUnit, newUnit);
        if (converted != null) {
          data.unit_price = parseFloat(converted.toPrecision(6));
          data.base_unit = newUnit;
        }
      }

      updateIngredient.mutate(
        { recipeId, ingredientId, data },
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
      // Drag-and-drop reordering is visual only (no backend sort_order)
    },
    [ingredients]
  );

  const { setNodeRef, isOver } = useDroppable({
    id: 'ingredients-drop-zone',
    disabled: !canEdit,
  });

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
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700',
          isOver && 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        <p className="text-zinc-500">No ingredients yet</p>
        <p className="mt-1 text-sm text-zinc-400">
          Drag ingredients from the right panel to add them
        </p>
      </div>
    );
  }

  const sortedIngredients = [...ingredients].sort(
    (a, b) => a.id - b.id
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg',
        isOver && 'ring-2 ring-blue-400 ring-offset-2'
      )}
    >
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
                onUnitChange={(unit) => handleUnitChange(ingredient.id, unit, ingredient.unit, ingredient.unit_price, ingredient.base_unit)}
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
