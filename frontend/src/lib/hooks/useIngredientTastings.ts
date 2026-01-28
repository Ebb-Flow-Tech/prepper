'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type {
  CreateIngredientTastingNoteRequest,
  UpdateIngredientTastingNoteRequest,
  AddIngredientToSessionRequest,
} from '@/types';

// ============ Session Ingredients ============

export function useSessionIngredients(sessionId: number | null) {
  return useQuery({
    queryKey: ['tasting-session', sessionId, 'ingredients'],
    queryFn: () => api.getSessionIngredients(sessionId!),
    enabled: sessionId !== null,
  });
}

export function useAddIngredientToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: number;
      data: AddIngredientToSessionRequest;
    }) => api.addIngredientToSession(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'ingredients'],
      });
    },
  });
}

export function useRemoveIngredientFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, ingredientId }: { sessionId: number; ingredientId: number }) =>
      api.removeIngredientFromSession(sessionId, ingredientId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'ingredients'],
      });
    },
  });
}

// ============ Ingredient Tasting Notes ============

export function useIngredientNotes(sessionId: number | null) {
  return useQuery({
    queryKey: ['tasting-session', sessionId, 'ingredient-notes'],
    queryFn: () => api.getIngredientNotes(sessionId!),
    enabled: sessionId !== null,
  });
}

export function useAddIngredientNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: number;
      data: CreateIngredientTastingNoteRequest;
    }) => api.addIngredientNote(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'ingredient-notes'],
      });
      // Also invalidate ingredient tasting history if ingredient is affected
      queryClient.invalidateQueries({
        queryKey: ['ingredient', variables.data.ingredient_id, 'tasting-notes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['ingredient', variables.data.ingredient_id, 'tasting-summary'],
      });
    },
  });
}

export function useUpdateIngredientNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      noteId,
      data,
      ingredientId,
    }: {
      sessionId: number;
      noteId: number;
      data: UpdateIngredientTastingNoteRequest;
      ingredientId?: number;
    }) => api.updateIngredientNote(sessionId, noteId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'ingredient-notes'],
      });
      // Also invalidate ingredient tasting notes if ingredientId is provided
      if (variables.ingredientId) {
        queryClient.invalidateQueries({
          queryKey: ['ingredient', variables.ingredientId, 'tasting-notes'],
        });
      }
    },
  });
}

export function useDeleteIngredientNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, noteId }: { sessionId: number; noteId: number }) =>
      api.deleteIngredientNote(sessionId, noteId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'ingredient-notes'],
      });
    },
  });
}

// ============ Ingredient Tasting History ============

export function useIngredientTastingNotes(ingredientId: number | null) {
  return useQuery({
    queryKey: ['ingredient', ingredientId, 'tasting-notes'],
    queryFn: () => api.getIngredientTastingNotes(ingredientId!),
    enabled: ingredientId !== null,
  });
}

export function useIngredientTastingSummary(ingredientId: number | null) {
  return useQuery({
    queryKey: ['ingredient', ingredientId, 'tasting-summary'],
    queryFn: () => api.getIngredientTastingSummary(ingredientId!),
    enabled: ingredientId !== null,
  });
}
