'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type {
  AddRecipeIngredientRequest,
  UpdateRecipeIngredientRequest,
  ReorderIngredientsRequest,
} from '@/types';

export function useRecipeIngredients(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipeIngredients', recipeId],
    queryFn: () => api.getRecipeIngredients(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useAddRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      data,
    }: {
      recipeId: number;
      data: AddRecipeIngredientRequest;
    }) => api.addRecipeIngredient(recipeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['recipeIngredients', variables.recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['costing', variables.recipeId],
      });
    },
  });
}

export function useUpdateRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      ingredientId,
      data,
    }: {
      recipeId: number;
      ingredientId: number;
      data: UpdateRecipeIngredientRequest;
    }) => api.updateRecipeIngredient(recipeId, ingredientId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['recipeIngredients', variables.recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['costing', variables.recipeId],
      });
    },
  });
}

export function useRemoveRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      ingredientId,
    }: {
      recipeId: number;
      ingredientId: number;
    }) => api.removeRecipeIngredient(recipeId, ingredientId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['recipeIngredients', variables.recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['costing', variables.recipeId],
      });
    },
  });
}

export function useReorderRecipeIngredients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      data,
    }: {
      recipeId: number;
      data: ReorderIngredientsRequest;
    }) => api.reorderRecipeIngredients(recipeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['recipeIngredients', variables.recipeId],
      });
    },
  });
}
