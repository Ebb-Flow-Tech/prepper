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
  canEdit,
  isOwned,
  onClick,
  onDelete,
}: {
  recipe: Recipe;
  isSelected: boolean;
  canEdit: boolean;
  isOwned: boolean;
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
        <h3 className="min-w-0 flex-1 truncate font-medium">{recipe.name}</h3>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(recipe.status)}>
            {recipe.status}
          </Badge>
          <button
            onClick={canEdit ? handleDeleteClick : undefined}
            className={cn(
              'rounded p-1 transition-all',
              !canEdit
                ? 'invisible'
                : confirmDelete
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground opacity-0 hover:bg-secondary hover:text-foreground group-hover:opacity-100'
            )}
            disabled={!canEdit}
            title={!canEdit ? undefined : confirmDelete ? 'Click again to confirm' : 'Delete recipe'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {recipe.yield_quantity} {recipe.yield_unit}
        </p>
        <div className="flex items-center gap-2">
          {isOwned && (
            <Badge className="bg-foreground text-background">Owned</Badge>
          )}
          {/* Spacer to align with delete button above */}
          <div className="w-6" />
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
  const { selectedRecipeId, selectRecipe, userId } = useAppState();
  const { data: recipesData, isLoading, error } = useRecipes({ page_size: 30 });
  const recipes = recipesData?.items;
  const createRecipe = useCreateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const [search, setSearch] = useState('');

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];

    return recipes.filter((recipe) => {
      // Filter by search
      if (search.trim()) {
        const lower = search.toLowerCase();
        if (!recipe.name.toLowerCase().includes(lower)) {
          return false;
        }
      }

      // Show recipe if user is the owner OR if recipe is public
      const currUserId = userId ? userId : null;
      if (recipe.owner_id !== currUserId && !recipe.is_public) {
        return false;
      }
      return true;
    });
  }, [recipes, search, userId]);

  const handleCreate = () => {
    createRecipe.mutate(
      {
        name: 'Untitled Dish',
        yield_quantity: 10,
        yield_unit: 'portion',
        status: 'draft',
        created_by: userId || undefined,
        is_public: false,
        owner_id: userId || undefined,
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
        <h2 className="font-semibold text-foreground">Dishes</h2>
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
            placeholder="Search dishes..."
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
              {search ? 'No dishes found' : 'No dishes yet'}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" />
                Create your first dish
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecipes.map((recipe) => {
              const canEditRecipe = userId !== null && recipe.owner_id === userId;
              const isOwned = userId !== null && recipe.owner_id === userId;
              return (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isSelected={recipe.id === selectedRecipeId}
                  canEdit={canEditRecipe}
                  isOwned={isOwned}
                  onClick={() => selectRecipe(recipe.id === selectedRecipeId ? null : recipe.id)}
                  onDelete={() => handleDelete(recipe.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
