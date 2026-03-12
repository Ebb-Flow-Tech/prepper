'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateRecipeCategoryRequest, UpdateRecipeCategoryRequest } from '@/types';
import type { RecipeCategoryListParams } from '@/lib/api';

export function useRecipeCategories(params?: RecipeCategoryListParams) {
  return useQuery({
    queryKey: ['recipeCategories', params],
    queryFn: () => api.getRecipeCategories(params),
    placeholderData: (prev) => prev,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useRecipeCategory(id: number | null) {
  return useQuery({
    queryKey: ['recipeCategory', id],
    queryFn: () => api.getRecipeCategory(id!),
    enabled: id !== null,
  });
}

export function useCreateRecipeCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeCategoryRequest) => api.createRecipeCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipeCategories'] });
    },
  });
}

export function useUpdateRecipeCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateRecipeCategoryRequest;
    }) => api.updateRecipeCategory(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipeCategories'] });
      queryClient.invalidateQueries({ queryKey: ['recipeCategory', variables.id] });
    },
  });
}

export function useDeleteRecipeCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteRecipeCategory(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['recipeCategories'] });
      queryClient.invalidateQueries({ queryKey: ['recipeCategory', id] });
    },
  });
}
