'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Upload, Download } from 'lucide-react'; // Upload/Download used in DropdownButton items
import { useIngredients, useDeactivateIngredient, useUpdateIngredient, useCategories, useCategoriesPaginated, useAllergens, useDebouncedValue } from '@/lib/hooks';
import { IngredientCard, IngredientListRow, CategoriesTab, FilterButtons, AddIngredientModal, AllergensTab, FMHIngredientImportModal, BuyCatalogueImportModal, ProductsTab } from '@/components/ingredients';
import SuppliersPage from '@/app/suppliers/page';
import { PageHeader, SearchInput, Select, GroupSection, ListSection, Button, Skeleton, ViewToggle, Checkbox, DropdownButton } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from 'sonner';
import type { Ingredient, Category } from '@/types';
import { useAppState, type IngredientTab } from '@/lib/store';
import { cn, triggerBlobDownload } from '@/lib/utils';
import { downloadFMHSampleItems, downloadBuyCatalogueTemplate } from '@/lib/api';

type GroupByOption = 'none' | 'unit' | 'status' | 'category';
type ViewType = 'grid' | 'list';
type SortByOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'unit', label: 'By unit' },
  { value: 'status', label: 'By status' },
  { value: 'category', label: 'By category' },
];

const SORT_BY_OPTIONS = [
  { value: 'name_asc', label: 'A to Z' },
  { value: 'name_desc', label: 'Z to A' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const INGREDIENT_TABS: { id: IngredientTab; label: string }[] = [
  { id: 'products', label: 'Products' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'categories', label: 'Tags (ingredients)' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'allergens', label: 'Allergens' },
];


function groupIngredients(
  ingredients: Ingredient[],
  groupBy: GroupByOption,
  categoryMap?: Map<number, string>
): Record<string, Ingredient[]> {
  if (groupBy === 'none') {
    return { 'All ingredients': ingredients };
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

  return { 'All ingredients': ingredients };
}

function IngredientsListTab() {
  const deactivateIngredient = useDeactivateIngredient();
  const updateIngredient = useUpdateIngredient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => setPageNumber(1), [debouncedSearch]);

  const [showForm, setShowForm] = useState(false);
  const [showFMHImport, setShowFMHImport] = useState(false);
  const [showBuyCatalogueImport, setShowBuyCatalogueImport] = useState(false);
  const [downloadingItems, setDownloadingItems] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');

  const handleDownloadSampleItems = async () => {
    setDownloadingItems(true);
    try {
      const blob = await downloadFMHSampleItems();
      triggerBlobDownload(blob, 'ProductList_sample.xlsx');
    } catch {
      toast.error('Failed to download sample product list file');
    } finally {
      setDownloadingItems(false);
    }
  };

  const handleDownloadBuyCatalogueTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadBuyCatalogueTemplate();
      triggerBlobDownload(blob, 'BuyCatalogue_template.xlsx');
    } catch {
      toast.error('Failed to download Buy Catalogue template');
    } finally {
      setDownloadingTemplate(false);
    }
  };
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedHalal, setSelectedHalal] = useState<boolean[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<number[]>([]);
  const [view, setView] = useState<ViewType>('grid');
  const [sortBy, setSortBy] = useState<SortByOption>('name_asc');
  // Reset page when filters change
  useEffect(() => setPageNumber(1), [selectedCategories, selectedUnits, selectedHalal, selectedAllergens, showArchived, sortBy]);

  const { data, isLoading, error } = useIngredients({
    active_only: !showArchived,
    page_size: 30,
    page_number: pageNumber,
    search: debouncedSearch || undefined,
    category_ids: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
    units: selectedUnits.length > 0 ? selectedUnits.join(',') : undefined,
    allergen_ids: selectedAllergens.length > 0 ? selectedAllergens.join(',') : undefined,
    is_halal: selectedHalal.length > 0 ? selectedHalal.map(String).join(',') : undefined,
    sort_by: sortBy,
  });
  const ingredients = data?.items ?? [];
  const { data: categories } = useCategories();
  const { data: allergens } = useAllergens();

  // Paginated categories for filter buttons (load more / append)
  const [filterCatPage, setFilterCatPage] = useState(1);
  const [filterCategories, setFilterCategories] = useState<Category[]>([]);
  useEffect(() => setFilterCatPage(1), [debouncedSearch]);
  const { data: filterCatData, isFetching: filterCatFetching } = useCategoriesPaginated({
    page_size: 10,
    page_number: filterCatPage,
    active_only: true,
    search: debouncedSearch || undefined,
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

  const filteredIngredients = ingredients ?? [];

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

  return (
    <div className="h-full w-full overflow-auto">
      {/* Always render modal so it doesn't unmount on query error */}
      <AddIngredientModal isOpen={showForm} onClose={() => setShowForm(false)} />
      <FMHIngredientImportModal isOpen={showFMHImport} onClose={() => setShowFMHImport(false)} />
      <BuyCatalogueImportModal isOpen={showBuyCatalogueImport} onClose={() => setShowBuyCatalogueImport(false)} />

      {error ? (
        <div className="p-6">
          <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
            Failed to load ingredients. Please try again.
          </div>
        </div>
      ) : (
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Ingredients"
          description="Browse and manage your ingredient library"
        >
          <div className="flex items-center gap-2">
            <DropdownButton
              label="FMH"
              items={[
                {
                  label: downloadingItems ? 'Downloading…' : 'Export product list',
                  icon: <Download className="h-3.5 w-3.5" />,
                  onClick: handleDownloadSampleItems,
                  disabled: downloadingItems,
                },
                {
                  label: 'Import',
                  icon: <Upload className="h-3.5 w-3.5" />,
                  onClick: () => setShowFMHImport(true),
                },
              ]}
            />
            <DropdownButton
              label="Buy Catalogue (FMH)"
              items={[
                {
                  label: downloadingTemplate ? 'Downloading…' : 'Download template',
                  icon: <Download className="h-3.5 w-3.5" />,
                  onClick: handleDownloadBuyCatalogueTemplate,
                  disabled: downloadingTemplate,
                },
                {
                  label: 'Import',
                  icon: <Upload className="h-3.5 w-3.5" />,
                  onClick: () => setShowBuyCatalogueImport(true),
                },
              ]}
            />
            <Button type="button" onClick={() => setShowForm(true)} disabled={showForm}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add ingredient</span>
            </Button>
          </div>
        </PageHeader>
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
            hasSearch={!!debouncedSearch}
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          )
        )}

        {/* Empty State */}
        {!isLoading && filteredIngredients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
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
      )}
    </div>
  );
}

function TabContent() {
  const { ingredientTab } = useAppState();

  switch (ingredientTab) {
    case 'products':
      return <ProductsTab />;
    case 'ingredients':
      return <IngredientsListTab />;
    case 'categories':
      return <CategoriesTab />;
    case 'suppliers':
      return <SuppliersPage />;
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
      <header className="shrink-0 border-b border-border bg-card">
        <nav className="flex gap-1 px-4" aria-label="Ingredient tabs">
          {INGREDIENT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setIngredientTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                ingredientTab === tab.id
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
