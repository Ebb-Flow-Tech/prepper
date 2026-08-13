/**
 * The acting org selection, persisted on its own localStorage key.
 *
 * It used to ride inside the `prepper_auth` blob. That blob is gone — the Supabase
 * client owns the session now — but `activeOrgId` is NOT part of a Supabase session
 * and must not disappear with it: it feeds `orgHeader()` -> `X-Organization-Id` on
 * every request, which is load-bearing for the backend's org isolation.
 *
 * Lives in its own module rather than in `store.tsx` so `api.ts` can read it without
 * importing the React store, which now imports `api.ts` for `getMe()` — a cycle.
 * The React state stays in `store.tsx`; this file is only the storage seam.
 */
const ACTIVE_ORG_STORAGE_KEY = 'prepper_active_org_id';

export function readActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
}

export function writeActiveOrgId(orgId: string | null): void {
  if (typeof window === 'undefined') return;
  if (orgId) {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
  } else {
    localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
  }
}
