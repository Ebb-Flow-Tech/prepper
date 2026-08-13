'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPassportClient } from '@/lib/supabase/passportClient';
import { setAuthProviderCookie } from '@/lib/supabase/activeClient';
import {
  consumeTastingRedirect,
  rememberPostLoginDestination,
  resolvePostLoginDestination,
} from '@/lib/auth/postLoginDestination';
import { parsePassportCallbackFragment } from './parseFragment';

const SIGN_IN_FAILED_MESSAGE = "Sign-in didn't complete. Please try again.";

export default function PassportCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  /**
   * React StrictMode double-invokes effects in development, and `setSession` is a network call —
   * without this the same fragment would be installed twice and the second navigation could race
   * the first. `auth/callback/page.tsx` guards its own bridge the same way.
   */
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    const handle = async () => {
      const parsed = parsePassportCallbackFragment(window.location.hash);

      // Strip the tokens from the address bar NOW — synchronously, before the first `await`, and
      // before the error branch below can leave the user parked on this page. They are a live
      // access/refresh pair: left in place they sit in the address bar for the life of the page,
      // get copy-pasted into bug reports along with the URL, and survive in this history entry.
      window.history.replaceState(null, '', window.location.pathname);

      if (!parsed.ok) {
        setError(SIGN_IN_FAILED_MESSAGE);
        return;
      }

      try {
        const { error: sessionError } = await createPassportClient().auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        // `setSession` does NOT throw on a rejected token: `auth-js` catches auth errors and
        // returns `{ session: null, error }`, so the error has to be read rather than awaited.
        if (sessionError) {
          setError(SIGN_IN_FAILED_MESSAGE);
          return;
        }
      } catch {
        // Constructing the Passport client throws when its project is not configured — i.e. SSO
        // is off in this deployment and nothing should have reached this page.
        setError(SIGN_IN_FAILED_MESSAGE);
        return;
      }

      // Only after the session is installed: the cookie is what every later
      // `getActiveSupabaseClient()` reads, so pointing it at Passport before there is a session
      // there would strand a still-valid app-native session behind a marker nothing matches.
      setAuthProviderCookie('passport');

      const destination = resolvePostLoginDestination();
      rememberPostLoginDestination(destination);
      // The round trip is over and a session exists, so the one-shot tasting deep link can finally
      // be consumed — the login page deliberately left it in place in case SSO failed.
      consumeTastingRedirect();

      /*
       * A FULL PAGE LOAD, never `router.replace`/`router.push`. This is the single most important
       * line on this page.
       *
       * `store.tsx` subscribes `onAuthStateChange` on the client named by the provider cookie AT
       * HYDRATION ONLY. This page arrived with the cookie still reading `app-native`, so a
       * client-side navigation would leave the store listening to Prepper's own client while the
       * live session sits on the Passport one: no SIGNED_IN ever arrives, `isAuthResolving` is
       * already false, and `AuthGuard` bounces the user back to /login on a session that is
       * genuinely valid. It presents as "SSO is broken" and nothing logs.
       *
       * `replace`, not `assign`, and it still does a full document load — the invariant above is
       * preserved. The difference is history: the backend reached this page by a 302, which
       * creates no history entry of its own, so `assign` would leave this callback URL as the
       * Back target. `replace` drops it, and the user goes back to /login instead of to a
       * consumed callback.
       */
      window.location.replace(destination);
    };

    void handle();
  }, []);

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="max-w-sm text-center">
        {error ? (
          <>
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <Link href="/login" className="text-sm font-medium underline">
              Back to login
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        )}
      </div>
    </div>
  );
}
