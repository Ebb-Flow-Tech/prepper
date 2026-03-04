'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type {
  CreateTastingSessionRequest,
  UpdateTastingSessionRequest,
  CreateTastingNoteRequest,
  UpdateTastingNoteRequest,
  AddRecipeToSessionRequest,
} from '@/types';
import type { ListParams } from '@/lib/api';

// ============ Tasting Sessions ============

export function useTastingSessions(params?: ListParams) {
  return useQuery({
    queryKey: ['tasting-sessions', params],
    queryFn: () => api.getTastingSessions(params),
    placeholderData: (prev) => prev,
  });
}

export function useTastingSession(id: number | null) {
  return useQuery({
    queryKey: ['tasting-session', id],
    queryFn: () => api.getTastingSession(id!),
    enabled: id !== null,
  });
}

export function useTastingSessionStats(id: number | null) {
  return useQuery({
    queryKey: ['tasting-session', id, 'stats'],
    queryFn: () => api.getTastingSessionStats(id!),
    enabled: id !== null,
  });
}

export function useCreateTastingSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTastingSessionRequest) =>
      api.createTastingSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasting-sessions'] });
    },
  });
}

export function useUpdateTastingSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTastingSessionRequest }) =>
      api.updateTastingSession(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasting-session', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tasting-sessions'] });
    },
  });
}

export function useDeleteTastingSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteTastingSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasting-sessions'] });
    },
  });
}

// ============ Tasting Notes ============

export function useSessionNotes(sessionId: number | null) {
  return useQuery({
    queryKey: ['tasting-session', sessionId, 'notes'],
    queryFn: () => api.getSessionNotes(sessionId!),
    enabled: sessionId !== null,
  });
}

export function useAddNoteToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
      userId,
    }: {
      sessionId: number;
      data: CreateTastingNoteRequest & { user_id?: string | null };
      userId?: string | null;
    }) => api.addNoteToSession(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'notes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'stats'],
      });
      // Also invalidate recipe tasting history if recipe is affected
      queryClient.invalidateQueries({
        queryKey: ['recipe', variables.data.recipe_id, 'tasting-notes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['recipe', variables.data.recipe_id, 'tasting-summary'],
      });
    },
  });
}

export function useUpdateTastingNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      noteId,
      data,
      userId,
      recipeId,
    }: {
      sessionId: number;
      noteId: number;
      data: UpdateTastingNoteRequest;
      userId?: string | null;
      recipeId?: number;
    }) => api.updateTastingNote(sessionId, noteId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'notes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'stats'],
      });
      // Also invalidate recipe tasting notes if recipeId is provided
      if (variables.recipeId) {
        queryClient.invalidateQueries({
          queryKey: ['recipe', variables.recipeId, 'tasting-notes'],
        });
      }
    },
  });
}

export function useDeleteTastingNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, noteId, userId }: { sessionId: number; noteId: number; userId?: string | null }) =>
      api.deleteTastingNote(sessionId, noteId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'notes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'stats'],
      });
    },
  });
}

// ============ Recipe Tasting History ============

export function useRecipesWithFeedback(userId: string | null) {
  return useQuery({
    queryKey: ['recipes-with-feedback', userId],
    queryFn: () => api.getRecipesWithFeedback(userId!),
    enabled: userId !== null,
  });
}

export function useRecipeTastingNotes(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipe', recipeId, 'tasting-notes'],
    queryFn: () => api.getRecipeTastingNotes(recipeId!),
    enabled: recipeId !== null,
  });
}

export function useRecipeTastingSummary(recipeId: number | null) {
  return useQuery({
    queryKey: ['recipe', recipeId, 'tasting-summary'],
    queryFn: () => api.getRecipeTastingSummary(recipeId!),
    enabled: recipeId !== null,
  });
}

// ============ Session Recipes (Recipe-Tasting) ============

export function useSessionRecipes(sessionId: number | null) {
  return useQuery({
    queryKey: ['tasting-session', sessionId, 'recipes'],
    queryFn: () => api.getSessionRecipes(sessionId!),
    enabled: sessionId !== null,
  });
}

export function useSessionRecipesFull(sessionId: number | null) {
  return useQuery({
    queryKey: ['tasting-session', sessionId, 'recipes-full'],
    queryFn: () => api.getSessionRecipesFull(sessionId!),
    enabled: sessionId !== null,
  });
}

export function useAddRecipeToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: number;
      data: AddRecipeToSessionRequest;
    }) => api.addRecipeToSession(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'recipes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'stats'],
      });
    },
  });
}

export function useRemoveRecipeFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, recipeId }: { sessionId: number; recipeId: number }) =>
      api.removeRecipeFromSession(sessionId, recipeId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'recipes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tasting-session', variables.sessionId, 'stats'],
      });
    },
  });
}

// ============ Tasting Note Images ============

export function useTastingNoteImages(tastingNoteId: number | null) {
  return useQuery({
    queryKey: ['tasting-note', tastingNoteId, 'images'],
    queryFn: () => api.getTastingNoteImages(tastingNoteId!),
    enabled: tastingNoteId !== null,
  });
}

export function useUploadTastingNoteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tastingNoteId, imageBase64 }: { tastingNoteId: number; imageBase64: string }) =>
      api.uploadTastingNoteImage(tastingNoteId, imageBase64),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-note', variables.tastingNoteId, 'images'],
      });
    },
  });
}

export function useUploadMultipleTastingNoteImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tastingNoteId, images }: { tastingNoteId: number; images: string[] }) =>
      api.uploadMultipleTastingNoteImages(tastingNoteId, images),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-note', variables.tastingNoteId, 'images'],
      });
    },
  });
}

export function useDeleteTastingNoteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, tastingNoteId }: { imageId: number; tastingNoteId: number }) =>
      api.deleteTastingNoteImage(imageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-note', variables.tastingNoteId, 'images'],
      });
    },
  });
}

export function useSyncTastingNoteImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tastingNoteId, images }: { tastingNoteId: number; images: api.ImageWithIdRequest[] }) =>
      api.syncTastingNoteImages(tastingNoteId, images),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tasting-note', variables.tastingNoteId, 'images'],
      });
    },
  });
}

export function useIngredientTastingNoteImages(ingredientTastingNoteId: number | null) {
  return useQuery({
    queryKey: ['ingredient-tasting-note', ingredientTastingNoteId, 'images'],
    queryFn: () => {
      if (!ingredientTastingNoteId) return [];
      return api.getIngredientTastingNoteImages(ingredientTastingNoteId);
    },
    enabled: !!ingredientTastingNoteId,
  });
}

export function useSyncIngredientTastingNoteImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ingredientTastingNoteId, images }: { ingredientTastingNoteId: number; images: api.ImageWithIdRequest[] }) =>
      api.syncIngredientTastingNoteImages(ingredientTastingNoteId, images),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ingredient-tasting-note', variables.ingredientTastingNoteId, 'images'],
      });
    },
  });
}
