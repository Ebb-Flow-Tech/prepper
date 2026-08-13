'use client';

import { logoutUser } from '@/lib/api';
import { triggerLogout } from '@/lib/auth-interceptor';
import { readAuthProviderCookie } from '@/lib/auth/authProviderCookie';
import { clearAuthProviderCookie, getActiveSupabaseClient } from '@/lib/supabase/activeClient';

/**
 * The teardown currently running, shared by every concurrent caller.
 *
 * Concurrency here is the normal case, not the exotic one: a page with a dozen queries in flight
 * gets a dozen simultaneous 401s, and each one calls `performSignOut()`. Returning early would
 * make all but the first a silent no-op that resolves before the session is actually gone —
 * `TopNav` would then fire its `window.location.assign` mid-teardown. Joining one promise means
 * every caller waits for the same real teardown and observes a finished one.
 *
 * INVARIANT: nothing inside `teardown()` may call `performSignOut()`, directly or indirectly.
 * Such a call would await the very promise it is running inside and deadlock. The one path that
 * could is `logoutUser()`'s 401, which is why that request opts out of the 401 rule
 * (`FetchControl.skipSessionRecovery` in `api.ts`). Add another request in here and you must do
 * the same.
 */
let inFlight: Promise<void> | null = null;

/**
 * The ONE sign-out sequence, shared by the user-initiated button (`TopNav`) and the forced path
 * (`api.ts`'s 401 rule). Without a single helper, a 401-driven logout clears local state while
 * leaving a live Supabase session and a stale provider cookie behind — and the next page load
 * re-hydrates straight from them.
 */
export function performSignOut(): Promise<void> {
  if (inFlight) return inFlight;

  // The reset is part of the promise callers await, NOT a detached `.finally()` on a side chain.
  // Detached, it lands a microtask late: `await performSignOut()` would return with the slot
  // still latched, so an immediately following sign-out would join a teardown that has already
  // finished and resolve without doing anything.
  inFlight = teardown().finally(() => {
    inFlight = null;
  });
  // Callers are free not to await; without a handler a rejection here would surface as an
  // unhandled rejection.
  void inFlight.catch(() => {});
  return inFlight;
}

/**
 * Ordering is load-bearing:
 *
 * - Resolve the active client BEFORE clearing the cookie. `getActiveSupabaseClient()` re-reads the
 *   cookie on every call, so clearing it first resolves to the absent-cookie default
 *   (`app-native`) whatever was actually active — signing out of a client the user was never
 *   signed into and leaving the real (e.g. Passport) session live while the app merely looks
 *   signed out.
 * - Call `logoutUser()` BEFORE `signOut()`, not after as the spec's numbered list reads.
 *   `POST /auth/logout` requires a bearer token; once the client session is gone the request
 *   carries none and the backend answers 401, making that step a permanent no-op.
 * - Local teardown sits in `finally`, and NOTHING fallible sits above the `try` — not even
 *   resolving the client (see the comment at that line). A step that throws must not strand a
 *   cleared-nothing state: leaving the cookie and local state behind IS the inconsistent state
 *   this helper exists to prevent, and the next page load would re-hydrate from it.
 *
 * `scope: "local"` is REQUIRED, not the default. Supabase's `signOut()` defaults to
 * `scope: "global"`, which revokes the refresh token server-side for every session sharing it —
 * for a Passport-minted session that signs the user out of Passport's own hosted page and every
 * other consumer app, not just Prepper.
 *
 * `logoutUser()` runs only for `app-native`. The backend cannot tell which project minted a token
 * — it sees a bearer token and nothing else — and it should not have to: the marker is a frontend
 * cookie, so the frontend skips the call.
 */
async function teardown(): Promise<void> {
  const provider = readAuthProviderCookie(document.cookie);

  try {
    if (provider === 'app-native') {
      try {
        await logoutUser();
      } catch (error) {
        console.error('Backend logout failed; continuing with local sign-out:', error);
      }
    }

    try {
      // RESOLVING the client is itself fallible and must sit inside this guard, not above the
      // `try`. `createPassportClient()` passes `process.env.NEXT_PUBLIC_PASSPORT_SUPABASE_URL!`
      // straight into the SDK, so it THROWS when the cookie reads `passport` and those variables
      // are gone — which is exactly the rollback state: SSO switched off, the frontend
      // redeployed without the Passport env, users still holding `prepper_auth_provider=passport`.
      // Constructed above the `try`, that throw escaped before the `finally` below could run,
      // leaving the cookie, the store state and the query cache all live — the precise
      // inconsistency this function exists to prevent, discovered at the worst possible moment.
      await getActiveSupabaseClient().auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Supabase sign-out failed; clearing local session state anyway:', error);
    }
  } finally {
    clearAuthProviderCookie();
    triggerLogout();
  }
}
