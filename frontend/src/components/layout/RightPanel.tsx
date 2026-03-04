'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Search, GripVertical, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { useIngredients, useCreateIngredient, useRecipes, useCategories, useRecipeCategories, useAllRecipeRecipeCategories, useRecipeOutletsBatch, useCategorizeIngredient } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Input, Select, Skeleton } from '@/components/ui';
import Image from 'next/image';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Ingredient, Recipe, Outlet } from '@/types';

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

function DraggableIngredientCard({ ingredient, categoryMap }: { ingredient: Ingredient; categoryMap: Record<number, string> }) {
  const { isDragDropEnabled } = useAppState();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ingredient-${ingredient.id}`,
    data: { ingredient, type: 'ingredient' },
    disabled: !isDragDropEnabled,
  });

  const categoryName = ingredient.category_id ? categoryMap[ingredient.category_id] : null;

  const handleAddClick = () => {
    window.dispatchEvent(
      new CustomEvent('canvas-add-ingredient', {
        detail: { ingredient },
      })
    );
  };

  return (
    <div
      ref={setNodeRef}
      data-ingredient-card
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group cursor-default',
        isDragging && 'opacity-50'
      )}
    >
      {/* Left accent + drag handle */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-0.5 h-6 rounded-full bg-blue-400 dark:bg-blue-500" />
        {isDragDropEnabled && (
          <button
            {...listeners}
            {...attributes}
            className="cursor-grab touch-none text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm text-zinc-900 dark:text-white truncate">
          {ingredient.name}
        </h3>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{ingredient.base_unit}</span>
          {categoryName && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600 text-[11px]">·</span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{categoryName}</span>
            </>
          )}
          {ingredient.cost_per_base_unit !== null && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600 text-[11px]">·</span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                {formatCurrency(ingredient.cost_per_base_unit)}/{ingredient.base_unit}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={handleAddClick}
        className="shrink-0 p-1 rounded-md text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
        aria-label="Add to canvas"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DraggableRecipeCard({
  recipe,
  outletNames = [],
  categoryNames = []
}: {
  recipe: Recipe;
  outletNames?: string[];
  categoryNames?: string[];
}) {
  const { selectedRecipeId, isDragDropEnabled } = useAppState();
  const isCurrentRecipe = recipe.id === selectedRecipeId;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipe, type: 'recipe' },
    disabled: isCurrentRecipe || !isDragDropEnabled,
  });

  const handleAddClick = () => {
    if (isCurrentRecipe) {
      toast.warning('Cannot add this recipe to itself');
      return;
    }
    window.dispatchEvent(
      new CustomEvent('canvas-add-recipe', {
        detail: { recipe },
      })
    );
  };

  return (
    <div
      ref={setNodeRef}
      data-recipe-card
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group cursor-default',
        isDragging && 'opacity-50',
        isCurrentRecipe && 'opacity-40 cursor-not-allowed'
      )}
    >
      {/* Left accent + drag handle */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-0.5 h-6 rounded-full bg-green-400 dark:bg-green-500" />
        {isDragDropEnabled && (
          <button
            {...listeners}
            {...attributes}
            className={cn(
              'touch-none text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400',
              isCurrentRecipe ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
            )}
            disabled={isCurrentRecipe}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Image thumbnail (if available) */}
      {recipe.image_url && (
        <div className="w-8 h-8 rounded overflow-hidden shrink-0 relative">
          <Image src={recipe.image_url} alt={recipe.name} fill className="object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium text-sm text-zinc-900 dark:text-white truncate">
            {recipe.name}
          </h3>
          {isCurrentRecipe && (
            <span className="text-[10px] font-medium uppercase text-zinc-400 dark:text-zinc-500 shrink-0">current</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{recipe.yield_quantity} {recipe.yield_unit}</span>
          {outletNames.length > 0 && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600 text-[11px]">·</span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{outletNames.join(', ')}</span>
            </>
          )}
          {categoryNames.length > 0 && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600 text-[11px]">·</span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{categoryNames.join(', ')}</span>
            </>
          )}
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={handleAddClick}
        disabled={isCurrentRecipe}
        className="shrink-0 p-1 rounded-md text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all disabled:opacity-0"
        aria-label="Add to canvas"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function NewIngredientForm({ onClose }: { onClose: () => void }) {
  const createIngredient = useCreateIngredient();
  const categorizeIngredient = useCategorizeIngredient();
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [cost, setCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the category ID from the agent
      const categoryData = await categorizeIngredient.mutateAsync(name);
      const categoryId = categoryData.category_id;

      // Create the ingredient with the category from the agent
      await createIngredient.mutateAsync({
        name: name.trim(),
        base_unit: baseUnit,
        cost_per_base_unit: cost ? parseFloat(cost) : null,
        category_id: categoryId,
      });

      toast.success(`Ingredient created`);
      onClose();
    } catch {
      toast.error('Failed to create ingredient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-3">
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
        <Button type="submit" size="sm" disabled={isSubmitting || categorizeIngredient.isPending}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface RightPanelProps {
  outlets?: Outlet[];
}

export function RightPanel({ outlets }: RightPanelProps) {
  const { data: ingredientsData, isLoading: ingredientsLoading, error: ingredientsError } = useIngredients({ page_size: 30 });
  const ingredients = ingredientsData?.items;
  const { data: recipesData, isLoading: recipesLoading, error: recipesError } = useRecipes({ page_size: 30 });
  const recipes = recipesData?.items;
  const { data: categories } = useCategories();
  const { data: recipeCategoriesData } = useRecipeCategories({ page_size: 30 });
  const recipeCategories = recipeCategoriesData?.items;
  const { data: allRecipeRecipeCategories } = useAllRecipeRecipeCategories();
  const createIngredient = useCreateIngredient();
  const categorizeIngredient = useCategorizeIngredient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('all');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const handleQuickAdd = useCallback(async () => {
    const name = search.trim();
    if (!name) return;

    setIsQuickAdding(true);
    try {
      let categoryId: number | null = null;
      try {
        const categoryData = await categorizeIngredient.mutateAsync(name);
        categoryId = categoryData.category_id;
      } catch {
        // Categorization failed — proceed without category
      }

      await createIngredient.mutateAsync({
        name,
        base_unit: 'g',
        cost_per_base_unit: null,
        category_id: categoryId,
      });

      toast.success(`Ingredient "${name}" created`);
      setSearch('');
    } catch {
      toast.error('Failed to create ingredient');
    } finally {
      setIsQuickAdding(false);
    }
  }, [search, categorizeIngredient, createIngredient]);
  // Fetch recipe outlets (with TanStack Query caching)
  const { data: recipeOutlets = new Map() } = useRecipeOutletsBatch(
    recipes && recipes.length > 0 ? recipes.map((r) => r.id) : null
  );

  // Create a mapping of category ID to name for efficient lookups
  const categoryMap = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {} as Record<number, string>);
  }, [categories]);

  // Create mapping for recipe categories
  const recipeCategoryMap = useMemo(() => {
    if (!recipeCategories) return {};
    return recipeCategories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {} as Record<number, string>);
  }, [recipeCategories]);

  // Create mapping for outlets
  const outletNameMap = useMemo(() => {
    if (!outlets) return {};
    return outlets.reduce((acc: Record<number, string>, outlet: Outlet) => {
      acc[outlet.id] = outlet.name;
      return acc;
    }, {} as Record<number, string>);
  }, [outlets]);

  // Helper function to get outlet names for a recipe
  const getOutletNamesForRecipe = (recipeId: number): string[] => {
    const recipeOutletsList = recipeOutlets.get(recipeId) || [];
    return recipeOutletsList.map((ro: { outlet_id: number }) => outletNameMap[ro.outlet_id]).filter(Boolean);
  };

  // Helper function to get category names for a recipe
  const getCategoryNamesForRecipe = (recipeId: number): string[] => {
    const categoryLinks = (allRecipeRecipeCategories || []).filter(
      (link) => link.recipe_id === recipeId
    );
    return categoryLinks
      .map((link) => recipeCategoryMap[link.category_id])
      .filter(Boolean);
  };

  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];
    const active = ingredients.filter((i) => i.is_active);

    let filtered = active;

    // Search filter
    if (search.trim()) {
      const lower = search.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(lower));
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((i) =>
        selectedCategories.includes(i.category_id ?? -1)
      );
    }

    return filtered.sort((a, b) => b.id - a.id);
  }, [ingredients, search, selectedCategories]);

  const toggleCategory = (categoryId: number) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter((id) => id !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  const clearCategoryFilters = () => {
    setSelectedCategories([]);
  };

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];

    return recipes.filter((recipe) => {
      // Filter by search
      // Note: Backend already handles access control, so we only filter by search term
      if (search.trim()) {
        const lower = search.toLowerCase();
        if (!recipe.name.toLowerCase().includes(lower)) {
          return false;
        }
      }
      return true;
    });
  }, [recipes, search]);

  const isLoading = ingredientsLoading || recipesLoading;
  const hasError = ingredientsError || recipesError;

  const showIngredients = activeTab === 'all' || activeTab === 'ingredients';
  const showRecipes = activeTab === 'all' || activeTab === 'items';

  return (
    <aside className={cn("flex h-full flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 transition-all duration-300 ease-in-out overflow-hidden", isCollapsed ? "w-10" : "w-72")}>
      {/* Header */}
      {!isCollapsed && (
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Library</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowForm(true)}
              disabled={showForm}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              title="New ingredient"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Collapse panel"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsed Header */}
      {isCollapsed && (
        <div className="flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800 px-1 py-2.5">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Expand panel"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!isCollapsed && (
        <>
          {/* Tabs */}
          <div className={cn("border-b border-zinc-200 dark:border-zinc-800 px-3 pt-1", isQuickAdding && "pointer-events-none opacity-50")}>
            <nav className="flex gap-1" aria-label="Library tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                    activeTab === tab.id
                      ? 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Search */}
          <div className={cn("border-b border-zinc-200 dark:border-zinc-800 px-3 py-2", isQuickAdding && "pointer-events-none opacity-50")}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Category Filter — compact */}
          {(activeTab === 'all' || activeTab === 'ingredients') && categories && categories.length > 0 && (
            <div className="border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span>Filter{selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ''}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", showCategoryFilter && "rotate-180")} />
              </button>

              {showCategoryFilter && (
                <div className="px-3 pb-2">
                  <div className="flex flex-wrap gap-1">
                    {categories.filter(c => c.is_active).map((category) => (
                      <button
                        key={category.id}
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          'px-2 py-0.5 text-[11px] font-medium rounded-full transition-colors',
                          selectedCategories.includes(category.id)
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        )}
                      >
                        {category.name}
                      </button>
                    ))}
                    {selectedCategories.length > 0 && (
                      <button
                        onClick={clearCategoryFilters}
                        className="px-2 py-0.5 text-[11px] text-blue-500 dark:text-blue-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List */}
          <div
            className={cn("flex-1 overflow-y-auto px-2.5 py-2 relative", isQuickAdding && "pointer-events-none")}
            onDoubleClick={(e) => {
              if (!(e.target as HTMLElement).closest('[data-ingredient-card]') && !(e.target as HTMLElement).closest('[data-recipe-card]')) {
                setShowForm(true);
              }
            }}
          >
        {/* Loading overlay */}
        {isQuickAdding && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-50/70 dark:bg-zinc-950/70">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating ingredient...</span>
            </div>
          </div>
        )}
        {showForm && (
          <div className="mb-2">
            <NewIngredientForm onClose={() => setShowForm(false)} />
          </div>
        )}

        {isLoading ? (
          <ListSkeleton />
        ) : hasError ? (
          <div className="rounded-lg bg-red-50 p-3 text-center text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Failed to load items
          </div>
        ) : (
          <div className="space-y-3">
            {/* Ingredients Section */}
            {showIngredients && (
              <div>
                {activeTab === 'all' && (
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Ingredients</h3>
                )}
                {filteredIngredients.length === 0 ? (
                  <div className="px-1">
                    {search.trim() ? (
                      <>
                        <button
                          onClick={handleQuickAdd}
                          disabled={isQuickAdding}
                          className="w-full mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2.5 border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Add &ldquo;{search.trim()}&rdquo;</span>
                        </button>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">No matching ingredients</p>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-500">No ingredients yet</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredIngredients.map((ingredient) => (
                      <DraggableIngredientCard
                        key={ingredient.id}
                        ingredient={ingredient}
                        categoryMap={categoryMap}
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
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Items</h3>
                )}
                {filteredRecipes.length === 0 ? (
                  <p className="text-xs text-zinc-500 px-1">
                    {search ? 'No matches' : 'No recipes yet'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredRecipes.map((recipe) => (
                      <DraggableRecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        outletNames={getOutletNamesForRecipe(recipe.id)}
                        categoryNames={getCategoryNamesForRecipe(recipe.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {activeTab === 'all' && filteredIngredients.length === 0 && filteredRecipes.length === 0 && !search && (
              <div className="py-8 text-center">
                <p className="text-xs text-zinc-500">No items yet</p>
              </div>
            )}
          </div>
        )}
          </div>
        </>
      )}
    </aside>
  );
}
