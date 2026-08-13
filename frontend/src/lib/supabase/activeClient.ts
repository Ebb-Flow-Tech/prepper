import { createClient } from './client';
import { createPassportClient } from './passportClient';
import {
  AUTH_PROVIDER_COOKIE_NAME,
  AUTH_PROVIDER_COOKIE_OPTIONS,
  readAuthProviderCookie,
  type AuthProvider,
} from '@/lib/auth/authProviderCookie';

/**
 * Resolves whichever Supabase client instance actually holds the current session,
 * per the `prepper_auth_provider` cookie (see `authProviderCookie.ts`).
 *
 * Never memoized — always re-reads the cookie, so it reflects sign-in/sign-out as
 * it happens rather than a value frozen at some earlier call. Cheap to call on
 * every request; do NOT cache the return value across calls (in a `useRef`,
 * `useMemo`, or a module-level variable) or you reintroduce the staleness this
 * function exists to avoid.
 */
export function getActiveSupabaseClient() {
  if (typeof document === 'undefined') {
    throw new Error(
      'getActiveSupabaseClient() must only be called client-side (event handlers/effects), never during server rendering — it reads document.cookie, which does not exist server-side. See lib/supabase/passportClient.ts for the sibling guard.'
    );
  }

  const provider = readAuthProviderCookie(document.cookie);
  return provider === 'passport' ? createPassportClient() : createClient();
}

/** Records which project minted the session that is about to be installed. */
export function setAuthProviderCookie(provider: AuthProvider): void {
  if (typeof document === 'undefined') {
    throw new Error(
      'setAuthProviderCookie() must only be called client-side (event handlers/effects), never during server rendering — it writes document.cookie, which does not exist server-side. See lib/supabase/passportClient.ts for the sibling guard.'
    );
  }

  const { path, sameSite, maxAge } = AUTH_PROVIDER_COOKIE_OPTIONS;
  document.cookie = `${AUTH_PROVIDER_COOKIE_NAME}=${provider}; path=${path}; max-age=${maxAge}; SameSite=${sameSite}`;
}

/** Clears the cookie. Used by `lib/auth/signOut.ts`. */
export function clearAuthProviderCookie(): void {
  if (typeof document === 'undefined') {
    throw new Error(
      'clearAuthProviderCookie() must only be called client-side (event handlers/effects), never during server rendering — it writes document.cookie, which does not exist server-side. See lib/supabase/passportClient.ts for the sibling guard.'
    );
  }

  document.cookie = `${AUTH_PROVIDER_COOKIE_NAME}=; path=${AUTH_PROVIDER_COOKIE_OPTIONS.path}; max-age=0`;
}
