'use client';

import { useState, useMemo } from 'react';
import { FlaskConical } from 'lucide-react';
import { useRecipes } from '@/lib/hooks';
import { RecipeCard } from '@/components/recipes';
import { PageHeader, SearchInput, Skeleton } from '@/components/ui';
import { useAppState } from '@/lib/store';

export default function RndPage() {
  const { userId } = useAppState();
  const { data: recipes, isLoading, error } = useRecipes();

  const [search, setSearch] = useState('');

  // Filter draft recipes that the user created
  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];

    return recipes.filter((recipe) => {
      // Only show draft recipes
      if (recipe.status !== 'draft') {
        return false;
      }
      // Only show recipes created by the current user
      if (recipe.created_by !== userId) {
        return false;
      }
      // Filter by search
      if (search && !recipe.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [recipes, search, userId]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load recipes. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="R&D Workspace"
          description="Experiment with recipe ideas and iterate on dishes"
        />

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search experiments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <FlaskConical className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No experiments match your search' : 'No experiments yet'}
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
              Create a new recipe in the Canvas to start experimenting
            </p>
          </div>
        )}

        {/* Recipe Grid */}
        {!isLoading && filteredRecipes.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                href={`/rnd/r/${recipe.id}`}
                isOwned={userId !== null && recipe.owner_id === userId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
