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
  /^\/outlets$/,                             // Outlets list
  /^\/outlets\/[^/]+$/,                      // Outlet detail
  /^\/recipe-categories\/[^/]+$/,            // Recipe category detail
  /^\/tastings$/,                            // Tastings list
  /^\/tastings\/new$/,                       // New tasting
  /^\/tastings\/[^/]+$/,                     // Tasting detail
  /^\/tastings\/[^/]+\/r\/[^/]+$/,           // Tasting recipe notes
  /^\/tastings\/[^/]+\/i\/[^/]+$/,           // Tasting ingredient notes
  /^\/finance$/,                             // Finance
  /^\/rnd$/,                                 // R&D
  /^\/rnd\/r\/[^/]+$/,                       // R&D recipe detail
  /^\/design-system$/,                       // Design system
];

function isValidRoute(pathname: string): boolean {
  return VALID_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}
const LAST_ROUTE_KEY = 'prepper_last_route';

function getLastRoute(): string {
  if (typeof window === 'undefined') return '/';
  return localStorage.getItem(LAST_ROUTE_KEY) || '/recipes';
}

function setLastRoute(route: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ROUTE_KEY, route);
}

// Separate component for search params to isolate Suspense boundary
function RouteTracker({ pathname, isPublicRoute }: { pathname: string; isPublicRoute: boolean }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isValidRoute(pathname) && !isPublicRoute) {
      const queryString = searchParams.toString();
      const fullRoute = queryString ? `${pathname}?${queryString}` : pathname;
      setLastRoute(fullRoute);
    }
  }, [pathname, searchParams, isPublicRoute]);

  return null;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = !!userId;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isNotFound = !isValidRoute(pathname);

  useEffect(() => {
    if (isAuthenticated && isPublicRoute) {
      // Logged in user on login/register page -> redirect to last route
      const lastRoute = getLastRoute();
      router.replace(lastRoute);
    } else if (!isAuthenticated && !isPublicRoute) {
      // Not logged in on protected page -> redirect to login
      router.replace('/login');
    }
  }, [isAuthenticated, isPublicRoute, isNotFound, router]);

  // Show nothing while redirecting
  if (isNotFound) {
    return null;
  }
  if (isAuthenticated && isPublicRoute) {
    return null;
  }
  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return (
    <>
      <Suspense fallback={null}>
        <RouteTracker pathname={pathname} isPublicRoute={isPublicRoute} />
      </Suspense>
      {children}
    </>
  );
}
