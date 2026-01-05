'use client';

import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useIngredients, useDeactivateIngredient, useUpdateIngredient } from '@/lib/hooks';
import { IngredientCard } from '@/components/ingredients';
import { PageHeader, SearchInput, Select, GroupSection, Button, Skeleton } from '@/components/ui';
import { toast } from 'sonner';
import type { Ingredient } from '@/types';
import { NewIngredientForm } from '@/components/layout/RightPanel';

type GroupByOption = 'none' | 'unit' | 'status';

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'unit', label: 'By Unit' },
  { value: 'status', label: 'By Status' },
];

function groupIngredients(ingredients: Ingredient[], groupBy: GroupByOption): Record<string, Ingredient[]> {
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

  return { 'All Ingredients': ingredients };
}

export default function IngredientsPage() {
  const deactivateIngredient = useDeactivateIngredient();
  const updateIngredient = useUpdateIngredient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [showArchived, setShowArchived] = useState(false);
  const { data: ingredients, isLoading, error } = useIngredients(showArchived);

  // Filter and group ingredients
  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];

    return ingredients.filter((ing) => {
      // Filter by search
      if (search && !ing.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [ingredients, search, showArchived]);

  const groupedIngredients = useMemo(() => {
    return groupIngredients(filteredIngredients, groupBy);
  }, [filteredIngredients, groupBy]);

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
    <div className="h-full overflow-auto">
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
        {showForm && (
          <div className="w-full d-flex justify-items-end">
            <div className="w-fit mb-3">
              <NewIngredientForm onClose={() => setShowForm(false)} />
            </div>
          </div>

        )}
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
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
              options={GROUP_BY_OPTIONS}
              className="w-36"
            />

            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              Show archived
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredIngredients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No ingredients match your search' : 'No ingredients yet'}
            </p>
          </div>
        )}

        {/* Grouped Ingredients */}
        {!isLoading && filteredIngredients.length > 0 && (
          <div>
            {Object.entries(groupedIngredients).map(([group, items]) => (
              <GroupSection key={group} title={group} count={items.length}>
                {items.map((ingredient) => (
                  <IngredientCard
                    key={ingredient.id}
                    ingredient={ingredient}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                  />
                ))}
              </GroupSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
