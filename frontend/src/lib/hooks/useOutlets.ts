'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { CreateOutletRequest, UpdateOutletRequest } from '@/types';

export function useOutlets(showArchived: boolean = false) {
  const activeOnly = !showArchived;
  return useQuery({
    queryKey: ['outlets', { activeOnly }],
    queryFn: () => api.getOutlets(activeOnly ? true : null),
  });
}

export function useOutlet(id: number | null) {
  return useQuery({
    queryKey: ['outlet', id],
    queryFn: () => api.getOutlet(id!),
    enabled: id !== null,
  });
}

export function useCreateOutlet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOutletRequest) => api.createOutlet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
    },
  });
}

export function useUpdateOutlet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateOutletRequest;
    }) => api.updateOutlet(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      queryClient.invalidateQueries({ queryKey: ['outlet', variables.id] });
    },
  });
}

export function useDeactivateOutlet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deactivateOutlet(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      queryClient.invalidateQueries({ queryKey: ['outlet', id] });
    },
  });
}
