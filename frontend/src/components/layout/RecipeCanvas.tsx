'use client';

import { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus, ChefHat } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useRecipe, useCreateRecipe } from '@/lib/hooks';
import { Button, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function EmptyState() {
  const { selectRecipe, userId } = useAppState();
  const createRecipe = useCreateRecipe();

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

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted p-6">
        <ChefHat className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-foreground">No recipe selected</h2>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Select a recipe from the left panel or create a new one to get started.
      </p>
      <Button className="mt-6" onClick={handleCreate} disabled={createRecipe.isPending}>
        <Plus className="h-4 w-4" />
        Create your first recipe
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-6">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="mt-8 h-8 w-48" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  );
}

interface RecipeCanvasProps {
  children: ReactNode;
}

export function RecipeCanvas({ children }: RecipeCanvasProps) {
  const { selectedRecipeId, userId, userType } = useAppState();
  const { data: recipe, isLoading, error } = useRecipe(selectedRecipeId);

  const canEdit =
    userType === 'admin' || (userId !== null && recipe?.owner_id === userId);

  const { setNodeRef, isOver } = useDroppable({
    id: 'recipe-canvas',
    disabled: !canEdit,
  });

  if (!selectedRecipeId) {
    return (
      <main className="flex-1 overflow-y-auto bg-background">
        <EmptyState />
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto bg-background">
        <LoadingState />
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="flex h-full items-center justify-center">
          <div className="rounded-lg bg-destructive/10 p-6 text-center">
            <p className="text-destructive">Failed to load recipe</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={setNodeRef}
      className={cn(
        'flex-1 overflow-y-auto bg-background',
        isOver && 'ring-2 ring-inset ring-ring'
      )}
    >
      {children}
    </main>
  );
}
