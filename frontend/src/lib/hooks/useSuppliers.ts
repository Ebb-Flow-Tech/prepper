'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateSupplierRequest, UpdateSupplierRequest, AddSupplierIngredientRequest, UpdateSupplierIngredientRequest } from '@/types';

export function useSuppliers(showArchived: boolean = false) {
  const activeOnly = !showArchived;
  return useQuery({
    queryKey: ['suppliers', { activeOnly }],
    queryFn: () => api.getSuppliers(activeOnly),
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

export function useDeactivateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deactivateSupplier(id),
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
      data: AddSupplierIngredientRequest;
    }) => api.addSupplierIngredient(supplierId, data),
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
      supplierIngredientId,
      ingredientId,
      data,
    }: {
      supplierId: number;
      supplierIngredientId: number;
      ingredientId: number;
      data: UpdateSupplierIngredientRequest;
    }) => api.updateSupplierIngredient(supplierIngredientId, ingredientId, data),
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
      supplierIngredientId,
      ingredientId,
    }: {
      supplierId: number;
      supplierIngredientId: number;
      ingredientId: number;
    }) => api.removeSupplierIngredient(supplierIngredientId, ingredientId),
    onSuccess: (_, { supplierId }) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}
