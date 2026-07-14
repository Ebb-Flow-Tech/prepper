'use client';

import { useAppState } from '@/lib/store';
import { useRecipe } from '@/lib/hooks';
import { Instructions } from '@/components/recipe/Instructions';
import { Card, CardContent, Skeleton } from '@/components/ui';

export function InstructionsTab() {
  const { selectedRecipeId, userId, userType } = useAppState();

  const { data: recipe, isLoading, error } = useRecipe(selectedRecipeId);

  const canEdit =
    userType === 'admin' || (userId !== null && recipe?.owner_id === userId);

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a recipe from the left panel to view its instructions
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Instructions
            </h2>
            <Instructions recipe={recipe} canEdit={canEdit} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
