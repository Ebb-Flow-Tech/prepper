'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getActiveSupabaseClient } from '@/lib/supabase/activeClient';
import { TASTING_REDIRECT_KEY } from '@/lib/auth/postLoginDestination';

export default function TastingInvitePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    const sessionUrl = `/tastings/${id}`;

    // Always save the redirect URL (so re-accessing the invite link re-saves it)
    localStorage.setItem(TASTING_REDIRECT_KEY, sessionUrl);

    // Ask the active Supabase client directly rather than waiting on AppProvider's identity
    // round trip — this route is a passthrough and decides for itself.
    (async () => {
      let hasSession = false;
      try {
        const { data } = await getActiveSupabaseClient().auth.getSession();
        hasSession = !!data.session;
      } catch {
        hasSession = false;
      }

      router.replace(
        hasSession ? sessionUrl : `/login?redirect=${encodeURIComponent(sessionUrl)}`
      );
    })();
  }, [id, router]);

  // Render nothing while redirecting
  return null;
}
