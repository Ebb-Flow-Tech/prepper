'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';

const PUBLIC_ROUTES = ['/', '/login', '/register'];

// Valid route patterns in the app
const VALID_ROUTE_PATTERNS = [
  /^\/$/,                                    // Home (redirects)
  /^\/login$/,                               // Login
  /^\/register$/,                            // Register
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
];

// Routes that bypass auth checks (accessible by both authenticated and unauthenticated users)
const PASSTHROUGH_ROUTE_PATTERNS = [
  /^\/tastings\/invite\/[^/]+$/,
  /^\/auth\/callback$/, // self-manages session exchange + redirect
];

function isValidRoute(pathname: string): boolean {
  return VALID_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}
const LAST_ROUTE_KEY = 'prepper_last_route';
const DEFAULT_ROUTE = '/recipes';

/** Only allow relative paths that start with `/` (no `//`, `javascript:`, etc.) */
function isValidRedirectPath(path: string): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

function getLastRoute(): string {
  if (typeof window === 'undefined') return '/';
  const stored = localStorage.getItem(LAST_ROUTE_KEY);
  return stored && isValidRedirectPath(stored) ? stored : DEFAULT_ROUTE;
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
  const { userId } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = !!userId;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isNotFound = !isValidRoute(pathname);
  const isPassthroughRoute = PASSTHROUGH_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

  // Authentication only. Authorisation is per-brand and belongs to the API and to the components
  // that read `my_role` from `usePassportBrands()` — never to a route-level role flag.
  useEffect(() => {
    if (isAuthenticated && isPublicRoute) {
      // Logged in user on login/register page -> redirect to last route
      router.replace(getLastRoute());
    } else if (!isAuthenticated && !isPublicRoute && !isPassthroughRoute) {
      // Not logged in on protected page -> redirect to login
      // This includes session expiration (token refresh failed)
      // Passthrough routes handle their own auth logic
      router.replace('/login');
    }
  }, [isAuthenticated, isPublicRoute, isPassthroughRoute, router]);

  // Show nothing while redirecting
  if (isNotFound) {
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
