'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, FlaskConical, Beaker, ClipboardList, ArrowRight } from 'lucide-react';
import { useRecipes, useIngredients } from '@/lib/hooks';
import { RecipeCard } from '@/components/recipes';
import { PageHeader, SearchInput, Card, CardContent, Button, Skeleton, Badge } from '@/components/ui';
import { useAppState } from '@/lib/store';

export default function RndPage() {
  const { userId } = useAppState()
  const { data: recipes, isLoading: recipesLoading } = useRecipes();
  const { data: ingredients, isLoading: ingredientsLoading } = useIngredients();

  const [ingredientSearch, setIngredientSearch] = useState('');

  // Filter draft recipes as "experiments" (recipes not yet finalized)
  const experimentalRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter((r) => r.status === 'draft' && (r.created_by == userId));
  }, [recipes]);

  // Filter ingredients by search
  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];
    if (!ingredientSearch) return ingredients.slice(0, 12);
    return ingredients
      .filter((ing) =>
        ing.name.toLowerCase().includes(ingredientSearch.toLowerCase())
      )
      .slice(0, 12);
  }, [ingredients, ingredientSearch]);

  const isLoading = recipesLoading || ingredientsLoading;

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="R&D Workspace"
          description="Experiment with recipe ideas and iterate on dishes"
        >
          <Link href="/">
            <Button>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Experiment</span>
            </Button>
          </Link>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Ingredient Search */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Beaker className="h-5 w-5 text-zinc-500" />
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Ingredient Search
                  </h2>
                </div>

                <SearchInput
                  placeholder="Search ingredients..."
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  onClear={() => setIngredientSearch('')}
                  className="mb-4"
                />

                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  Find ingredients to add to your experiments
                </p>

                {ingredientsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1 max-h-80 overflow-auto">
                    {filteredIngredients.map((ingredient) => (
                      <li
                        key={ingredient.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 text-sm"
                      >
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {ingredient.name}
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {ingredient.base_unit}
                        </span>
                      </li>
                    ))}
                    {filteredIngredients.length === 0 && (
                      <li className="text-center py-4 text-zinc-400 dark:text-zinc-500">
                        No ingredients found
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Compare Variants - Placeholder */}
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="h-5 w-5 text-zinc-500" />
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Compare Variants
                  </h2>
                </div>

                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Select recipe variants to compare side-by-side
                </p>

                <Button variant="outline" className="w-full" disabled>
                  Compare Selected
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 text-center">
                  Coming soon
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Experiments */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-zinc-500" />
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      My Experiments
                    </h2>
                    <Badge variant="secondary">{experimentalRecipes.length}</Badge>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Draft recipes not yet finalized
                  </p>
                </div>

                {isLoading ? (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-48 rounded-lg" />
                    ))}
                  </div>
                ) : experimentalRecipes.length > 0 ? (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    {experimentalRecipes.map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FlaskConical className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 dark:text-zinc-400">
                      No experiments yet
                    </p>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                      Create a new recipe in the Canvas to start experimenting
                    </p>
                    <Link href="/" className="mt-4 inline-block">
                      <Button variant="outline" size="sm">
                        Go to Canvas
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity - Placeholder */}
            <Card className="mt-4">
              <CardContent className="p-4">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Recent Tasting Sessions
                </h2>

                <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
                  <p>Tasting session tracking coming soon</p>
                  <p className="text-xs mt-1">
                    Record feedback and notes from tastings
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
