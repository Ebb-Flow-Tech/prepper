'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateRecipeCategoryRequest, UpdateRecipeCategoryRequest } from '@/types';

export function useRecipeCategories() {
  return useQuery({
    queryKey: ['recipeCategories'],
    queryFn: () => api.getRecipeCategories(),
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
