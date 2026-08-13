export type ParsedFragment =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false };

/**
 * Reads the session `GET /auth/passport/callback` hands back in the URL fragment.
 *
 * The fragment is used rather than a query string because it is never sent to a server, never
 * logged by one, and never lands in a Referer header — the tokens exist only in this tab.
 *
 * Accepts the hash with or without its leading `#`, so a caller can pass `window.location.hash`
 * straight through.
 */
export function parsePassportCallbackFragment(hash: string): ParsedFragment {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  // Both or nothing: an access token without a refresh token installs a session that dies at the
  // first expiry with no way back, which reads to the user as a random sign-out.
  if (!accessToken || !refreshToken) {
    return { ok: false };
  }

  return { ok: true, accessToken, refreshToken };
}
