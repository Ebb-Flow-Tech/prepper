'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type {
  CreateIngredientRequest,
  AddSupplierIngredientRequest,
  UpdateSupplierIngredientRequest,
  UpdateIngredientRequest,
} from '@/types';

export function useIngredients(showArchived: boolean = false) {
  const activeOnly = !showArchived;
  return useQuery({
    queryKey: ['ingredients', { activeOnly }],
    queryFn: () => api.getIngredients(activeOnly),
  });
}

export function useIngredient(id: number | null) {
  return useQuery({
    queryKey: ['ingredient', id],
    queryFn: () => api.getIngredient(id!),
    enabled: id !== null,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateIngredientRequest) => api.createIngredient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<UpdateIngredientRequest>;
    }) => api.updateIngredient(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient', variables.id] });
    },
  });
}

export function useDeactivateIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deactivateIngredient(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient', id] });
    },
  });
}

// ============ Ingredient Suppliers ============

export function useIngredientSuppliers(ingredientId: number | null) {
  return useQuery({
    queryKey: ['ingredient-suppliers', ingredientId],
    queryFn: () => api.getIngredientSuppliers(ingredientId!),
    enabled: ingredientId !== null,
  });
}

export function useAddIngredientSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ingredientId,
      data,
    }: {
      ingredientId: number;
      data: AddSupplierIngredientRequest;
    }) => api.addIngredientSupplier(ingredientId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ingredient-suppliers', variables.ingredientId] });
      queryClient.invalidateQueries({ queryKey: ['ingredient', variables.ingredientId] });
    },
  });
}

export function useUpdateIngredientSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ingredientId,
      supplierIngredientId,
      data,
    }: {
      ingredientId: number;
      supplierIngredientId: number;
      data: UpdateSupplierIngredientRequest;
    }) => api.updateIngredientSupplier(ingredientId, supplierIngredientId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ingredient-suppliers', variables.ingredientId] });
      queryClient.invalidateQueries({ queryKey: ['ingredient', variables.ingredientId] });
    },
  });
}

export function useRemoveIngredientSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ingredientId,
      supplierIngredientId,
    }: {
      ingredientId: number;
      supplierIngredientId: number;
    }) => api.removeIngredientSupplier(ingredientId, supplierIngredientId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ingredient-suppliers', variables.ingredientId] });
      queryClient.invalidateQueries({ queryKey: ['ingredient', variables.ingredientId] });
    },
  });
}
