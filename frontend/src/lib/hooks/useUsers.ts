import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUser, getUsers, getMemberAccounts, updateUser } from '@/lib/api';
import type { MemberAccount, User, UpdateUserRequest } from '@/types';

export const MEMBER_ACCOUNTS_KEY = 'member-accounts';

export function useUser(userId: string | null | undefined) {
  return useQuery<User | null>({
    queryKey: ['users', userId],
    queryFn: userId ? () => getUser(userId) : () => Promise.resolve(null),
    enabled: !!userId,
    staleTime: Infinity,
  });
}

/**
 * Local `users` rows in the acting org — scoped through the Passport identity link.
 *
 * Only returns people who have signed in via Passport SSO. That is CORRECT here: its consumer,
 * `ParticipantPicker`, needs a local `users.id` to record a tasting participant, and someone with
 * no account cannot be one. For a roster of the org's PEOPLE, use `useMemberAccounts`.
 */
export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 30000,
  });
}

/** The org's people, from Passport's membership, with their local account if they have one. */
export function useMemberAccounts() {
  return useQuery<MemberAccount[]>({
    queryKey: [MEMBER_ACCOUNTS_KEY],
    queryFn: getMemberAccounts,
    staleTime: 30000,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserRequest }) =>
      updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

