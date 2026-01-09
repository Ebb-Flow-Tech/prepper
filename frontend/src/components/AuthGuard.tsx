'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';

const PUBLIC_ROUTES = ['/login', '/register'];
const LAST_ROUTE_KEY = 'prepper_last_route';

function getLastRoute(): string {
  if (typeof window === 'undefined') return '/';
  return localStorage.getItem(LAST_ROUTE_KEY) || '/';
}

function setLastRoute(route: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ROUTE_KEY, route);
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = !!userId;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Save last visited route (excluding public routes)
  useEffect(() => {
    if (!isPublicRoute && pathname) {
      setLastRoute(pathname);
    }
  }, [pathname, isPublicRoute]);

  useEffect(() => {
    if (isAuthenticated && isPublicRoute) {
      // Logged in user on login/register page -> redirect to last route
      const lastRoute = getLastRoute();
      router.replace(lastRoute);
    } else if (!isAuthenticated && !isPublicRoute) {
      // Not logged in on protected page -> redirect to login
      router.replace('/login');
    }
  }, [isAuthenticated, isPublicRoute, router]);

  // Show nothing while redirecting
  if (isAuthenticated && isPublicRoute) {
    return null;
  }
  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
