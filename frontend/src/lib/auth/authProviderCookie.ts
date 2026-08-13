/**
 * The single source of truth for "which Supabase project issued the current
 * session" — read by `lib/supabase/activeClient.ts`, written by every path that
 * starts or ends a session (the Passport callback, app-native sign-in, sign-out).
 * Name, values and attributes live in one place so no writer can drift from the
 * reader and point the app at the wrong project.
 *
 * Attributes are matched deliberately to `@supabase/ssr`'s own
 * DEFAULT_COOKIE_OPTIONS, so this marker cannot expire while the session cookie
 * it describes is still valid.
 */
export type AuthProvider = 'passport' | 'app-native';

export const AUTH_PROVIDER_COOKIE_NAME = 'prepper_auth_provider';

export const AUTH_PROVIDER_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 400 * 24 * 60 * 60,
  httpOnly: false as const,
};

const VALID_PROVIDERS: readonly AuthProvider[] = ['passport', 'app-native'];

/**
 * Parses a raw `document.cookie`-style string. Defaults to `app-native` when
 * absent or garbage — the pre-SSO baseline, never wrong in a way that risks
 * validating a session against the wrong project.
 */
export function readAuthProviderCookie(cookieString: string): AuthProvider {
  const match = cookieString
    .split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${AUTH_PROVIDER_COOKIE_NAME}=`));

  if (!match) return 'app-native';

  const value = match.slice(AUTH_PROVIDER_COOKIE_NAME.length + 1);
  return (VALID_PROVIDERS as readonly string[]).includes(value)
    ? (value as AuthProvider)
    : 'app-native';
}
