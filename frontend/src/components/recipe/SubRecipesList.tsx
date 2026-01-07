'use client';

import { useState, useCallback } from 'react';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useSubRecipes,
  useAddSubRecipe,
  useUpdateSubRecipe,
  useRemoveSubRecipe,
  useReorderSubRecipes,
  useRecipes,
} from '@/lib/hooks';
import { Button, Input, Select, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppState } from '@/lib/store';
import type { SubRecipe, SubRecipeUnit, Recipe } from '@/types';

interface SubRecipesListProps {
  recipeId: number;
  canEdit: boolean;
}

const SUB_RECIPE_UNIT_OPTIONS = [
  { value: 'portion', label: 'Portion' },
  { value: 'batch', label: 'Batch' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'ml', label: 'Milliliters (ml)' },
];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface SubRecipeRowProps {
  subRecipe: SubRecipe;
  recipeName: string;
  canEdit: boolean;
  onQuantityChange: (quantity: number) => void;
  onUnitChange: (unit: SubRecipeUnit) => void;
  onRemove: () => void;
}

function SubRecipeRow({
  subRecipe,
  recipeName,
  canEdit,
  onQuantityChange,
  onUnitChange,
  onRemove,
}: SubRecipeRowProps) {
  const [localQuantity, setLocalQuantity] = useState(subRecipe.quantity.toString());

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subRecipe.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleQuantityBlur = useCallback(() => {
    const parsed = parseFloat(localQuantity);
    if (!isNaN(parsed) && parsed > 0 && parsed !== subRecipe.quantity) {
      onQuantityChange(parsed);
    } else {
      setLocalQuantity(subRecipe.quantity.toString());
    }
  }, [localQuantity, subRecipe.quantity, onQuantityChange]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900',
        isDragging && 'opacity-50'
      )}
    >
      {canEdit && (
        <button
          className="cursor-grab touch-none text-zinc-400 hover:text-zinc-600"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{recipeName}</p>
        <p className="text-xs text-zinc-500">Added {formatDate(subRecipe.created_at)}</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={localQuantity}
          onChange={(e) => setLocalQuantity(e.target.value)}
          onBlur={handleQuantityBlur}
          disabled={!canEdit}
          className="w-20 text-center"
        />

        <Select
          value={subRecipe.unit}
          onChange={(e) => onUnitChange(e.target.value as SubRecipeUnit)}
          options={SUB_RECIPE_UNIT_OPTIONS}
          disabled={!canEdit}
          className="w-32"
        />

        {canEdit && (
          <button
            onClick={onRemove}
            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface AddSubRecipeFormProps {
  recipeId: number;
  existingChildIds: number[];
  recipes: Recipe[];
  userId: string | null;
  userType: string | null;
}

function AddSubRecipeForm({ recipeId, existingChildIds, recipes, userId, userType }: AddSubRecipeFormProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<SubRecipeUnit>('portion');
  const addSubRecipe = useAddSubRecipe();

  // Filter recipes based on user access:
  // - Admins see all recipes
  // - Others see only public recipes or recipes they own
  const accessibleRecipes = userType === 'admin'
    ? recipes
    : recipes.filter((r) => r.is_public || r.owner_id === userId);

  // Further filter out the current recipe and already added sub-recipes
  const availableRecipes = accessibleRecipes.filter(
    (r) => r.id !== recipeId && !existingChildIds.includes(r.id)
  );

  const recipeOptions = [
    { value: '', label: 'Select a recipe...' },
    ...availableRecipes.map((r) => ({ value: r.id.toString(), label: r.name })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId) return;

    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    addSubRecipe.mutate(
      {
        recipeId,
        data: {
          child_recipe_id: parseInt(selectedRecipeId),
          quantity: parsedQuantity,
          unit,
        },
      },
      {
        onSuccess: () => {
          toast.success('Sub-recipe added');
          setSelectedRecipeId('');
          setQuantity('1');
          setUnit('portion');
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Failed to add sub-recipe';
          if (message.includes('cycle') || message.includes('circular')) {
            toast.error('Cannot add: this would create a circular reference');
          } else {
            toast.error(message);
          }
        },
      }
    );
  };

  if (availableRecipes.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No recipes available to add as sub-recipes
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-zinc-500">Recipe</label>
        <Select
          value={selectedRecipeId}
          onChange={(e) => setSelectedRecipeId(e.target.value)}
          options={recipeOptions}
          className="w-full"
        />
      </div>

      <div className="w-24">
        <label className="mb-1 block text-xs font-medium text-zinc-500">Quantity</label>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="w-32">
        <label className="mb-1 block text-xs font-medium text-zinc-500">Unit</label>
        <Select
          value={unit}
          onChange={(e) => setUnit(e.target.value as SubRecipeUnit)}
          options={SUB_RECIPE_UNIT_OPTIONS}
          className="w-full"
        />
      </div>

      <Button
        type="submit"
        disabled={!selectedRecipeId || addSubRecipe.isPending}
        className="h-10"
      >
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </form>
  );
}

export function SubRecipesList({ recipeId, canEdit }: SubRecipesListProps) {
  const { userId, userType } = useAppState();
  const { data: subRecipes, isLoading, error } = useSubRecipes(recipeId);
  const { data: recipes } = useRecipes();
  const updateSubRecipe = useUpdateSubRecipe();
  const removeSubRecipe = useRemoveSubRecipe();
  const reorderSubRecipes = useReorderSubRecipes();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleQuantityChange = useCallback(
    (linkId: number, quantity: number) => {
      updateSubRecipe.mutate(
        { recipeId, linkId, data: { quantity } },
        { onError: () => toast.error('Failed to update quantity') }
      );
    },
    [recipeId, updateSubRecipe]
  );

  const handleUnitChange = useCallback(
    (linkId: number, unit: SubRecipeUnit) => {
      updateSubRecipe.mutate(
        { recipeId, linkId, data: { unit } },
        { onError: () => toast.error('Failed to update unit') }
      );
    },
    [recipeId, updateSubRecipe]
  );

  const handleRemove = useCallback(
    (linkId: number) => {
      removeSubRecipe.mutate(
        { recipeId, linkId },
        {
          onSuccess: () => toast.success('Sub-recipe removed'),
          onError: () => toast.error('Failed to remove sub-recipe'),
        }
      );
    },
    [recipeId, removeSubRecipe]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !subRecipes) return;

      const oldIndex = subRecipes.findIndex((s) => s.id === active.id);
      const newIndex = subRecipes.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(subRecipes, oldIndex, newIndex);
        const orderedIds = newOrder.map((s) => s.id);

        reorderSubRecipes.mutate(
          { recipeId, data: { ordered_ids: orderedIds } },
          { onError: () => toast.error('Failed to reorder sub-recipes') }
        );
      }
    },
    [subRecipes, recipeId, reorderSubRecipes]
  );

  // Create a map of recipe IDs to names for display
  const recipeMap = new Map<number, string>();
  recipes?.forEach((r) => recipeMap.set(r.id, r.name));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
        Failed to load sub-recipes
      </div>
    );
  }

  const sortedSubRecipes = [...(subRecipes || [])].sort(
    (a, b) => a.position - b.position
  );

  const existingChildIds = sortedSubRecipes.map((s) => s.child_recipe_id);

  return (
    <div className="space-y-4">
      {canEdit && recipes && (
        <AddSubRecipeForm
          recipeId={recipeId}
          existingChildIds={existingChildIds}
          recipes={recipes}
          userId={userId}
          userType={userType}
        />
      )}

      {sortedSubRecipes.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedSubRecipes.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedSubRecipes.map((subRecipe) => (
                <SubRecipeRow
                  key={subRecipe.id}
                  subRecipe={subRecipe}
                  recipeName={recipeMap.get(subRecipe.child_recipe_id) || 'Unknown Recipe'}
                  canEdit={canEdit}
                  onQuantityChange={(qty) => handleQuantityChange(subRecipe.id, qty)}
                  onUnitChange={(unit) => handleUnitChange(subRecipe.id, unit)}
                  onRemove={() => handleRemove(subRecipe.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-500">No sub-recipes yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            Add recipes as components of this recipe
          </p>
        </div>
      )}
    </div>
  );
}
