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

// ============ Tasting Sessions ============

export function useTastingSessions() {
  return useQuery({
    queryKey: ['tasting-sessions'],
    queryFn: api.getTastingSessions,
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
    }: {
      sessionId: number;
      data: CreateTastingNoteRequest;
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
      recipeId,
    }: {
      sessionId: number;
      noteId: number;
      data: UpdateTastingNoteRequest;
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
    mutationFn: ({ sessionId, noteId }: { sessionId: number; noteId: number }) =>
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
