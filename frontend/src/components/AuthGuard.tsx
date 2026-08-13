'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';
import { LAST_ROUTE_KEY } from '@/lib/auth-interceptor';
import {
  DEFAULT_POST_LOGIN_DESTINATION,
  sanitizeRelativeDestination,
} from '@/lib/auth/postLoginDestination';

const PUBLIC_ROUTES = ['/', '/login'];

// Valid route patterns in the app
const VALID_ROUTE_PATTERNS = [
  /^\/$/,                                    // Home (redirects)
  /^\/login$/,                               // Login
  /^\/canvas$/,                              // Canvas
  /^\/recipes$/,                             // Recipes list
  /^\/recipes\/[^/]+$/,                      // Recipe detail
  /^\/ingredients$/,                         // Ingredients list
  /^\/ingredients\/[^/]+$/,                  // Ingredient detail
  /^\/suppliers$/,                           // Suppliers list
  /^\/suppliers\/[^/]+$/,                    // Supplier detail
  /^\/recipe-categories\/[^/]+$/,            // Recipe category detail
  /^\/tastings$/,                            // Tastings list
  /^\/tastings\/new$/,                       // New tasting
  /^\/tastings\/invite\/[^/]+$/,             // Tasting invite redirect
  /^\/tastings\/[^/]+$/,                     // Tasting detail
  /^\/tastings\/[^/]+\/r\/[^/]+$/,           // Tasting recipe notes
  /^\/tastings\/[^/]+\/i\/[^/]+$/,           // Tasting ingredient notes
  /^\/finance$/,                             // Finance
  /^\/rnd$/,                                 // R&D
  /^\/rnd\/r\/[^/]+$/,                       // R&D recipe detail
  /^\/menu$/,                                // Menu list
  /^\/menu\/new$/,                           // New menu
  /^\/menu\/edit\/[^/]+$/,                   // Edit menu
  /^\/menu\/preview\/[^/]+$/,                // Preview menu
  /^\/menu-sketch$/,                         // Menu sketch list
  /^\/menu-sketch\/[^/]+$/,                  // Menu sketch editor
  /^\/settings$/,                            // Settings
  /^\/auth\/callback$/,                      // OAuth callback bridge
  /^\/auth\/passport-callback$/,             // Passport hosted-login fragment handoff
];

// Routes that bypass auth checks (accessible by both authenticated and unauthenticated users)
const PASSTHROUGH_ROUTE_PATTERNS = [
  /^\/tastings\/invite\/[^/]+$/,
  /^\/auth\/callback$/, // self-manages session exchange + redirect
  /^\/auth\/passport-callback$/, // installs the Passport session from the URL fragment itself
];

function isValidRoute(pathname: string): boolean {
  return VALID_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}
/**
 * `LAST_ROUTE_KEY` is attacker-writable in practice: `/login?redirect=…` resolves into it, so a
 * crafted link can plant a value here that outlives the visit that planted it. This read is
 * therefore a security boundary, and it uses the SAME hardened check as the login and callback
 * pages — a private copy of a `startsWith('/')` test is what let tab/newline/backslash bypasses
 * through, and this file held the third copy of exactly that test.
 */
function getLastRoute(): string {
  if (typeof window === 'undefined') return '/';
  return (
    sanitizeRelativeDestination(localStorage.getItem(LAST_ROUTE_KEY)) ??
    DEFAULT_POST_LOGIN_DESTINATION
  );
}

function setLastRoute(route: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ROUTE_KEY, route);
}

// Separate component for search params to isolate Suspense boundary
function RouteTracker({ pathname, isPublicRoute, isPassthroughRoute }: { pathname: string; isPublicRoute: boolean; isPassthroughRoute: boolean }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only remember real, private, non-passthrough routes
    if (isValidRoute(pathname) && !isPublicRoute && !isPassthroughRoute) {
      const queryString = searchParams.toString();
      const fullRoute = queryString ? `${pathname}?${queryString}` : pathname;
      setLastRoute(fullRoute);
    }
  }, [pathname, searchParams, isPublicRoute, isPassthroughRoute]);

  return null;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId, isAuthResolving } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = !!userId;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isNotFound = !isValidRoute(pathname);
  const isPassthroughRoute = PASSTHROUGH_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

  // Authentication only. Authorisation is per-brand and belongs to the API and to the components
  // that read `my_role` from `usePassportBrands()` — never to a route-level role flag.
  useEffect(() => {
    // Identity now arrives over the network (session -> `GET /auth/me`), not from a synchronous
    // localStorage read. Deciding before it lands would bounce every deep link through /login —
    // and RouteTracker never renders on a route we redirect away from, so the destination is lost.
    if (isAuthResolving) return;

    if (isAuthenticated && isPublicRoute) {
      // Logged in user on the login page -> redirect to last route
      router.replace(getLastRoute());
    } else if (!isAuthenticated && !isPublicRoute && !isPassthroughRoute) {
      // Not logged in on protected page -> redirect to login
      // This includes session expiration (the session was revoked, not merely unreachable)
      // Passthrough routes handle their own auth logic
      router.replace('/login');
    }
  }, [isAuthResolving, isAuthenticated, isPublicRoute, isPassthroughRoute, router]);

  // Show nothing while redirecting
  if (isNotFound) {
    return null;
  }
  if (isAuthResolving && !isPublicRoute && !isPassthroughRoute) {
    return null;
  }
  if (isAuthenticated && isPublicRoute) {
    return null;
  }
  if (!isAuthenticated && !isPublicRoute && !isPassthroughRoute) {
    return null;
  }

  return (
    <>
      <Suspense fallback={null}>
        <RouteTracker pathname={pathname} isPublicRoute={isPublicRoute} isPassthroughRoute={isPassthroughRoute} />
      </Suspense>
      {children}
    </>
  );
}
