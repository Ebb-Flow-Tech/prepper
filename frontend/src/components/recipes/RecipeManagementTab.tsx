'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useRecipes } from '@/lib/hooks';
import { RecipeCard } from './RecipeCard';
import { RecipeListRow } from './RecipeListRow';
import { PageHeader, SearchInput, Select, GroupSection, ListSection, Button, Skeleton, ViewToggle } from '@/components/ui';
import { useAppState } from '@/lib/store';
import type { Recipe, RecipeStatus } from '@/types';

type GroupByOption = 'none' | 'status';
type StatusFilter = 'all' | RecipeStatus;
type ViewType = 'grid' | 'list';
type SortByOption = 'price_asc' | 'price_desc';

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'By Status' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const SORT_BY_OPTIONS = [
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

function sortRecipes(recipes: Recipe[], sortBy: SortByOption): Recipe[] {
  const withCost: Recipe[] = [];
  const noCost: Recipe[] = [];

  recipes.forEach((recipe) => {
    if (recipe.cost_price !== null && recipe.cost_price !== undefined) {
      withCost.push(recipe);
    } else {
      noCost.push(recipe);
    }
  });

  if (sortBy === 'price_asc') {
    withCost.sort((a, b) => (a.cost_price ?? 0) - (b.cost_price ?? 0));
  } else if (sortBy === 'price_desc') {
    withCost.sort((a, b) => (b.cost_price ?? 0) - (a.cost_price ?? 0));
  }

  return [...withCost, ...noCost];
}

function groupRecipes(recipes: Recipe[], groupBy: GroupByOption): Record<string, Recipe[]> {
  if (groupBy === 'none') {
    return { 'All Recipes': recipes };
  }

  if (groupBy === 'status') {
    const grouped: Record<string, Recipe[]> = {
      'Active': [],
      'Draft': [],
      'Archived': [],
    };

    recipes.forEach((recipe) => {
      const key = recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1);
      if (grouped[key]) {
        grouped[key].push(recipe);
      }
    });

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(grouped).filter(([, items]) => items.length > 0)
    );
  }

  return { 'All Recipes': recipes };
}

export function RecipeManagementTab() {
  const router = useRouter();
  const { userId, userType, selectRecipe, setCanvasTab } = useAppState();
  const { data: recipes, isLoading, error } = useRecipes();

  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('status');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewType>('grid');
  const [sortBy, setSortBy] = useState<SortByOption>('price_asc');

  // Filter and group recipes
  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];

    const filtered = recipes.filter((recipe) => {
      // Filter by search
      if (search && !recipe.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Filter by status
      if (statusFilter !== 'all' && recipe.status !== statusFilter) {
        return false;
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

    return sortRecipes(filtered, sortBy);
  }, [recipes, search, statusFilter, userId, userType, sortBy]);

  const handleCreate = () => {
    // Clear selected recipe and navigate to canvas for new recipe creation
    selectRecipe(null);
    router.push('/recipes/new');
  };

  const groupedRecipes = useMemo(() => {
    return groupRecipes(filteredRecipes, groupBy);
  }, [filteredRecipes, groupBy]);

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
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Recipes"
          description="Browse and manage your recipe collection"
        >
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Recipe</span>
          </Button>
        </PageHeader>

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
              options={SORT_BY_OPTIONS}
              className="w-44"
            />

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={STATUS_FILTER_OPTIONS}
              className="w-32"
            />

            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
              options={GROUP_BY_OPTIONS}
              className="w-36"
            />

            <ViewToggle view={view} onViewChange={setView} />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          )
        )}

        {/* Empty State */}
        {!isLoading && filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No recipes match your search' : 'No recipes yet'}
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
              Create your first recipe in the Canvas
            </p>
          </div>
        )}

        {/* Grouped Recipes */}
        {!isLoading && filteredRecipes.length > 0 && (
          <div>
            {Object.entries(groupedRecipes).map(([group, items]) =>
              view === 'grid' ? (
                <GroupSection key={group} title={group} count={items.length}>
                  {items.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      isOwned={userId !== null && recipe.owner_id === userId}
                    />
                  ))}
                </GroupSection>
              ) : (
                <ListSection key={group} title={group} count={items.length}>
                  {items.map((recipe) => (
                    <RecipeListRow
                      key={recipe.id}
                      recipe={recipe}
                      isOwned={userId !== null && recipe.owner_id === userId}
                    />
                  ))}
                </ListSection>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
