import type { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * The session no longer lives in a `prepper_auth` localStorage blob — it lives in the Supabase
 * browser client, which `@supabase/ssr` persists as chunked, base64url-encoded cookies named
 * `sb-<project-ref>-auth-token[.n]`. So there is nothing to inject any more: sign-in goes through
 * the real form, and `corruptStoredSession` acts on those cookies by NAME PATTERN rather than by
 * project ref, which the harness has no way to know.
 */
const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Sign in through the real two-step form.
 *
 * A thin wrapper over the page object, NOT a second implementation: `LoginPage` owns the sequence
 * (email → Continue → password → Log in) so a change to the form is a one-line change here.
 */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);
}

/**
 * Corrupt the stored session in place, leaving the cookie present but unusable.
 *
 * This is how the suite reaches "a token the server rejects" now that a token cannot be injected:
 * the app must land on /login without looping, not hang or crash.
 *
 * Rewrites through the context API rather than `document.cookie`. A `document.cookie` write only
 * overwrites when the name, domain AND path all match — write `path=/` against a cookie the SDK
 * stored on another path and you create a SIBLING, the real cookie keeps winning, and the specs
 * that depend on this quietly assert nothing. Reading the cookies back gives the exact domain and
 * path to preserve.
 *
 * Throws when there is nothing to corrupt: a caller that was never signed in would otherwise get
 * a green test proving only that an unauthenticated visitor is redirected.
 */
export async function corruptStoredSession(page: Page): Promise<void> {
  const context = page.context();
  const sessionCookies = (await context.cookies()).filter((cookie) =>
    SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name)
  );

  if (sessionCookies.length === 0) {
    throw new Error(
      'corruptStoredSession: no Supabase auth cookie found — the page is not signed in, so this would assert nothing.'
    );
  }

  await context.addCookies(
    sessionCookies.map((cookie) => ({ ...cookie, value: 'base64-not-a-session' }))
  );
}
