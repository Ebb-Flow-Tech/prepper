'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppState } from '@/lib/store';
import * as api from '@/lib/api';
import type {
  AssignBrandRoleRequest,
  BrandRole,
  InviteMemberRequest,
  PassportBrandRole,
} from '@/types';
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
 * Apply Passport's OWN answer to the roster cache after a write.
 *
 * This used to invalidate immediately, and the comment here said re-reading was "the honest thing
 * to do". It was honest and it was useless: the write lands in Passport and the projection only
 * changes when the `unit_app_membership.*` echo is delivered a moment LATER, so invalidating on
 * success refetched the *unchanged* projection and painted the old value straight back. With
 * `refetchOnWindowFocus: false` and a 5-minute `staleTime` (providers.tsx) nothing refetched again
 * either, so a successful change looked like a no-op — permanently. Staging bore this out: a role
 * row sat at `version: 4`, i.e. three successful writes the user never saw land.
 *
 * So we do NOT invalidate on success, and we do NOT invent the new state either. Passport's
 * response IS the new aggregate — the same value the echo will carry — so writing that into the
 * cache is not Prepper deciding anything. It is Prepper not throwing away the answer it just
 * received. Passport remains the source of truth; the projection is still only written by sync.
 *
 * The next natural refetch (the Settings tab unmounts inactive panels, so revisiting remounts and
 * refetches) reads the projection with the echo applied and agrees. Nothing snaps back — which is
 * exactly what a plain optimistic update WOULD do, since `onSettled` would refetch the pre-echo
 * projection and revert the row.
 */
function usePatchRoster() {
  const queryClient = useQueryClient();
  const { userId } = useAppState();
  return (fn: (rows: PassportBrandRole[]) => PassportBrandRole[]) => {
    queryClient.setQueryData<PassportBrandRole[]>(
      [ROLES_KEY, userId],
      (rows) => (rows ? fn(rows) : rows)
    );
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

/**
 * Give someone a role at a brand — including OVERRIDING the ladder for an Owner/Admin, whose
 * derived `Manager` has no row until this creates one.
 */
export function useAssignBrandRole() {
  const patch = usePatchRoster();
  return useMutation({
    mutationFn: (data: AssignBrandRoleRequest) => api.assignPassportBrandRole(data),
    onSuccess: (aggregate) =>
      patch((rows) =>
        rows.map((r) =>
          r.platform_user_id === aggregate.platform_user_id && r.unit_id === aggregate.unit_id
            ? {
                ...r,
                role: aggregate.role,
                source: 'assigned',
                assignment_id: aggregate.id,
              }
            : r
        )
      ),
  });
}

/** Change an existing assignment's role. Owner/Admin only, per Passport's matrix. */
export function useSetBrandRole() {
  const patch = usePatchRoster();
  return useMutation({
    mutationFn: ({ assignmentId, role }: { assignmentId: string; role: BrandRole }) =>
      api.setPassportBrandRole(assignmentId, role),
    onSuccess: (aggregate) =>
      patch((rows) =>
        rows.map((r) =>
          r.assignment_id === aggregate.id ? { ...r, role: aggregate.role } : r
        )
      ),
  });
}

/**
 * Remove an assignment. Passport returns the FINAL aggregate (`status: 'removed'`) — a tombstone,
 * not a delete.
 *
 * The ONE place here that predicts rather than echoes. Passport tells us the row is gone; it does
 * not tell us what the person is left with, and that depends on the ladder: an org Owner/Admin
 * falls back to a DERIVED `Manager` at every app-carrying brand, while anyone else is left with
 * nothing and drops off the brand entirely.
 *
 * Predicting it from `org_role` re-states the ladder on the client, which is normally exactly what
 * this codebase refuses to do. It is tolerable ONLY because it is transient and self-correcting:
 * the next refetch reads the real derivation from the projection and overrules it. If the ladder
 * ever stops meaning "Owner/Admin ⇒ Manager", this is wrong for one refetch cycle — and it is the
 * first thing to delete. Do not build anything on it.
 */
export function useRemoveBrandRole() {
  const patch = usePatchRoster();
  return useMutation({
    mutationFn: (assignmentId: string) => api.removePassportBrandRole(assignmentId),
    onSuccess: (aggregate) =>
      patch((rows) =>
        rows.flatMap((r) => {
          if (r.assignment_id !== aggregate.id) return [r];
          const laddered = r.org_role === 'Owner' || r.org_role === 'Admin';
          return laddered
            ? [{ ...r, role: 'Manager' as BrandRole, source: 'derived' as const, assignment_id: null }]
            : [];
        })
      ),
  });
}
