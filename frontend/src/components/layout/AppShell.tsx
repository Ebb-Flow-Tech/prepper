'use client';

import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useState } from 'react';
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
  const { selectedRecipeId } = useAppState();
  const addIngredient = useAddRecipeIngredient();
  const [activeIngredient, setActiveIngredient] = useState<Ingredient | null>(null);

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

      addIngredient.mutate(
        {
          recipeId: selectedRecipeId,
          data: {
            ingredient_id: ingredient.id,
            quantity: 1,
            unit: ingredient.base_unit,
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
