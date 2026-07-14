'use client';

import { useAppState } from '@/lib/store';
import { useRecipe, useRecipeIngredients, useSubRecipes, useRecipes } from '@/lib/hooks';
import { Card, CardContent, Skeleton } from '@/components/ui';

export function IngredientsTab() {
  const { selectedRecipeId } = useAppState();

  const { data: recipe, isLoading: recipeLoading } = useRecipe(selectedRecipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(selectedRecipeId);
  const { data: subRecipes, isLoading: subRecipesLoading } = useSubRecipes(selectedRecipeId);
  const { data: allRecipesData } = useRecipes({ page_size: 30 });
  const allRecipes = allRecipesData?.items;

  const isLoading = recipeLoading || ingredientsLoading || subRecipesLoading;

  // Create a map of recipe IDs to names for sub-recipe display
  const recipeMap = new Map<number, string>();
  allRecipes?.forEach((r) => recipeMap.set(r.id, r.name));

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a recipe from the left panel to view its ingredients
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!recipe) {
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

  const sortedSubRecipes = [...(subRecipes || [])].sort((a, b) => a.position - b.position);

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Base Ingredients Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Base Ingredients
            </h2>

            {ingredients && ingredients.length > 0 ? (
              <ul className="space-y-2">
                {ingredients.map((ri) => (
                  <li
                    key={ri.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {ri.ingredient?.name || `Ingredient #${ri.ingredient_id}`}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {ri.quantity} {ri.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No base ingredients yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add ingredients in the Canvas tab
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items (Sub-Recipes) Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Items
            </h2>

            {sortedSubRecipes.length > 0 ? (
              <ul className="space-y-2">
                {sortedSubRecipes.map((sr) => (
                  <li
                    key={sr.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {recipeMap.get(sr.child_recipe_id) || `Recipe #${sr.child_recipe_id}`}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {sr.quantity} {sr.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No items yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add sub-recipes in the Canvas tab
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
