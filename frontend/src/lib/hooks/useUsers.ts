import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/lib/api';
import type { User } from '@/types';

export function useUser(userId: string | null | undefined) {
  return useQuery<User | null>({
    queryKey: ['users', userId],
    queryFn: userId ? () => getUser(userId) : () => Promise.resolve(null),
    enabled: !!userId,
    staleTime: Infinity,
  });
}
