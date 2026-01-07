'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { TopAppBar } from './TopAppBar';
import {
  CanvasTab,
  OverviewTab,
  IngredientsTab,
  CostsTab,
  InstructionsTab,
  TastingTab,
  VersionsTab,
} from './tabs';
import { useAppState } from '@/lib/store';

function TabContent() {
  const { canvasTab } = useAppState();

  switch (canvasTab) {
    case 'canvas':
      return <CanvasTab />;
    case 'overview':
      return <OverviewTab />;
    case 'ingredients':
      return <IngredientsTab />;
    case 'costs':
      return <CostsTab />;
    case 'instructions':
      return <InstructionsTab />;
    case 'tasting':
      return <TastingTab />;
    case 'versions':
      return <VersionsTab />;
    default:
      return <CanvasTab />;
  }
}

export function AppShell() {
  const { selectedRecipeId, selectRecipe } = useAppState();
  const searchParams = useSearchParams();

  // Sync recipe from URL query parameter on mount
  useEffect(() => {
    const recipeParam = searchParams.get('recipe');
    if (recipeParam) {
      const recipeId = parseInt(recipeParam, 10);
      if (!isNaN(recipeId) && recipeId !== selectedRecipeId) {
        selectRecipe(recipeId);
      }
    }
  }, [searchParams, selectRecipe, selectedRecipeId]);

  return (
    <div className="flex h-full flex-col">
      <TopAppBar />
      <div className="flex flex-1 overflow-hidden">
        <TabContent />
      </div>
    </div>
  );
}
