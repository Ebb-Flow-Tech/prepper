'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useAppState } from '@/lib/store';
import { loginUser, resolveLoginRoute } from '@/lib/api';
import {
  consumeTastingRedirect,
  rememberPostLoginDestination,
  resolvePostLoginDestination,
} from '@/lib/auth/postLoginDestination';
import { createClient } from '@/lib/supabase/client';
import {
  UNEXPECTED_ERROR_MESSAGE,
  emailStepErrorMessage,
  passwordStepErrorMessage,
  submitEmailStep,
} from './resolveLogin';

/**
 * One message for all three backend failure codes (`passport_unavailable`,
 * `passport_sso_failed`, `passport_no_access`).
 *
 * Deliberately undifferentiated: telling the visitor which one they hit reports whether an address
 * has a Passport membership, and whether that membership still has access — the same enumeration
 * the two-valued router exists to avoid. Operators get the distinction in the backend logs.
 *
 * It must NOT offer a password as the way out, and must not point at a control on this screen.
 * There is no password field here — step 2 renders only after a successful `app-native` route —
 * and a member cannot reach one by retrying: `resolve_login_route` asks `is_active_member`, which
 * is still true, so the same address routes to Passport again. For `passport_no_access` and
 * `passport_unavailable` this screen is therefore a closed loop, and an empty entitlement
 * projection (a fresh environment where sync has not landed) puts EVERY member in it. Naming a
 * human is the only real escape hatch; promising a password field would be a second failure
 * dressed as help.
 */
const SSO_FAILURE_MESSAGE =
  "We couldn't complete your sign-in. Please try again in a few minutes — if it keeps happening, contact your workspace administrator.";

/** The codes `GET /auth/passport/{start,callback}` redirect back with (spec §4.2). */
const SSO_ERROR_CODES: readonly string[] = [
  'passport_unavailable',
  'passport_sso_failed',
  'passport_no_access',
];

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAppState();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam && SSO_ERROR_CODES.includes(errorParam)) {
      setError(SSO_FAILURE_MESSAGE);
    }
  }, [searchParams]);

  /**
   * Hand over to the backend's PKCE redirect.
   *
   * The destination is resolved and stored HERE, before leaving: `?redirect=` dies with this page,
   * and `/auth/passport-callback` returns on a fresh load carrying only the token fragment.
   * `tasting_redirect_url` is deliberately NOT consumed — the round trip can still fail, and
   * eating the deep link before a session exists loses the invite for good.
   */
  const startPassportLogin = (url: string) => {
    rememberPostLoginDestination(resolvePostLoginDestination());
    window.location.assign(url);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const route = await submitEmailStep({
        email,
        fetchResolveLogin: resolveLoginRoute,
        navigate: startPassportLogin,
      });
      if (route === 'app-native') {
        setStep('password');
        setIsLoading(false);
      }
      // On `passport` the button stays disabled: the browser is already leaving, and re-enabling
      // it lets a double-click fire a second `/auth/passport/start` — which burns the IP rate
      // limit and writes a second PKCE row that nothing will ever pop.
    } catch (err: unknown) {
      setError(emailStepErrorMessage(err));
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await loginUser(email, password);

      toast.success('Login successful');
      // Awaited: `login()` installs the session in the Supabase client over a network round trip.
      // Navigating first would mount the protected tree against a client that has no session yet,
      // and every query would 401 into a sign-out.
      await login(
        response.user.id,
        response.access_token,
        response.refresh_token,
        response.user.username,
        response.user.email
      );

      const destination = resolvePostLoginDestination();
      rememberPostLoginDestination(destination);
      // Safe to consume only now: a session exists, so the deep link cannot be stranded.
      consumeTastingRedirect();

      router.push(destination);
    } catch (err: unknown) {
      // Deliberately NOT logged. `ApiError` carries the response body, and a login route is the
      // likeliest place for a backend to echo the submitted address back — that is PII in the
      // browser console for no diagnostic value the banner below does not already give.
      const errorMessage = passwordStepErrorMessage(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
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
      setError(UNEXPECTED_ERROR_MESSAGE);
      setIsGoogleLoading(false);
    }
  };

  const errorBanner = error ? (
    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
      {error}
    </div>
  ) : null;

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">Log in to Reciperep</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                  autoComplete="email"
                  required
                />
              </div>
              {errorBanner}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Continuing...' : 'Continue'}
              </Button>
            </form>
          ) : (
            /*
             * Step 2 renders IN PLACE — same screen, no route change. The password field appears
             * only for an address the server routed `app-native`; a Passport member never sees it.
             */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input id="email" type="email" value={email} autoComplete="email" readOnly />
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
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
              {errorBanner}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log in'}
              </Button>
              <div className="flex justify-center">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setStep('email');
                    setPassword('');
                    setError('');
                  }}
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {/*
            Google renders on BOTH steps, outside the step ternary — matching geddit-one. This
            reverses spec D7 ("Google sits on step 2 only... the toggle the email-first design
            exists to remove"), a deliberate product decision made 2026-08-21: Google is now a
            front-door choice again, offered before the server has routed the address. See the
            spec's "Google sign-in by a member" section for the already-accepted consequences
            (MFA bypass, role write-back 401) that this reversal inherits unchanged.
          */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isGoogleLoading}
            onClick={handleGoogleSignIn}
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
