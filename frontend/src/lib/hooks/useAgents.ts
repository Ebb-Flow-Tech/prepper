'use client';

import { useMutation } from '@tanstack/react-query';
import { categorizeIngredient, summarizeFeedback } from '@/lib/api';

export function useCategorizeIngredient() {
  return useMutation({
    mutationFn: (ingredientName: string) =>
      categorizeIngredient({ ingredient_name: ingredientName }),
  });
}

export function useSummarizeFeedback() {
  return useMutation({
    mutationFn: (recipeId: number) =>
      summarizeFeedback(recipeId),
  });
}
