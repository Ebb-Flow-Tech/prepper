'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useAppState } from '@/lib/store';
import { loginUser } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import type { AuthApiError } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  /** Only allow relative paths starting with `/` (blocks `javascript:`, `//`, etc.) */
  const isValidRedirectPath = (path: string) =>
    typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await loginUser(email, password);

      toast.success('Login successful');
      login(
        response.user.id,
        response.access_token,
        response.user.user_type,
        response.refresh_token,
        response.user.username,
        response.user.email,
        response.user.is_manager,
        response.user.outlet_id ?? null
      );

      // Determine redirect destination (priority: URL param > tasting redirect > last route > default)
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get('redirect');
      const storedRedirect = localStorage.getItem('tasting_redirect_url');
      const storedLastRoute = localStorage.getItem('prepper_last_route');
      const raw = redirectParam || storedRedirect || storedLastRoute || '/outlets';
      const destination = isValidRedirectPath(raw) ? raw : '/outlets';

      // Persist destination so AuthGuard picks it up when it detects auth
      // state change (prevents race condition where AuthGuard redirects to
      // a stale route before router.push fires)
      localStorage.setItem('prepper_last_route', destination);

      // Clean up one-time tasting redirect
      if (storedRedirect) {
        localStorage.removeItem('tasting_redirect_url');
      }

      router.push(destination);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const apiError = err as AuthApiError;
      const errorMessage = apiError.message || 'Invalid email or password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">Log in to Reciperep</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg bg-[var(--color-feedback-error-tint)] p-3 text-sm text-[var(--color-feedback-error)]">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isGoogleLoading}
            onClick={async () => {
              setIsGoogleLoading(true);
              setError('');
              try {
                const supabase = createClient();
                const { error: oauthError } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: window.location.origin + '/auth/callback',
                  },
                });
                if (oauthError) {
                  setError(oauthError.message);
                  setIsGoogleLoading(false);
                }
              } catch {
                setError('An unexpected error occurred');
                setIsGoogleLoading(false);
              }
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isGoogleLoading ? 'Redirecting...' : 'Sign in with Google'}
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-[var(--color-text-link)] hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
