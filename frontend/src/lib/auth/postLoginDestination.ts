'use client';

import { LAST_ROUTE_KEY } from '@/lib/auth-interceptor';

/**
 * Where a sign-in lands when nothing better is remembered.
 *
 * The four sources are ordered: an explicit `?redirect=` on /login beats a parked tasting deep
 * link, which beats the last private route `AuthGuard` recorded, which beats this default.
 */
export const DEFAULT_POST_LOGIN_DESTINATION = '/recipes';

/**
 * The tasting deep link `/tastings/invite/[id]` parks before bouncing an unauthenticated visitor
 * to /login. One-shot: whoever acts on it must consume it, or the next ordinary sign-in reopens a
 * tasting the user did not ask for.
 */
export const TASTING_REDIRECT_KEY = 'tasting_redirect_url';

/**
 * The ONE test for "is this a safe place to send someone after login", returning the exact string
 * the caller must navigate to, or `null`.
 *
 * A `startsWith('/') && !startsWith('//')` check is NOT sufficient, and this is the bug it hides:
 * the string you test is not the string the browser navigates to. The WHATWG URL parser strips
 * ASCII tab, CR and LF *before* parsing, and treats `\` as `/` in a special scheme. All three of
 * these pass the naive check and leave the origin:
 *
 *   "/\tevil"  -> "/" + TAB + "/evil.example/x"  -> https://evil.example/x
 *   "/\nevil"  -> "/" + LF  + "/evil.example/x"  -> https://evil.example/x
 *   "/\\evil"  -> "/\evil.example/x"             -> https://evil.example/x
 *
 * So: normalise the way the parser will, re-test the prefix on the NORMALISED form, then confirm
 * against the real parser that the resolved origin is still ours. Returning the normalised value
 * rather than the caller's raw string is part of the fix — handing back the original would pass
 * the poisoned form straight to `location.assign`, and the check would have proved nothing.
 *
 * `javascript:` and `https://evil.example` fail the prefix test; the three above fail it only
 * after normalisation; anything exotic enough to survive both fails the origin comparison.
 */
export function sanitizeRelativeDestination(candidate: string | null): string | null {
  if (!candidate) return null;

  const normalised = candidate.replace(/[\t\r\n]/g, '').replace(/\\/g, '/');
  if (!normalised.startsWith('/') || normalised.startsWith('//')) return null;

  try {
    const url = new URL(normalised, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * The one definition of "where does this sign-in land?", shared by the login page, the Google
 * OAuth bridge and the Passport callback. It was copied twice before this existed, and the copies
 * had already drifted: the login page honoured `?redirect=`, the OAuth callback did not.
 *
 * The FIRST VALID candidate wins, not the first present one. A poisoned higher-priority source
 * (a planted `javascript:` in `?redirect=`) is skipped rather than collapsing the whole resolution
 * to the default, so it cannot be used to steer a user away from the tasting they were invited to.
 *
 * Every candidate goes through `sanitizeRelativeDestination`, and the SANITISED form is what comes
 * back — callers navigate to the return value, never to the input.
 *
 * `search` is a parameter so callers on a page whose query string is not the relevant one — and
 * unit tests — can pass their own; it defaults to the current URL's.
 */
export function resolvePostLoginDestination(search: string = window.location.search): string {
  const candidates = [
    new URLSearchParams(search).get('redirect'),
    localStorage.getItem(TASTING_REDIRECT_KEY),
    localStorage.getItem(LAST_ROUTE_KEY),
  ];

  for (const candidate of candidates) {
    const safe = sanitizeRelativeDestination(candidate);
    if (safe) return safe;
  }

  return DEFAULT_POST_LOGIN_DESTINATION;
}

/**
 * Persist the destination where `AuthGuard` also looks.
 *
 * Not redundant with the caller's own navigation: `AuthGuard` redirects an authenticated visitor
 * sitting on a public route to `getLastRoute()`, and that effect can fire before the caller
 * navigates. Writing it here is what stops the two disagreeing and stranding the user on a stale
 * route. It is also how the destination survives the Passport round trip — the callback page
 * returns on a fresh page load with no query string of its own.
 */
export function rememberPostLoginDestination(destination: string): void {
  localStorage.setItem(LAST_ROUTE_KEY, destination);
}

/**
 * Consume the one-shot tasting deep link — ONLY from a path that already holds a session.
 *
 * Deleting it before the Passport round trip (i.e. on the login page's `passport` branch) loses
 * the deep link permanently the moment SSO fails: the user returns to /login with an error and
 * the invite they followed is gone.
 */
export function consumeTastingRedirect(): void {
  localStorage.removeItem(TASTING_REDIRECT_KEY);
}
