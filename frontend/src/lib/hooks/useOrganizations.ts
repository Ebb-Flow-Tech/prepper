'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppState } from '@/lib/store';
import * as api from '@/lib/api';

/**
 * The organisations the user belongs to, with their role in each.
 *
 * Read from Prepper's projection of Passport — local, so it survives a Passport outage and adds no
 * network hop. Org structure arrives via sync, not polling, so it is cached like the brand list.
 *
 * Server state lives here rather than in the store: only the SELECTED org id is client state.
 */

const ORGS_KEY = 'passport-organizations';

export function useOrganizations() {
  const { userId } = useAppState();
  return useQuery({
    queryKey: [ORGS_KEY, userId],
    queryFn: () => api.getPassportOrganizations(),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000, // org membership changes rarely and arrives via sync
  });
}
