'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

const TASTING_REDIRECT_KEY = 'tasting_redirect_url';
const AUTH_STORAGE_KEY = 'prepper_auth';

export default function TastingInvitePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    const sessionUrl = `/tastings/${id}`;

    // Always save the redirect URL (so re-accessing the invite link re-saves it)
    localStorage.setItem(TASTING_REDIRECT_KEY, sessionUrl);

    // Check if user is authenticated by reading localStorage directly
    // (avoids hydration race condition with AppProvider)
    let isAuthenticated = false;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        isAuthenticated = !!parsed?.userId;
      }
    } catch {
      // Ignore parsing errors
      isAuthenticated = false;
    }

    if (isAuthenticated) {
      // User is logged in - go directly to the session
      router.replace(sessionUrl);
    } else {
      // User is not logged in - redirect to login with redirect parameter
      router.replace(`/login?redirect=${encodeURIComponent(sessionUrl)}`);
    }
  }, [id, router]);

  // Render nothing while redirecting
  return null;
}
