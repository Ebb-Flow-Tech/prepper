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
          ? 'border-ring bg-accent'
          : 'border-border hover:border-ring/50 hover:bg-accent/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">{recipe.name}</h3>
          <p className="text-sm text-muted-foreground">
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
                ? 'bg-destructive/10 text-destructive'
                : 'text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100'
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
        <div key={i} className="rounded-lg border border-border p-3">
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function LeftPanel() {
  const { selectedRecipeId, selectRecipe } = useAppState();
  const { data: recipes, isLoading, error } = useRecipes();
  const createRecipe = useCreateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const [search, setSearch] = useState('');

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    if (!search.trim()) return recipes;
    const lower = search.toLowerCase();
    return recipes.filter((r) => r.name.toLowerCase().includes(lower));
  }, [recipes, search]);

  const handleCreate = () => {
    createRecipe.mutate(
      {
        name: 'Untitled Recipe',
        yield_quantity: 10,
        yield_unit: 'portion',
        status: 'draft',
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
    <aside className="flex h-full w-72 flex-col border-r border-border bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">Recipes</h2>
        <Button size="sm" onClick={handleCreate} disabled={createRecipe.isPending}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          <div className="rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">
            Failed to load recipes
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
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
