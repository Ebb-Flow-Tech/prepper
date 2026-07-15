'use client';

import { useMemo } from 'react';
import { Select } from '@/components/ui';
import { usePassportBrands } from '@/lib/hooks';
import type { PassportBrand } from '@/types';

/**
 * Picker for a Passport unit (a brand). Prepper cannot create or edit brands — they come from
 * Passport, projected read-only — so this only ever selects one.
 *
 * `managerOnly` narrows the list to the brands where the caller's role AT THAT BRAND is `Manager`.
 * The role is always read per-brand: a user may manage one brand and merely work at another, so
 * there is no global "is manager" question to ask.
 */

const MANAGER_ROLE = 'Manager';

export function useSelectableBrands(managerOnly = false): {
  brands: PassportBrand[];
  isLoading: boolean;
} {
  const { data, isLoading } = usePassportBrands();
  const brands = useMemo(() => {
    const all = data ?? [];
    const visible = all.filter((brand) => brand.my_role !== null);
    return managerOnly ? visible.filter((brand) => brand.my_role === MANAGER_ROLE) : visible;
  }, [data, managerOnly]);

  return { brands, isLoading };
}

interface BrandSelectProps {
  value: string;
  onChange: (unitId: string) => void;
  /** Only offer brands where the caller is `Manager` at that brand. */
  managerOnly?: boolean;
  /** Unit ids to leave out (e.g. already linked). */
  excludeUnitIds?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function BrandSelect({
  value,
  onChange,
  managerOnly = false,
  excludeUnitIds = [],
  placeholder = 'Select brand...',
  disabled = false,
  className,
}: BrandSelectProps) {
  const { brands, isLoading } = useSelectableBrands(managerOnly);

  const options = useMemo(() => {
    const excluded = new Set(excludeUnitIds);
    return [
      { value: '', label: isLoading ? 'Loading brands...' : placeholder },
      ...brands
        .filter((brand) => !excluded.has(brand.id))
        .map((brand) => ({ value: brand.id, label: brand.name })),
    ];
  }, [brands, excludeUnitIds, isLoading, placeholder]);

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      disabled={disabled || isLoading}
      className={className}
    />
  );
}

/** Map of unit id -> brand name, for labelling links that only carry a unit id. */
export function useBrandNames(): Map<string, string> {
  const { data } = usePassportBrands();
  return useMemo(
    () => new Map((data ?? []).map((brand) => [brand.id, brand.name])),
    [data]
  );
}
