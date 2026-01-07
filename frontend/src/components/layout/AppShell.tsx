'use client';

import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { GripVertical } from 'lucide-react';
import { TopAppBar } from './TopAppBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { RecipeCanvas } from './RecipeCanvas';
import { useAppState } from '@/lib/store';
import { useAddRecipeIngredient } from '@/lib/hooks';
import { toast } from 'sonner';
import type { Ingredient } from '@/types';

function DragOverlayContent({ ingredient }: { ingredient: Ingredient }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
      <GripVertical className="h-4 w-4 text-zinc-400" />
      <div>
        <p className="font-medium">{ingredient.name}</p>
        <p className="text-sm text-zinc-500">{ingredient.base_unit}</p>
      </div>
    </div>
  );
}

export function AppShell() {
  const { selectedRecipeId, selectRecipe } = useAppState();
  const searchParams = useSearchParams();
  const addIngredient = useAddRecipeIngredient();
  const [activeIngredient, setActiveIngredient] = useState<Ingredient | null>(null);

  // Sync recipe from URL query parameter on mount
  useEffect(() => {
    const recipeParam = searchParams.get('recipe');
    if (recipeParam) {
      const recipeId = parseInt(recipeParam, 10);
      if (!isNaN(recipeId) && recipeId !== selectedRecipeId) {
        selectRecipe(recipeId);
      }
    }
  }, [searchParams, selectRecipe]);

  const handleDragStart = (event: { active: { data: { current?: { ingredient?: Ingredient } } } }) => {
    const ingredient = event.active.data.current?.ingredient;
    if (ingredient) {
      setActiveIngredient(ingredient);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIngredient(null);

    const { active, over } = event;

    // Check if dropped on the recipe canvas
    if (over?.id === 'recipe-canvas' && active.data.current?.ingredient) {
      const ingredient = active.data.current.ingredient as Ingredient;

      if (!selectedRecipeId) {
        toast.error('Select or create a recipe first');
        return;
      }

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
  };

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col">
        <TopAppBar />
        <div className="flex flex-1 overflow-hidden">
          <LeftPanel />
          <RecipeCanvas />
          <RightPanel />
        </div>
      </div>
      <DragOverlay>
        {activeIngredient && <DragOverlayContent ingredient={activeIngredient} />}
      </DragOverlay>
    </DndContext>
  );
}
