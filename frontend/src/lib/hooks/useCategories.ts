'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CategoryListParams } from '@/lib/api';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@/types';

export function useCategoriesPaginated(params?: CategoryListParams) {
  return useQuery({
    queryKey: ['categories', 'paginated', params],
    queryFn: () => api.getCategoriesPaginated(params),
    placeholderData: (prev) => prev,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCategories(showArchived: boolean = false) {
  const activeOnly = !showArchived;
  return useQuery({
    queryKey: ['categories', { activeOnly }],
    queryFn: () => api.getCategories(activeOnly),
    staleTime: 30 * 60 * 1000, // 30 minutes — stable reference data
  });
}

export function useCategory(id: number | null) {
  return useQuery({
    queryKey: ['category', id],
    queryFn: () => api.getCategory(id!),
    enabled: id !== null,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateCategoryRequest;
    }) => api.updateCategory(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category', variables.id] });
    },
  });
}

export function useDeactivateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deactivateCategory(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category', id] });
    },
  });
}
