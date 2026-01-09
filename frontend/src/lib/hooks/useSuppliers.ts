'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateSupplierRequest, UpdateSupplierRequest, UpdateSupplierIngredientRequest } from '@/types';

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: api.getSuppliers,
  });
}

export function useSupplier(id: number) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => api.getSupplier(id),
    enabled: !isNaN(id),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierRequest) => api.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSupplierRequest }) =>
      api.updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

// ============ Supplier Ingredients ============

export function useSupplierIngredients(supplierId: number) {
  return useQuery({
    queryKey: ['suppliers', supplierId, 'ingredients'],
    queryFn: () => api.getSupplierIngredients(supplierId),
    enabled: !isNaN(supplierId),
  });
}

export function useAddSupplierIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      supplierId,
      data,
    }: {
      supplierId: number;
      data: {
        ingredient_id: number;
        supplier_name: string;
        sku?: string | null;
        pack_size: number;
        pack_unit: string;
        price_per_pack: number;
        cost_per_unit: number;
        is_preferred?: boolean;
      };
    }) =>
      api.addIngredientSupplier(data.ingredient_id, {
        supplier_id: supplierId.toString(),
        supplier_name: data.supplier_name,
        sku: data.sku,
        pack_size: data.pack_size,
        pack_unit: data.pack_unit,
        price_per_pack: data.price_per_pack,
        cost_per_unit: data.cost_per_unit,
        currency: 'SGD',
        is_preferred: data.is_preferred || false,
        source: 'manual',
      }),
    onSuccess: (_, { supplierId }) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}

export function useUpdateSupplierIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      supplierId,
      ingredientId,
      data,
    }: {
      supplierId: number;
      ingredientId: number;
      data: UpdateSupplierIngredientRequest;
    }) => api.updateSupplierIngredient(supplierId, ingredientId, data),
    onSuccess: (_, { supplierId }) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}

export function useRemoveSupplierIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      supplierId,
      ingredientId,
    }: {
      supplierId: number;
      ingredientId: number;
    }) => api.removeSupplierIngredient(supplierId, ingredientId),
    onSuccess: (_, { supplierId }) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}
