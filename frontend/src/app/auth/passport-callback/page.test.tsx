import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PassportCallbackPage from './page';
import { TASTING_REDIRECT_KEY } from '@/lib/auth/postLoginDestination';
import { LAST_ROUTE_KEY } from '@/lib/auth-interceptor';

const setSession = vi.fn();
const setAuthProviderCookie = vi.fn();

vi.mock('@/lib/supabase/passportClient', () => ({
  createPassportClient: vi.fn(() => ({ auth: { setSession } })),
}));
vi.mock('@/lib/supabase/activeClient', () => ({
  setAuthProviderCookie: (provider: string) => setAuthProviderCookie(provider),
}));
// `next/link` reads the App Router context, which does not exist outside a Next runtime.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const replace = vi.fn();
const assign = vi.fn();
const CALLBACK_PATH = '/auth/passport-callback';

function stubLocation(hash: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hash,
      search: '',
      pathname: CALLBACK_PATH,
      origin: 'http://localhost:3000',
      assign,
      replace,
    },
  });
}

const VALID_FRAGMENT = '#access_token=at-123&refresh_token=rt-456';

describe('PassportCallbackPage', () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    setSession.mockResolvedValue({ error: null });
    stubLocation(VALID_FRAGMENT);
    replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /**
   * THE constraint of this page, and the reason it exists as a test rather than only a comment:
   * a refactor to `router.replace` breaks SSO silently, logs nothing, and would pass every other
   * test in the suite. `store.tsx` subscribes `onAuthStateChange` on the client named by the
   * provider cookie AT HYDRATION — this page arrived with that cookie still reading `app-native`,
   * so without a real page load the store keeps listening to the wrong client, no SIGNED_IN
   * arrives, and `AuthGuard` bounces the user to /login on a session that is genuinely valid.
   */
  it('leaves via a FULL PAGE LOAD, never a client-side navigation', async () => {
    // `location.replace` is a document load, exactly as `assign` was — the invariant is the full
    // page load, not which of the two performs it. A refactor to `router.replace` fails here:
    // this file mocks no `next/navigation`, so `useRouter()` throws for want of an App Router
    // context rather than silently passing.
    render(<PassportCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/recipes'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('strips the tokens from the address bar before anything can await', async () => {
    render(<PassportCallbackPage />);

    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(null, '', CALLBACK_PATH));
  });

  it('strips the tokens even when the sign-in fails and the page stays put', async () => {
    // The error branch never navigates, so without this the live access/refresh pair sits in the
    // address bar under "Sign-in didn't complete", ready to be pasted into a bug report.
    setSession.mockResolvedValue({ error: new Error('invalid token') });

    render(<PassportCallbackPage />);

    expect(await screen.findByText(/didn't complete/i)).toBeInTheDocument();
    expect(replaceState).toHaveBeenCalledWith(null, '', CALLBACK_PATH);
  });

  it('installs the fragment session on the PASSPORT client, then marks the cookie', async () => {
    render(<PassportCallbackPage />);

    await waitFor(() =>
      expect(setSession).toHaveBeenCalledWith({
        access_token: 'at-123',
        refresh_token: 'rt-456',
      })
    );
    await waitFor(() => expect(setAuthProviderCookie).toHaveBeenCalledWith('passport'));
  });

  it('lands on the destination parked before the round trip, and consumes the deep link', async () => {
    localStorage.setItem(TASTING_REDIRECT_KEY, '/tastings/9');

    render(<PassportCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/tastings/9'));
    expect(localStorage.getItem(LAST_ROUTE_KEY)).toBe('/tastings/9');
    expect(localStorage.getItem(TASTING_REDIRECT_KEY)).toBeNull();
  });

  it('installs the session once under StrictMode double-invoke', async () => {
    render(
      <StrictMode>
        <PassportCallbackPage />
      </StrictMode>
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(setSession).toHaveBeenCalledTimes(1);
  });

  it('shows an error and does not navigate when the fragment is missing', async () => {
    stubLocation('');

    render(<PassportCallbackPage />);

    expect(await screen.findByText(/didn't complete/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('does not flip the provider cookie when setSession rejects the tokens', async () => {
    // `setSession` resolves with an error rather than throwing, so a caller that only awaits it
    // would mark the cookie `passport` with no session behind it — stranding a still-valid
    // app-native session behind a marker nothing matches.
    setSession.mockResolvedValue({ error: new Error('invalid token') });

    render(<PassportCallbackPage />);

    expect(await screen.findByText(/didn't complete/i)).toBeInTheDocument();
    expect(setAuthProviderCookie).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
