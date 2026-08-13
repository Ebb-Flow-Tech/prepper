'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppState } from '@/lib/store';
import * as api from '@/lib/api';

/**
 * Brand-app roles (`Manager` | `Staff`), read from Prepper's projection of Passport.
 *
 * READ ONLY. Reads are LOCAL: the projection is the model, so these survive a Passport outage and
 * add no network hop. The mutation hooks that used to live here — invite, assign, change, remove —
 * were deleted on 2026-08-13 when Prepper became a read-only consumer. Roles and memberships are
 * managed in Passport's dashboard and arrive here through sync.
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
