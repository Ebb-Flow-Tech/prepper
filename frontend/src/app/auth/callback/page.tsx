'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAppState } from '@/lib/store';
import { completeOAuth } from '@/lib/api';
import {
  consumeTastingRedirect,
  rememberPostLoginDestination,
  resolvePostLoginDestination,
} from '@/lib/auth/postLoginDestination';

const BRIDGE_TIMEOUT_MS = 15_000;

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const bridgedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error_description') || params.get('error');
    const hasCode = !!params.get('code');

    if (oauthError) {
      setError(oauthError);
      return;
    }

    // Don't call exchangeCodeForSession manually — Supabase's detectSessionInUrl
    // does it once during client initialisation. A second exchange consumes a
    // verifier the first call already removed and throws "PKCE code verifier
    // not found in storage". Instead, wait for the SIGNED_IN event.
    const bridge = async (session: Session) => {
      if (bridgedRef.current) return;
      bridgedRef.current = true;

      try {
        const user = await completeOAuth(session.access_token);
        await login(
          user.id,
          session.access_token,
          session.refresh_token,
          user.username,
          user.email
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not complete sign-in');
        await supabase.auth.signOut();
        return;
      }

      const destination = resolvePostLoginDestination();
      rememberPostLoginDestination(destination);
      consumeTastingRedirect();

      router.replace(destination);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          bridge(session);
        }
      }
    );

    // If we landed here without a code and no existing session, go to login.
    if (!hasCode) {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session && !bridgedRef.current) {
          router.replace('/login');
        }
      })();
    }

    // Safety net: the auto-exchange failed silently or a provider redirect
    // dropped cookies — don't leave the user staring at "Completing sign-in…".
    const timeoutId = window.setTimeout(() => {
      if (!bridgedRef.current) {
        setError('Sign-in timed out. Please try again.');
      }
    }, BRIDGE_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, [router, login]);

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="max-w-sm text-center">
        {error ? (
          <>
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="text-sm font-medium underline"
            >
              Back to login
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        )}
      </div>
    </div>
  );
}
