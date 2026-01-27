'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, GripVertical, ImagePlus, ChevronDown } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { useIngredients, useCreateIngredient, useRecipes, useCategories, useRecipeCategories, useAllRecipeRecipeCategories, useRecipeOutletsBatch } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Input, Select, Skeleton } from '@/components/ui';
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
    // Dispatch custom event for CanvasTab to listen to
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
        'game-card game-card-ingredient game-card-sm game-card-hover',
        isDragging && 'opacity-50'
      )}
    >
      {/* Card frame */}
      <div className="game-card-frame" />

      {/* Rarity indicator */}
      <div className="game-card-rarity game-card-rarity-ingredient" />

      {/* Card Art */}
      <div className="game-card-art game-card-art-ingredient flex items-center justify-center">
        <ImagePlus className="h-8 w-8 text-blue-300/50" />
      </div>

      {/* Title Banner */}
      <div className="game-card-title">
        <div className="flex items-center gap-2">
          {isDragDropEnabled && (
            <button
              {...listeners}
              {...attributes}
              className="cursor-grab touch-none text-blue-300 hover:text-blue-100 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <h3 className="flex-1 font-bold text-white truncate text-sm tracking-wide uppercase">
            {ingredient.name}
          </h3>
          <button
            onClick={handleAddClick}
            className="ml-auto p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            aria-label="Add to canvas"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="game-card-body">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="game-card-stat game-card-stat-ingredient">{ingredient.base_unit}</span>
            {categoryName && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 truncate">
                {categoryName}
              </span>
            )}
          </div>
          <span className="text-sm text-blue-200/80 flex-shrink-0">
            {ingredient.cost_per_base_unit !== null
              ? `${formatCurrency(ingredient.cost_per_base_unit)}/${ingredient.base_unit}`
              : 'no cost'}
          </span>
        </div>
      </div>
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
    // Dispatch custom event for CanvasTab to listen to
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
        'game-card game-card-recipe game-card-sm game-card-hover',
        isDragging && 'opacity-50',
        isCurrentRecipe && 'opacity-40 cursor-not-allowed'
      )}
    >
      {/* Card frame */}
      <div className="game-card-frame" />

      {/* Rarity indicator */}
      <div className="game-card-rarity game-card-rarity-recipe" />

      {/* Card Art */}
      {recipe.image_url ? (
        <div className="game-card-art relative">
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="game-card-art game-card-art-recipe flex items-center justify-center">
          <ImagePlus className="h-8 w-8 text-green-300/50" />
        </div>
      )}

      {/* Title Banner */}
      <div className="game-card-title">
        <div className="flex items-center gap-2">
          {isDragDropEnabled && (
            <button
              {...listeners}
              {...attributes}
              className={cn(
                'touch-none text-green-300 hover:text-green-100',
                isCurrentRecipe ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
              )}
              disabled={isCurrentRecipe}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <h3 className="flex-1 font-bold text-white truncate text-sm tracking-wide uppercase">
            {recipe.name}
          </h3>
          <button
            onClick={handleAddClick}
            disabled={isCurrentRecipe}
            className="ml-auto p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add to canvas"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="game-card-body">
        <div className="flex items-center justify-between mb-2">
          <span className="game-card-stat game-card-stat-recipe">
            {recipe.yield_quantity} {recipe.yield_unit}
          </span>
          {isCurrentRecipe && (
            <span className="text-xs text-green-300/60 uppercase tracking-wide">Current</span>
          )}
        </div>

        {/* Outlets and Categories */}
        {(outletNames.length > 0 || categoryNames.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {outletNames.map((name) => (
              <span key={name} className="text-xs bg-green-500/30 text-green-200 px-1.5 py-0.5 rounded">
                {name}
              </span>
            ))}
            {categoryNames.map((name) => (
              <span key={name} className="text-xs bg-green-400/20 text-green-300 px-1.5 py-0.5 rounded">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
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

// Auto-assign category based on ingredient name keywords
function autoAssignCategory(name: string): string {
  const lowerName = name.toLowerCase();

  // Proteins
  if (/\b(chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|prawn|crab|lobster|egg|tofu|tempeh|seitan|turkey|duck|bacon|ham|sausage|meat|steak|fillet|mince|ground)\b/.test(lowerName)) {
    return 'proteins';
  }

  // Vegetables
  if (/\b(carrot|onion|garlic|tomato|potato|lettuce|spinach|broccoli|cauliflower|pepper|cucumber|celery|cabbage|mushroom|zucchini|eggplant|corn|pea|bean|asparagus|leek|kale|chard|arugula|radish|beet|turnip|squash|pumpkin)\b/.test(lowerName)) {
    return 'vegetables';
  }

  // Fruits
  if (/\b(apple|banana|orange|lemon|lime|grape|strawberry|blueberry|raspberry|mango|pineapple|peach|pear|plum|cherry|watermelon|melon|kiwi|papaya|coconut|avocado|fig|date|raisin|cranberry)\b/.test(lowerName)) {
    return 'fruits';
  }

  // Dairy
  if (/\b(milk|cheese|butter|cream|yogurt|yoghurt|curd|ghee|paneer|mozzarella|cheddar|parmesan|ricotta|feta|brie|mascarpone|sour cream|whey|casein)\b/.test(lowerName)) {
    return 'dairy';
  }

  // Grains
  if (/\b(rice|pasta|noodle|bread|flour|wheat|oat|barley|quinoa|couscous|bulgur|cornmeal|semolina|rye|millet|sorghum|cereal|cracker|tortilla|pita)\b/.test(lowerName)) {
    return 'grains';
  }

  // Spices
  if (/\b(salt|pepper|cumin|coriander|turmeric|paprika|cinnamon|nutmeg|clove|cardamom|ginger|oregano|basil|thyme|rosemary|parsley|cilantro|dill|mint|bay leaf|chili|cayenne|saffron|vanilla|fennel|anise|mustard seed)\b/.test(lowerName)) {
    return 'spices';
  }

  // Oils & Fats
  if (/\b(oil|olive oil|vegetable oil|coconut oil|sesame oil|sunflower oil|canola oil|lard|shortening|margarine|ghee|fat|dripping)\b/.test(lowerName)) {
    return 'oils_fats';
  }

  // Sauces & Condiments
  if (/\b(sauce|ketchup|mayonnaise|mayo|mustard|vinegar|soy sauce|fish sauce|oyster sauce|hoisin|sriracha|tabasco|worcestershire|dressing|marinade|relish|chutney|salsa|pesto|hummus)\b/.test(lowerName)) {
    return 'sauces_condiments';
  }

  // Beverages
  if (/\b(water|juice|wine|beer|coffee|tea|milk|soda|cola|broth|stock|coconut water|lemonade|smoothie)\b/.test(lowerName)) {
    return 'beverages';
  }

  return 'other';
}

export function NewIngredientForm({ onClose }: { onClose: () => void }) {
  const createIngredient = useCreateIngredient();
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [cost, setCost] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Auto-assign category when name changes
  const autoCategory = useMemo(() => autoAssignCategory(name), [name]);
  const effectiveCategory = selectedCategory || autoCategory;

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({
      value: String(cat.id),
      label: cat.name,
    }));
  }, [categories]);

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
          toast.success(`Ingredient created (Category: ${effectiveCategory})`);
          onClose();
        },
        onError: () => toast.error('Failed to create ingredient'),
      }
    );
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
      {categoryOptions.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Category {!selectedCategory && name && `(auto: ${autoCategory})`}
          </label>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={[{ value: '', label: 'Auto-assign' }, ...categoryOptions]}
            className="w-full"
          />
        </div>
      )}
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

interface RightPanelProps {
  outlets?: Outlet[];
}

export function RightPanel({ outlets }: RightPanelProps) {
  const { data: ingredients, isLoading: ingredientsLoading, error: ingredientsError } = useIngredients();
  const { data: recipes, isLoading: recipesLoading, error: recipesError } = useRecipes();
  const { data: categories } = useCategories();
  const { data: recipeCategories } = useRecipeCategories();
  const { data: allRecipeRecipeCategories } = useAllRecipeRecipeCategories();
  const { userId, userType } = useAppState();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('all');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
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

    return filtered;
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
    <aside className="flex h-full w-72 flex-col border-l border-border bg-secondary">
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
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

      {/* Category Filter - Only show for ingredients tab */}
      {(activeTab === 'all' || activeTab === 'ingredients') && categories && categories.length > 0 && (
        <div className="border-b border-border">
          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span>Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showCategoryFilter && "rotate-180")} />
          </button>

          {showCategoryFilter && (
            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {categories.filter(c => c.is_active).map((category) => (
                  <button
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded transition-colors',
                      selectedCategories.includes(category.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <button
                  onClick={clearCategoryFilters}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
                        Drag to add as item
                      </p>
                    )}
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
