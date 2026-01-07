'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { SubRecipeCreate, SubRecipeUpdate, SubRecipeReorder } from '@/types';

export function useSubRecipes(recipeId: number | null) {
  return useQuery({
    queryKey: ['subRecipes', recipeId],
    queryFn: () => api.getSubRecipes(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useAddSubRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      data,
    }: {
      recipeId: number;
      data: SubRecipeCreate;
    }) => api.addSubRecipe(recipeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['subRecipes', variables.recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['costing', variables.recipeId],
      });
    },
  });
}

export function useUpdateSubRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      linkId,
      data,
    }: {
      recipeId: number;
      linkId: number;
      data: SubRecipeUpdate;
    }) => api.updateSubRecipe(recipeId, linkId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['subRecipes', variables.recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['costing', variables.recipeId],
      });
    },
  });
}

export function useRemoveSubRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      linkId,
    }: {
      recipeId: number;
      linkId: number;
    }) => api.removeSubRecipe(recipeId, linkId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['subRecipes', variables.recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['costing', variables.recipeId],
      });
    },
  });
}

export function useReorderSubRecipes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      data,
    }: {
      recipeId: number;
      data: SubRecipeReorder;
    }) => api.reorderSubRecipes(recipeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['subRecipes', variables.recipeId],
      });
    },
  });
}
