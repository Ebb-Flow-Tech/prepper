'use client';

import { use, useEffect } from 'react';
import { useAppState } from '@/lib/store';
import { CanvasLayout } from '@/components/layout';

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export default function RecipePage({ params }: RecipePageProps) {
  const { id } = use(params);
  const recipeId = parseInt(id, 10);
  const { selectedRecipeId, selectRecipe } = useAppState();

  // Sync selected recipe on mount
  useEffect(() => {
    if (recipeId !== selectedRecipeId) {
      selectRecipe(recipeId);
    }
  }, [recipeId, selectedRecipeId, selectRecipe]);

  return <CanvasLayout showBackLink={true} />;
}
