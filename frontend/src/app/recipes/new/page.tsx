'use client';

import { useEffect } from 'react';
import { useAppState } from '@/lib/store';
import { CanvasLayout } from '@/components/layout';

export default function NewRecipePage() {
  const { selectedRecipeId, selectRecipe } = useAppState();

  // Ensure no recipe is selected when creating a new one
  useEffect(() => {
    if (selectedRecipeId !== null) {
      selectRecipe(null);
    }
  }, [selectedRecipeId, selectRecipe]);

  return <CanvasLayout showBackLink={true} />;
}
