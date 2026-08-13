import { API_BASE, ApiError } from '@/lib/api';
import type { LoginRoute } from '@/types';

/**
 * `API_BASE` already carries the `/api/v1` prefix, so the path appended here is version-less —
 * unlike `geddit-one`, whose variable is the bare backend origin and which therefore writes
 * `/api/...` at every call site. Imported rather than re-derived: a local copy is how the prefix
 * ends up doubled on this one URL, which fails as a 404 at the end of every SSO sign-in.
 */
export const PASSPORT_START_URL = `${API_BASE}/auth/passport/start`;

const TOO_MANY_REQUESTS = 429;

/** The one failure a visitor can act on, so the only one worth naming. */
export const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a moment and try again.';

export const UNEXPECTED_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

/**
 * Step 1 of the email-first router: one address in, one of two routes out.
 *
 * `passport` navigates immediately and the backend's redirect chain takes over — it is a
 * cross-origin navigation to Passport's hosted login, so it must be a full page load
 * (`window.location`), which Next's router cannot do. `app-native` returns without navigating so
 * the caller can reveal the password field in place.
 *
 * The route decision is the server's alone. There is no toggle and no third value: the user must
 * never have to know which kind of account they hold.
 */
export async function submitEmailStep(deps: {
  email: string;
  fetchResolveLogin: (email: string) => Promise<{ route: LoginRoute }>;
  navigate: (url: string) => void;
}): Promise<LoginRoute> {
  const { route } = await deps.fetchResolveLogin(deps.email);

  if (route === 'passport') {
    deps.navigate(PASSPORT_START_URL);
  }

  return route;
}

/**
 * What to show when step 1 fails.
 *
 * Only the rate limit is named. Everything else — a network drop, a 500, a CORS misconfiguration —
 * shares one message rather than mislabelling an outage as rate limiting, and no branch reports
 * anything about the address that was typed: `/auth/resolve-login` answers identically for a
 * member, a non-member and an address that does not exist, and its error copy must not undo that.
 */
export function emailStepErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.status === TOO_MANY_REQUESTS
    ? RATE_LIMIT_MESSAGE
    : UNEXPECTED_ERROR_MESSAGE;
}

/**
 * What to show when the password step fails.
 *
 * Unlike step 1 this surfaces the backend's own message, which is the useful one here ("Invalid
 * credentials", or the refusal a member gets when SSO is on). The `instanceof` test is not
 * ceremony: the previous `err as AuthApiError` cast asserted a shape that a thrown `null` or a
 * thrown string does not have, and reading `.message` off it threw a SECOND error from inside the
 * catch block — losing the original and leaving the form with no message at all.
 */
export function passwordStepErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === TOO_MANY_REQUESTS) {
    return RATE_LIMIT_MESSAGE;
  }
  return error instanceof Error && error.message ? error.message : INVALID_CREDENTIALS_MESSAGE;
}
