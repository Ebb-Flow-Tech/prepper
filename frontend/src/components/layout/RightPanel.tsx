'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { useIngredients, useCreateIngredient, useRecipes } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Input, Select, Skeleton } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Ingredient, Recipe } from '@/types';

type RightPanelTab = 'all' | 'ingredients' | 'items';

const TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'items', label: 'Items' },
];

const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'l', label: 'l (liters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
];

function DraggableIngredientCard({ ingredient }: { ingredient: Ingredient }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ingredient-${ingredient.id}`,
    data: { ingredient, type: 'ingredient' },
  });

  return (
    <div
      ref={setNodeRef}
      data-ingredient-card
      className={cn(
        'flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800',
        isDragging && 'opacity-50'
      )}
    >
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{ingredient.name}</p>
        <p className="text-sm text-zinc-500">
          {ingredient.base_unit} •{' '}
          {ingredient.cost_per_base_unit !== null
            ? `${formatCurrency(ingredient.cost_per_base_unit)}/${ingredient.base_unit}`
            : 'no cost set'}
        </p>
      </div>
    </div>
  );
}

function DraggableRecipeCard({ recipe }: { recipe: Recipe }) {
  const { selectedRecipeId } = useAppState();
  const isCurrentRecipe = recipe.id === selectedRecipeId;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipe, type: 'recipe' },
    disabled: isCurrentRecipe,
  });

  return (
    <div
      ref={setNodeRef}
      data-recipe-card
      className={cn(
        'flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800',
        isDragging && 'opacity-50',
        isCurrentRecipe && 'opacity-40 cursor-not-allowed'
      )}
    >
      <button
        {...listeners}
        {...attributes}
        className={cn(
          'touch-none text-zinc-400 hover:text-zinc-600',
          isCurrentRecipe ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
        )}
        disabled={isCurrentRecipe}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{recipe.name}</p>
        <p className="text-sm text-zinc-500">
          {recipe.yield_quantity} {recipe.yield_unit}
          {isCurrentRecipe && ' • Current recipe'}
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function NewIngredientForm({ onClose }: { onClose: () => void }) {
  const createIngredient = useCreateIngredient();
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [cost, setCost] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    createIngredient.mutate(
      {
        name: name.trim(),
        base_unit: baseUnit,
        cost_per_base_unit: cost ? parseFloat(cost) : null,
      },
      {
        onSuccess: () => {
          toast.success('Ingredient created');
          onClose();
        },
        onError: () => toast.error('Failed to create ingredient'),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ingredient name"
        autoFocus
      />
      <div className="flex gap-2">
        <Select
          value={baseUnit}
          onChange={(e) => setBaseUnit(e.target.value)}
          options={UNIT_OPTIONS}
          className="flex-1"
        />
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Cost"
          className="w-24"
          min={0}
          step={0.01}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={createIngredient.isPending}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RightPanel() {
  const { data: ingredients, isLoading: ingredientsLoading, error: ingredientsError } = useIngredients();
  const { data: recipes, isLoading: recipesLoading, error: recipesError } = useRecipes();
  const { userId, userType } = useAppState();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('all');

  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];
    const active = ingredients.filter((i) => i.is_active);
    if (!search.trim()) return active;
    const lower = search.toLowerCase();
    return active.filter((i) => i.name.toLowerCase().includes(lower));
  }, [ingredients, search]);

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

      // Admin users can see all recipes
      if (userType === 'admin') {
        return true;
      }

      // Show recipe if user is the owner OR if recipe is public
      const currUserId = userId ? userId : null;
      if (recipe.owner_id !== currUserId && !recipe.is_public) {
        return false;
      }
      return true;
    });
  }, [recipes, search, userId, userType]);

  const isLoading = ingredientsLoading || recipesLoading;
  const hasError = ingredientsError || recipesError;

  const showIngredients = activeTab === 'all' || activeTab === 'ingredients';
  const showRecipes = activeTab === 'all' || activeTab === 'items';

  return (
    <aside className="flex h-full w-72 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">Library</h2>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex" aria-label="Library tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'ingredients'
                ? 'Search ingredients...'
                : activeTab === 'items'
                  ? 'Search recipes...'
                  : 'Search all...'
            }
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto p-3"
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('[data-ingredient-card]') && !(e.target as HTMLElement).closest('[data-recipe-card]')) {
            setShowForm(true);
          }
        }}
      >
        {showForm && (
          <div className="mb-3">
            <NewIngredientForm onClose={() => setShowForm(false)} />
          </div>
        )}

        {isLoading ? (
          <ListSkeleton />
        ) : hasError ? (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Failed to load items
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ingredients Section */}
            {showIngredients && (
              <div>
                {activeTab === 'all' && (
                  <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Ingredients</h3>
                )}
                {filteredIngredients.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {search ? 'No ingredients found' : 'No ingredients yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeTab !== 'all' && (
                      <p className="mb-2 text-xs text-zinc-500">
                        Drag to add to recipe
                      </p>
                    )}
                    {filteredIngredients.map((ingredient) => (
                      <DraggableIngredientCard
                        key={ingredient.id}
                        ingredient={ingredient}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recipes Section */}
            {showRecipes && (
              <div>
                {activeTab === 'all' && (
                  <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Items (Recipes)</h3>
                )}
                {filteredRecipes.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {search ? 'No recipes found' : 'No recipes yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeTab !== 'all' && (
                      <p className="mb-2 text-xs text-zinc-500">
                        Drag to add as sub-recipe
                      </p>
                    )}
                    {filteredRecipes.map((recipe) => (
                      <DraggableRecipeCard
                        key={recipe.id}
                        recipe={recipe}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state for All tab */}
            {activeTab === 'all' && filteredIngredients.length === 0 && filteredRecipes.length === 0 && !search && (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-500">No items yet</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Double-click to add an ingredient
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
