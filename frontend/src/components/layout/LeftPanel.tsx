'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '@/lib/hooks';
import { Button, Input, Badge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Recipe, RecipeStatus } from '@/types';

function getStatusVariant(status: RecipeStatus): 'default' | 'success' | 'secondary' {
  switch (status) {
    case 'active':
      return 'success';
    case 'archived':
      return 'secondary';
    default:
      return 'default';
  }
}

function RecipeCard({
  recipe,
  isSelected,
  onClick,
  onDelete,
}: {
  recipe: Recipe;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 2 seconds
      setTimeout(() => setConfirmDelete(false), 2000);
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative w-full cursor-pointer rounded-lg border p-3 text-left transition-colors',
        isSelected
          ? 'border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800'
          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{recipe.name}</h3>
          <p className="text-sm text-zinc-500">
            {recipe.yield_quantity} {recipe.yield_unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(recipe.status)}>
            {recipe.status}
          </Badge>
          <button
            onClick={handleDeleteClick}
            className={cn(
              'rounded p-1 transition-all',
              confirmDelete
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'text-zinc-400 opacity-0 hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
            )}
            title={confirmDelete ? 'Click again to confirm' : 'Delete recipe'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function LeftPanel() {
  const { selectedRecipeId, selectRecipe, userId } = useAppState();
  const { data: recipes, isLoading, error } = useRecipes();
  const createRecipe = useCreateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const [search, setSearch] = useState('');

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    const userOwnedRecipes = recipes.filter((r)=> r.created_by == userId)
    if (!search.trim()) return userOwnedRecipes;
    const lower = search.toLowerCase();
    return userOwnedRecipes.filter((r) => r.name.toLowerCase().includes(lower));
  }, [recipes, search]);

  const handleCreate = () => {
    createRecipe.mutate(
      {
        name: 'Untitled Recipe',
        yield_quantity: 10,
        yield_unit: 'portion',
        status: 'draft',
        created_by: userId || undefined,
      },
      {
        onSuccess: (newRecipe) => {
          selectRecipe(newRecipe.id);
          toast.success('Recipe created');
        },
        onError: () => toast.error('Failed to create recipe'),
      }
    );
  };

  const handleDelete = (recipeId: number) => {
    deleteRecipe.mutate(recipeId, {
      onSuccess: () => {
        if (selectedRecipeId === recipeId) {
          selectRecipe(null);
        }
        toast.success('Recipe deleted');
      },
      onError: () => toast.error('Failed to delete recipe'),
    });
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">Recipes</h2>
        <Button size="sm" onClick={handleCreate} disabled={createRecipe.isPending}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <RecipeListSkeleton />
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Failed to load recipes
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-500">
              {search ? 'No recipes found' : 'No recipes yet'}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" />
                Create your first recipe
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isSelected={recipe.id === selectedRecipeId}
                onClick={() => selectRecipe(recipe.id)}
                onDelete={() => handleDelete(recipe.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
