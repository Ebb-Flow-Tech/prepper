'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateRecipeUnitRequest, UpdateRecipeUnitRequest } from '@/types';

/**
 * Recipe <-> Passport unit links.
 *
 * The units themselves are Passport's — read them with `usePassportBrands()`. These hooks only say
 * which units a recipe is served at. Writing requires `Manager` at that unit, which the backend
 * checks per unit; there is no global manager to test for here.
 */

const RECIPE_UNITS_KEY = 'recipeUnits';

export function useRecipeUnits(recipeId: number | null) {
  return useQuery({
    queryKey: [RECIPE_UNITS_KEY, recipeId],
    queryFn: () => api.getRecipeUnits(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useAddRecipeToUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, data }: { recipeId: number; data: CreateRecipeUnitRequest }) =>
      api.addRecipeToUnit(recipeId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECIPE_UNITS_KEY, variables.recipeId] });
    },
  });
}

export function useUpdateRecipeUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      unitId,
      data,
    }: {
      recipeId: number;
      unitId: string;
      data: UpdateRecipeUnitRequest;
    }) => api.updateRecipeUnit(recipeId, unitId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECIPE_UNITS_KEY, variables.recipeId] });
    },
  });
}

export function useRemoveRecipeFromUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, unitId }: { recipeId: number; unitId: string }) =>
      api.removeRecipeFromUnit(recipeId, unitId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECIPE_UNITS_KEY, variables.recipeId] });
    },
  });
}
