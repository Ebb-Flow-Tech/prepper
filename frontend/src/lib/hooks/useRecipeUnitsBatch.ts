'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppState } from '@/lib/store';
import * as api from '@/lib/api';

/**
 * The unit (brand/outlet) chips for a list of recipes, in one request.
 *
 * Backs the per-recipe brand chips on card and management list views — replaces the removed
 * `/recipes/outlets/batch`. Scoped server-side to the caller's accessible units, so it never renders
 * a brand the user has no role at. Keyed by the sorted recipe id set so the cache is stable
 * regardless of the order a list hands them in.
 */
export function useRecipeUnitsBatch(recipeIds: number[] | null) {
  const { userId } = useAppState();
  const ids = recipeIds ?? [];
  const key = [...ids].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['recipe-units-batch', key, userId],
    queryFn: () => api.getRecipeUnitsBatch(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000, // unit placement changes rarely; it arrives via sync, not polling
  });
}
