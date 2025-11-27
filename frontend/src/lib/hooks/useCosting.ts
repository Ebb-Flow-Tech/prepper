'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';

export function useCosting(recipeId: number | null) {
  return useQuery({
    queryKey: ['costing', recipeId],
    queryFn: () => api.getRecipeCosting(recipeId!),
    enabled: recipeId !== null,
    retry: false, // Don't retry on 404 (no ingredients yet)
  });
}

export function useRecomputeCosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: number) => api.recomputeRecipeCosting(recipeId),
    onSuccess: (_, recipeId) => {
      queryClient.invalidateQueries({ queryKey: ['costing', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
    },
  });
}
