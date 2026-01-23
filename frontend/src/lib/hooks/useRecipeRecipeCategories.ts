'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateRecipeRecipeCategoryRequest, UpdateRecipeRecipeCategoryRequest } from '@/types';

export function useCategoryRecipes(categoryId: number | null) {
  return useQuery({
    queryKey: ['categoryRecipes', categoryId],
    queryFn: () => api.getCategoryRecipes(categoryId!),
    enabled: categoryId !== null,
  });
}

export function useRecipeCategoryLinks(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipeCategoryLinks', recipeId],
    queryFn: () => api.getRecipeCategoryLinks(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useAddRecipeToCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeRecipeCategoryRequest) =>
      api.addRecipeToCategory(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categoryRecipes', variables.category_id] });
      queryClient.invalidateQueries({ queryKey: ['recipeCategoryLinks', variables.recipe_id] });
    },
  });
}

export function useUpdateRecipeCategoryLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      linkId,
      data,
    }: {
      linkId: number;
      data: UpdateRecipeRecipeCategoryRequest;
    }) => api.updateRecipeCategoryLink(linkId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['categoryRecipes', result.category_id] });
      queryClient.invalidateQueries({ queryKey: ['recipeCategoryLinks', result.recipe_id] });
    },
  });
}

export function useRemoveRecipeFromCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      linkId,
      categoryId,
      recipeId,
    }: {
      linkId: number;
      categoryId: number;
      recipeId: number;
    }) => api.removeRecipeFromCategory(linkId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categoryRecipes', variables.categoryId] });
      queryClient.invalidateQueries({ queryKey: ['recipeCategoryLinks', variables.recipeId] });
    },
  });
}

export function useAllRecipeRecipeCategories() {
  return useQuery({
    queryKey: ['allRecipeRecipeCategories'],
    queryFn: () => api.getAllRecipeRecipeCategories(),
  });
}
