'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppState } from '@/lib/store';
import * as api from '@/lib/api';
import type { AssignBrandRoleRequest, BrandRole, InviteMemberRequest } from '@/types';
import { MEMBER_ACCOUNTS_KEY } from './useUsers';

/**
 * Brand-app roles (`Manager` | `Staff`), read from Prepper's projection of Passport.
 *
 * Reads are LOCAL: the projection is the model, so these survive a Passport outage and add no
 * network hop. Writes go UP to Passport and come back DOWN via sync — Passport is the source of
 * truth, and Prepper never writes these rows itself. That means a mutation is not immediately
 * reflected in the projection: the row lands once the sync event is delivered. Invalidating the
 * queries re-reads the projection, which is correct but may briefly still show the old value.
 */

const BRANDS_KEY = 'passport-brands';
const ROLES_KEY = 'passport-brand-roles';
const MEMBERS_KEY = 'passport-members';

/** Active brands carrying Prepper, with the current user's role at each. */
export function usePassportBrands() {
  const { userId } = useAppState();
  return useQuery({
    queryKey: [BRANDS_KEY, userId],
    queryFn: () => api.getPassportBrands(),
    staleTime: 5 * 60 * 1000, // structure changes rarely; it arrives via sync, not polling
  });
}

/** The assignment roster: who holds which role at which brand. */
export function usePassportBrandRoles() {
  const { userId } = useAppState();
  return useQuery({
    queryKey: [ROLES_KEY, userId],
    queryFn: () => api.getPassportBrandRoles(),
  });
}

/** Org members who can be given a brand role (Passport's roster, not Prepper's `users` table). */
export function usePassportMembers() {
  const { userId } = useAppState();
  return useQuery({
    queryKey: [MEMBERS_KEY, userId],
    queryFn: () => api.getPassportMembers(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Invalidate every projection-backed query after a write-back.
 *
 * The write lands in Passport and echoes back through sync, so the local projection is only correct
 * once that event arrives. Re-reading is the honest thing to do — Prepper must never apply the
 * change locally to make the UI feel instant, because that would make Prepper, not Passport, the
 * source of truth for a row it does not own.
 */
function useInvalidateRoles() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [ROLES_KEY] });
    queryClient.invalidateQueries({ queryKey: [BRANDS_KEY] });
  };
}

/**
 * Invite someone into the acting org — the ORG vocabulary (`Owner`|`Admin`|`Member`).
 *
 * Invalidating does NOT make the member appear: Prepper never writes the membership row, so they
 * arrive only when Passport's `membership.*` echo is delivered. This just stops a stale cache from
 * hiding them once it lands.
 *
 * `MEMBERS_KEY` matters as much as the roster: it backs the Person dropdown in Brand Access and has
 * a 5-minute `staleTime`, so omitting it leaves a freshly invited person un-assignable for five
 * minutes with no way to force a refresh. Ordering is load-bearing too — Passport 409s a brand-role
 * assignment for someone who holds no active org membership, so an invite must land first.
 */
export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteMemberRequest) => api.invitePassportMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEMBER_ACCOUNTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY] });
    },
  });
}

export function useAssignBrandRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (data: AssignBrandRoleRequest) => api.assignPassportBrandRole(data),
    onSuccess: invalidate,
  });
}

export function useSetBrandRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: ({ assignmentId, role }: { assignmentId: string; role: BrandRole }) =>
      api.setPassportBrandRole(assignmentId, role),
    onSuccess: invalidate,
  });
}

export function useRemoveBrandRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (assignmentId: string) => api.removePassportBrandRole(assignmentId),
    onSuccess: invalidate,
  });
}
