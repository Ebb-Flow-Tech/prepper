'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllergens,
  getAllergen,
  createAllergen,
  updateAllergen,
  deleteAllergen,
  getIngredientAllergenLinks,
  getAllergensByIngredient,
  getIngredientsByAllergen,
  addIngredientAllergen,
  deleteIngredientAllergen,
  getRecipeAllergens,
  getRecipeAllergensBatch,
} from '../api';
import { Allergen, IngredientAllergen, AllergenCreate, AllergenUpdate, IngredientAllergenCreate } from '@/types';

// ============ Allergen CRUD Hooks ============

export function useAllergens(showArchived: boolean = false) {
  return useQuery<Allergen[]>({
    queryKey: ['allergens', { activeOnly: !showArchived }],
    queryFn: () => getAllergens(!showArchived),
  });
}

export function useAllergen(id: number | null) {
  return useQuery<Allergen>({
    queryKey: ['allergen', id],
    queryFn: () => getAllergen(id!),
    enabled: id !== null,
  });
}

export function useCreateAllergen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AllergenCreate) => createAllergen(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
    },
  });
}

export function useUpdateAllergen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AllergenUpdate }) =>
      updateAllergen(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
      queryClient.invalidateQueries({ queryKey: ['allergen', data.id] });
    },
  });
}

export function useDeleteAllergen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAllergen(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
      queryClient.invalidateQueries({ queryKey: ['allergen', data.id] });
    },
  });
}

// ============ Ingredient-Allergen Link Hooks ============

export function useIngredientAllergenLinks() {
  return useQuery<IngredientAllergen[]>({
    queryKey: ['ingredient-allergen-links'],
    queryFn: () => getIngredientAllergenLinks(),
  });
}

export function useAllergensByIngredient(ingredientId: number | null) {
  return useQuery<IngredientAllergen[]>({
    queryKey: ['ingredient-allergens', ingredientId],
    queryFn: () => getAllergensByIngredient(ingredientId!),
    enabled: ingredientId !== null,
  });
}

export function useIngredientsByAllergen(allergenId: number | null) {
  return useQuery<IngredientAllergen[]>({
    queryKey: ['allergen-ingredients', allergenId],
    queryFn: () => getIngredientsByAllergen(allergenId!),
    enabled: allergenId !== null,
  });
}

export function useAddIngredientAllergen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IngredientAllergenCreate) => addIngredientAllergen(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredient-allergen-links'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-allergens'] });
      queryClient.invalidateQueries({ queryKey: ['allergen-ingredients'] });
    },
  });
}

export function useDeleteIngredientAllergen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: number) => deleteIngredientAllergen(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredient-allergen-links'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-allergens'] });
      queryClient.invalidateQueries({ queryKey: ['allergen-ingredients'] });
    },
  });
}

// ============ Recipe-Allergen Hooks ============

export function useRecipeAllergens(recipeId: number | null) {
  return useQuery<Allergen[]>({
    queryKey: ['recipe-allergens', recipeId],
    queryFn: () => getRecipeAllergens(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useRecipeAllergensBatch(recipeIds: number[] | null) {
  return useQuery({
    queryKey: ['recipe-allergens-batch', recipeIds ? [...recipeIds].sort() : null],
    queryFn: () => getRecipeAllergensBatch(recipeIds!),
    enabled: recipeIds !== null && recipeIds.length > 0,
  });
}
