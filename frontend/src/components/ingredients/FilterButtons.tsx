'use client';

import { cn } from '@/lib/utils';
import type { Category, Allergen } from '@/types';

const UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'pcs', label: 'pcs' },
];

interface FilterButtonsProps {
  categories: Category[] | undefined;
  hasMoreCategories?: boolean;
  onLoadMoreCategories?: () => void;
  isLoadingMoreCategories?: boolean;
  selectedCategories: number[];
  onCategoryChange: (categoryIds: number[]) => void;
  selectedUnits: string[];
  onUnitChange: (units: string[]) => void;
  selectedHalal: boolean[];
  onHalalChange: (halal: boolean[]) => void;
  allergens: Allergen[] | undefined;
  selectedAllergens: number[];
  onAllergenChange: (allergenIds: number[]) => void;
  hasSearch?: boolean;
}

export function FilterButtons({
  categories,
  hasMoreCategories,
  onLoadMoreCategories,
  isLoadingMoreCategories,
  selectedCategories,
  onCategoryChange,
  selectedUnits,
  onUnitChange,
  selectedHalal,
  onHalalChange,
  allergens,
  selectedAllergens,
  onAllergenChange,
  hasSearch = false,
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

  const toggleHalal = (isHalal: boolean) => {
    if (selectedHalal.includes(isHalal)) {
      onHalalChange(selectedHalal.filter((h) => h !== isHalal));
    } else {
      onHalalChange([...selectedHalal, isHalal]);
    }
  };

  const toggleAllergen = (allergenId: number) => {
    if (selectedAllergens.includes(allergenId)) {
      onAllergenChange(selectedAllergens.filter((id) => id !== allergenId));
    } else {
      onAllergenChange([...selectedAllergens, allergenId]);
    }
  };

  const activeCategories = categories?.filter((c) => c.is_active) ?? [];
  const activeAllergens = allergens?.filter((a) => a.is_active) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Category Filters */}
      {activeCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            {hasSearch ? 'Matching tags:' : 'Category:'}
          </span>
          {activeCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                selectedCategories.includes(category.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              )}
            >
              {category.name}
            </button>
          ))}
          {hasMoreCategories && (
            <button
              onClick={onLoadMoreCategories}
              disabled={isLoadingMoreCategories}
              className="px-3 py-1 text-xs font-medium rounded-full text-muted-foreground hover:text-foreground underline transition-colors disabled:opacity-50"
            >
              {isLoadingMoreCategories ? 'Loading...' : 'See more'}
            </button>
          )}
        </div>
      )}

      {/* Unit Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">
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
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            )}
          >
            {unit.label}
          </button>
        ))}
      </div>

      {/* Halal Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">
          Halal:
        </span>
        <button
          onClick={() => toggleHalal(true)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
            selectedHalal.includes(true)
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-muted'
          )}
        >
          Halal
        </button>
        <button
          onClick={() => toggleHalal(false)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
            selectedHalal.includes(false)
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-muted'
          )}
        >
          Non-halal
        </button>
      </div>

      {/* Allergen Filters */}
      {activeAllergens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Allergens:
          </span>
          {activeAllergens.map((allergen) => (
            <button
              key={allergen.id}
              onClick={() => toggleAllergen(allergen.id)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                selectedAllergens.includes(allergen.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              )}
            >
              {allergen.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
