'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useIngredients, useDeactivateIngredient, useUpdateIngredient, useCategories, useCategoriesPaginated, useAllergens, useDebouncedValue } from '@/lib/hooks';
import { IngredientCard, IngredientListRow, CategoriesTab, FilterButtons, AddIngredientModal, AllergensTab } from '@/components/ingredients';
import { PageHeader, SearchInput, Select, GroupSection, ListSection, Button, Skeleton, ViewToggle, Checkbox } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from 'sonner';
import type { Ingredient, Category } from '@/types';
import { useAppState, type IngredientTab } from '@/lib/store';
import { cn } from '@/lib/utils';

type GroupByOption = 'none' | 'unit' | 'status' | 'category';
type ViewType = 'grid' | 'list';
type SortByOption = 'price_asc' | 'price_desc';

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'unit', label: 'By Unit' },
  { value: 'status', label: 'By Status' },
  { value: 'category', label: 'By Category' },
];

const SORT_BY_OPTIONS = [
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

const INGREDIENT_TABS: { id: IngredientTab; label: string }[] = [
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'categories', label: 'Categories' },
  { id: 'allergens', label: 'Allergens' },
];

function sortIngredients(ingredients: Ingredient[], sortBy: SortByOption): Ingredient[] {
  const withCost: Ingredient[] = [];
  const noCost: Ingredient[] = [];

  ingredients.forEach((ing) => {
    if (ing.cost_per_base_unit !== null && ing.cost_per_base_unit !== undefined) {
      withCost.push(ing);
    } else {
      noCost.push(ing);
    }
  });

  if (sortBy === 'price_asc') {
    withCost.sort((a, b) => (a.cost_per_base_unit ?? 0) - (b.cost_per_base_unit ?? 0));
  } else if (sortBy === 'price_desc') {
    withCost.sort((a, b) => (b.cost_per_base_unit ?? 0) - (a.cost_per_base_unit ?? 0));
  }

  return [...withCost, ...noCost];
}

function groupIngredients(
  ingredients: Ingredient[],
  groupBy: GroupByOption,
  categoryMap?: Map<number, string>
): Record<string, Ingredient[]> {
  if (groupBy === 'none') {
    return { 'All Ingredients': ingredients };
  }

  if (groupBy === 'unit') {
    return ingredients.reduce((acc, ingredient) => {
      const key = ingredient.base_unit || 'No unit';
      if (!acc[key]) acc[key] = [];
      acc[key].push(ingredient);
      return acc;
    }, {} as Record<string, Ingredient[]>);
  }

  if (groupBy === 'status') {
    return ingredients.reduce((acc, ingredient) => {
      const key = ingredient.is_active ? 'Active' : 'Archived';
      if (!acc[key]) acc[key] = [];
      acc[key].push(ingredient);
      return acc;
    }, {} as Record<string, Ingredient[]>);
  }

  if (groupBy === 'category') {
    return ingredients.reduce((acc, ingredient) => {
      const key = ingredient.category_id
        ? categoryMap?.get(ingredient.category_id) ?? 'Unknown'
        : 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(ingredient);
      return acc;
    }, {} as Record<string, Ingredient[]>);
  }

  return { 'All Ingredients': ingredients };
}

function IngredientsListTab() {
  const deactivateIngredient = useDeactivateIngredient();
  const updateIngredient = useUpdateIngredient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => setPageNumber(1), [debouncedSearch]);

  const [showForm, setShowForm] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedHalal, setSelectedHalal] = useState<boolean[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<number[]>([]);
  const [view, setView] = useState<ViewType>('grid');
  const [sortBy, setSortBy] = useState<SortByOption>('price_asc');
  // Reset page when filters change
  useEffect(() => setPageNumber(1), [selectedCategories, selectedUnits, selectedHalal, selectedAllergens, showArchived]);

  const { data, isLoading, error } = useIngredients({
    active_only: !showArchived,
    page_size: 30,
    page_number: pageNumber,
    search: debouncedSearch || undefined,
    category_ids: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
    units: selectedUnits.length > 0 ? selectedUnits.join(',') : undefined,
    allergen_ids: selectedAllergens.length > 0 ? selectedAllergens.join(',') : undefined,
    is_halal: selectedHalal.length > 0 ? selectedHalal.map(String).join(',') : undefined,
  });
  const ingredients = data?.items ?? [];
  const { data: categories } = useCategories();
  const { data: allergens } = useAllergens();

  // Paginated categories for filter buttons (load more / append)
  const [filterCatPage, setFilterCatPage] = useState(1);
  const [filterCategories, setFilterCategories] = useState<Category[]>([]);
  const { data: filterCatData, isFetching: filterCatFetching } = useCategoriesPaginated({
    page_size: 10,
    page_number: filterCatPage,
    active_only: true,
  });
  useEffect(() => {
    if (filterCatData?.items && !filterCatFetching) {
      if (filterCatData.page_number === 1) {
        setFilterCategories(filterCatData.items);
      } else {
        setFilterCategories((prev) => [...prev, ...filterCatData.items]);
      }
    }
  }, [filterCatData, filterCatFetching]);
  const hasMoreFilterCategories = filterCatData
    ? filterCategories.length < filterCatData.total_count
    : false;

  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];
    return sortIngredients(ingredients, sortBy);
  }, [ingredients, sortBy]);

  const categoryMap = useMemo(() => {
    if (!categories) return new Map<number, string>();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const groupedIngredients = useMemo(() => {
    return groupIngredients(filteredIngredients, groupBy, categoryMap);
  }, [filteredIngredients, groupBy, categoryMap]);

  const handleArchive = (ingredient: Ingredient) => {
    deactivateIngredient.mutate(ingredient.id, {
      onSuccess: () => toast.success(`${ingredient.name} archived`),
      onError: () => toast.error(`Failed to archive ${ingredient.name}`),
    });
  };

  const handleUnarchive = (ingredient: Ingredient) => {
    updateIngredient.mutate(
      { id: ingredient.id, data: { is_active: true } },
      {
        onSuccess: () => toast.success(`${ingredient.name} unarchived`),
        onError: () => toast.error(`Failed to unarchive ${ingredient.name}`),
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load ingredients. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Ingredients"
          description="Browse and manage your ingredient library"
        >
          <Button onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Ingredient</span>
          </Button>
        </PageHeader>
        <AddIngredientModal isOpen={showForm} onClose={() => setShowForm(false)} />
        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search ingredients..."
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
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
              options={GROUP_BY_OPTIONS}
              className="w-36"
            />

            <Checkbox
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              label="Show archived"
            />

            <ViewToggle view={view} onViewChange={setView} />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6">
          <FilterButtons
            categories={filterCategories}
            hasMoreCategories={hasMoreFilterCategories}
            onLoadMoreCategories={() => setFilterCatPage((p) => p + 1)}
            isLoadingMoreCategories={filterCatFetching}
            selectedCategories={selectedCategories}
            onCategoryChange={setSelectedCategories}
            selectedUnits={selectedUnits}
            onUnitChange={setSelectedUnits}
            selectedHalal={selectedHalal}
            onHalalChange={setSelectedHalal}
            allergens={allergens}
            selectedAllergens={selectedAllergens}
            onAllergenChange={setSelectedAllergens}
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
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
        {!isLoading && filteredIngredients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search || selectedCategories.length > 0 || selectedUnits.length > 0 || selectedHalal.length > 0 || selectedAllergens.length > 0
                ? 'No ingredients match your filters'
                : 'No ingredients yet'}
            </p>
          </div>
        )}

        {/* Grouped Ingredients */}
        {!isLoading && filteredIngredients.length > 0 && (
          <div>
            {Object.entries(groupedIngredients).map(([group, items]) =>
              view === 'grid' ? (
                <GroupSection key={group} title={group} count={items.length}>
                  {items.map((ingredient) => (
                    <IngredientCard
                      key={ingredient.id}
                      ingredient={ingredient}
                      categories={categories}
                      onArchive={handleArchive}
                      onUnarchive={handleUnarchive}
                    />
                  ))}
                </GroupSection>
              ) : (
                <ListSection key={group} title={group} count={items.length}>
                  {items.map((ingredient) => (
                    <IngredientListRow
                      key={ingredient.id}
                      ingredient={ingredient}
                      categories={categories}
                      onArchive={handleArchive}
                      onUnarchive={handleUnarchive}
                    />
                  ))}
                </ListSection>
              )
            )}
          </div>
        )}

        {/* Pagination */}
        {data && (
          <Pagination
            pageNumber={data.page_number}
            totalPages={data.total_pages}
            totalCount={data.total_count}
            currentPageSize={data.current_page_size}
            onPageChange={setPageNumber}
          />
        )}
      </div>
    </div>
  );
}

function TabContent() {
  const { ingredientTab } = useAppState();

  switch (ingredientTab) {
    case 'ingredients':
      return <IngredientsListTab />;
    case 'categories':
      return <CategoriesTab />;
    case 'allergens':
      return <AllergensTab />;
    default:
      return <IngredientsListTab />;
  }
}

export default function IngredientsPage() {
  const { ingredientTab, setIngredientTab } = useAppState();

  return (
    <div className="flex h-full flex-col">
      {/* Tab Navigation Header */}
      <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex gap-1 px-4" aria-label="Ingredient tabs">
          {INGREDIENT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setIngredientTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                ingredientTab === tab.id
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Tab Content */}
      <div className="flex flex-1 overflow-hidden">
        <TabContent />
      </div>
    </div>
  );
}
