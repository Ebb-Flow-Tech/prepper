'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';

const PUBLIC_ROUTES = ['/login', '/register'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useAppState();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = !!userId;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isAuthenticated && isPublicRoute) {
      // Logged in user on login/register page -> redirect to home
      router.replace('/');
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
