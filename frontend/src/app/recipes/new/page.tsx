'use client';

import { useEffect } from 'react';
import { useAppState } from '@/lib/store';
import { CanvasLayout } from '@/components/layout';

export default function NewRecipePage() {
  const { selectedRecipeId, selectRecipe, setCanvasTab } = useAppState();

  // Ensure no recipe is selected and canvas tab is active when creating a new one
  useEffect(() => {
    setCanvasTab('canvas');
    if (selectedRecipeId !== null) {
      selectRecipe(null);
    }
  }, [selectedRecipeId, selectRecipe, setCanvasTab]);

  return <CanvasLayout showBackLink={true} showTabs={true} />;
}
