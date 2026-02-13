import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUser, getUsers, updateUser } from '@/lib/api';
import type { User } from '@/types';

export function useUser(userId: string | null | undefined) {
  return useQuery<User | null>({
    queryKey: ['users', userId],
    queryFn: userId ? () => getUser(userId) : () => Promise.resolve(null),
    enabled: !!userId,
    staleTime: Infinity,
  });
}

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 30000,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<User> }) =>
      updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
