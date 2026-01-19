'use client';

import { cn } from '@/lib/utils';
import type { Category } from '@/types';

const UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'pcs', label: 'pcs' },
];

interface FilterButtonsProps {
  categories: Category[] | undefined;
  selectedCategories: number[];
  onCategoryChange: (categoryIds: number[]) => void;
  selectedUnits: string[];
  onUnitChange: (units: string[]) => void;
}

export function FilterButtons({
  categories,
  selectedCategories,
  onCategoryChange,
  selectedUnits,
  onUnitChange,
}: FilterButtonsProps) {
  const toggleCategory = (categoryId: number) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  const toggleUnit = (unit: string) => {
    if (selectedUnits.includes(unit)) {
      onUnitChange(selectedUnits.filter((u) => u !== unit));
    } else {
      onUnitChange([...selectedUnits, unit]);
    }
  };

  const activeCategories = categories?.filter((c) => c.is_active) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Category Filters */}
      {activeCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">
            Category:
          </span>
          {activeCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                selectedCategories.includes(category.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Unit Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">
          Unit:
        </span>
        {UNIT_OPTIONS.map((unit) => (
          <button
            key={unit.value}
            onClick={() => toggleUnit(unit.value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              selectedUnits.includes(unit.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            )}
          >
            {unit.label}
          </button>
        ))}
      </div>
    </div>
  );
}
