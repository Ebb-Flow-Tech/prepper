'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { InstructionsStructured } from '@/types';

export function useUpdateRawInstructions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      instructionsRaw,
    }: {
      recipeId: number;
      instructionsRaw: string;
    }) => api.updateRawInstructions(recipeId, instructionsRaw),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe', variables.recipeId] });
    },
  });
}

export function useParseInstructions() {
  return useMutation({
    mutationFn: ({
      recipeId,
      instructionsRaw,
    }: {
      recipeId: number;
      instructionsRaw: string;
    }) => api.parseInstructions(recipeId, { instructions_raw: instructionsRaw }),
  });
}

export function useUpdateStructuredInstructions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      structured,
    }: {
      recipeId: number;
      structured: InstructionsStructured;
    }) => api.updateStructuredInstructions(recipeId, structured),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe', variables.recipeId] });
    },
  });
}
