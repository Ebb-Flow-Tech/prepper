'use client';

/**
 * Forced-logout plumbing. Lets the API layer clear React Context state without a
 * circular import.
 *
 * Token refresh used to live here too. It is gone: the Supabase client owns the
 * session and refreshes it itself (see `api.ts`'s 401 rule).
 */

/**
 * Where `AuthGuard` remembers the last private route. Named here rather than in the component so
 * the writer and this eraser cannot drift: a typo on one side silently stops clearing it, and the
 * next user is redirected into the previous user's page.
 */
export const LAST_ROUTE_KEY = 'prepper_last_route';

type LogoutCallback = () => void;
let logoutCallback: LogoutCallback | null = null;

export function registerLogoutCallback(callback: LogoutCallback) {
  logoutCallback = callback;
}

export function triggerLogout() {
  // Clear the stored route to prevent redirecting back to a protected page
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LAST_ROUTE_KEY);
  }

  if (logoutCallback) {
    logoutCallback();
  }
}
