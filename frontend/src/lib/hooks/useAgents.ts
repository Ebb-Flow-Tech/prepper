'use client';

import { useMutation } from '@tanstack/react-query';
import { categorizeIngredient } from '@/lib/api';

export function useCategorizeIngredient() {
  return useMutation({
    mutationFn: (ingredientName: string) =>
      categorizeIngredient({ ingredient_name: ingredientName }),
  });
}
