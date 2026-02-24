'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { Menu, MenuDetail, CreateMenuRequest, UpdateMenuRequest, MenuItemRead } from '@/types';
import { useAppState } from '@/lib/store';

const MENUS_QUERY_KEY = 'menus';

export function useMenus() {
  const { userId, userType } = useAppState();
  return useQuery({
    queryKey: [MENUS_QUERY_KEY, { userId, userType }],
    queryFn: () => api.getMenus(),
    enabled: !!userId,
  });
}

export function useMenu(menuId: number | null) {
  return useQuery({
    queryKey: [MENUS_QUERY_KEY, menuId],
    queryFn: () => api.getMenu(menuId!),
    enabled: menuId !== null,
  });
}

export function useCreateMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMenuRequest) => api.createMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENUS_QUERY_KEY] });
      toast.success('Menu created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create menu');
    },
  });
}

export function useUpdateMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ menuId, data }: { menuId: number; data: UpdateMenuRequest }) =>
      api.updateMenu(menuId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MENUS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [MENUS_QUERY_KEY, variables.menuId], exact: false });
      toast.success('Menu updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update menu');
    },
  });
}

export function useForkMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menuId: number) => api.forkMenu(menuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENUS_QUERY_KEY] });
      toast.success('Menu forked successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to fork menu');
    },
  });
}

export function useDeleteMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menuId: number) => api.deleteMenu(menuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENUS_QUERY_KEY] });
      toast.success('Menu deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete menu');
    },
  });
}

export function useMenusByOutlet(outletId: number | null) {
  return useQuery({
    queryKey: [MENUS_QUERY_KEY, 'outlet', outletId],
    queryFn: () => api.getMenusByOutlet(outletId!),
    enabled: outletId !== null,
  });
}

export function useMenuItemsBySection(sectionId: number | null) {
  return useQuery({
    queryKey: [MENUS_QUERY_KEY, 'section', sectionId],
    queryFn: () => api.getMenuItemsBySection(sectionId!),
    enabled: sectionId !== null,
  });
}
