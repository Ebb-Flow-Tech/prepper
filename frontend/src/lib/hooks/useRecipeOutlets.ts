'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { UpdateRecipeOutletRequest } from '@/types';

export function useOutletRecipes(outletId: number | null, isActive: boolean | null = null) {
  return useQuery({
    queryKey: ['outletRecipes', outletId, { isActive }],
    queryFn: () => api.getOutletRecipes(outletId!, isActive),
    enabled: outletId !== null,
  });
}

export function useRecipeOutlets(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipeOutlets', recipeId],
    queryFn: () => api.getRecipeOutlets(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useAddRecipeToOutlet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      data,
    }: {
      recipeId: number;
      data: { outlet_id: number; is_active?: boolean; price_override?: number | null };
    }) => api.addRecipeToOutlet(recipeId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outletRecipes', variables.data.outlet_id] });
      queryClient.invalidateQueries({ queryKey: ['recipeOutlets', variables.recipeId] });
    },
  });
}

export function useUpdateRecipeOutlet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      outletId,
      data,
    }: {
      recipeId: number;
      outletId: number;
      data: UpdateRecipeOutletRequest;
    }) => api.updateRecipeOutlet(recipeId, outletId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outletRecipes', variables.outletId] });
      queryClient.invalidateQueries({ queryKey: ['recipeOutlets', variables.recipeId] });
    },
  });
}

export function useRemoveRecipeFromOutlet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      outletId,
    }: {
      recipeId: number;
      outletId: number;
    }) => api.removeRecipeFromOutlet(recipeId, outletId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outletRecipes', variables.outletId] });
      queryClient.invalidateQueries({ queryKey: ['recipeOutlets', variables.recipeId] });
    },
  });
}

export function useRecipeOutletsBatch(recipeIds: number[] | null) {
  return useQuery({
    queryKey: ['recipeOutletsBatch', recipeIds ? recipeIds.sort() : null],
    queryFn: () => api.getRecipeOutletsBatch(recipeIds!),
    enabled: recipeIds !== null && recipeIds.length > 0,
  });
}
