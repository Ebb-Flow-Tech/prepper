'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateRecipeRequest, UpdateRecipeRequest, RecipeStatus } from '@/types';

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: api.getRecipes,
  });
}

export function useRecipe(id: number | null) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.getRecipe(id!),
    enabled: id !== null,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeRequest) => api.createRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRecipeRequest }) =>
      api.updateRecipe(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['costing', variables.id] });
    },
  });
}

export function useUpdateRecipeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: RecipeStatus }) =>
      api.updateRecipeStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useForkRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newOwnerId }: { id: number; newOwnerId?: string }) =>
      api.forkRecipe(id, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useRecipeVersions(recipeId: number | null, userId?: string | null) {
  return useQuery({
    queryKey: ['recipe-versions', recipeId, userId],
    queryFn: () => api.getRecipeVersions(recipeId!, userId),
    enabled: recipeId !== null,
  });
}

export interface GenerateImageResponse {
  image_url: string;
  stored: boolean;
}

export function useGenerateRecipeImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipeId,
      recipeName,
      ingredients,
    }: {
      recipeId?: number;
      recipeName: string;
      ingredients?: string[];
    }): Promise<GenerateImageResponse> => {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: recipeId,
          recipe_name: recipeName,
          ingredients,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate image');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate recipe queries if image was stored
      if (data.stored && variables.recipeId) {
        queryClient.invalidateQueries({ queryKey: ['recipe-images', variables.recipeId] });
      }
    },
  });
}

export function useRecipeImages(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipe-images', recipeId],
    queryFn: () => api.getRecipeImages(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useUploadRecipeImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, imageBase64 }: { recipeId: number; imageBase64: string }) =>
      api.uploadRecipeImage(recipeId, imageBase64),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-images', variables.recipeId] });
    },
  });
}

export function useMainRecipeImage(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipe-main-image', recipeId],
    queryFn: () => api.getMainRecipeImage(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useSetMainRecipeImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: number) => api.setMainRecipeImage(imageId),
    onSuccess: (data) => {
      // Invalidate queries related to this recipe's images and main image
      queryClient.invalidateQueries({ queryKey: ['recipe-images', data.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['recipe-main-image', data.recipe_id] });
    },
  });
}
