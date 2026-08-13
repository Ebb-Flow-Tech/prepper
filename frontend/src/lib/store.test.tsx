import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/**
 * The store no longer owns tokens, so two things it now does are invisible to `next build` and
 * catastrophic when wrong:
 *
 *  - `isAuthResolving` must settle. It gates `AuthGuard`, so a value stuck at `true` renders the
 *    entire app as `null`, and one that never turns `false` on a signed-out user hangs /login.
 *  - `login()` must write the provider cookie BEFORE handing tokens to a client. The cookie is
 *    what every later `getActiveSupabaseClient()` reads to find the session again; write it after
 *    and there is a window in which the session exists on a client nothing will look at.
 */

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;

let authCallback: AuthCallback | null = null;
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn((cb: AuthCallback) => {
  authCallback = cb;
  return { data: { subscription: { unsubscribe } } };
});

/** Mirrors auth-js: an auth failure is a RETURNED error, not a throw. */
type SetSessionResult = { data: unknown; error: Error | null };
const setSession = vi.fn(async (): Promise<SetSessionResult> => ({ data: {}, error: null }));
const setAuthProviderCookie = vi.fn();
const getMe = vi.fn(async () => ({ id: 'user-1', username: 'chef', email: 'chef@example.test' }));
const clearQueryCache = vi.fn();

/** Externally visible order of the steps `login()` and `setActiveOrgId()` perform. */
let callOrder: string[];

/** The promise from the most recent `login()`, so a test can await it without a nested act(). */
let loginPromise: Promise<void> | null = null;

vi.mock('@/lib/supabase/activeClient', () => ({
  getActiveSupabaseClient: () => ({ auth: { onAuthStateChange } }),
  setAuthProviderCookie: (provider: string) => setAuthProviderCookie(provider),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { setSession } }),
}));
vi.mock('@/lib/api', () => ({ getMe: () => getMe() }));
vi.mock('@/lib/query-client-ref', () => ({ getQueryClient: () => ({ clear: clearQueryCache }) }));
vi.mock('@/lib/auth-interceptor', () => ({ registerLogoutCallback: vi.fn() }));

async function renderStore() {
  const { AppProvider, useAppState } = await import('./store');

  function Probe() {
    const { userId, username, activeOrgId, isAuthResolving, login, setActiveOrgId } = useAppState();
    return (
      <div>
        <span data-testid="resolving">{String(isAuthResolving)}</span>
        <span data-testid="userId">{userId ?? 'none'}</span>
        <span data-testid="username">{username ?? 'none'}</span>
        <span data-testid="activeOrgId">{activeOrgId ?? 'none'}</span>
        <button
          onClick={() => {
            const pending = login('user-1', 'access-tok', 'refresh-tok', 'chef', 'chef@example.test');
            loginPromise = pending;
            // Tests assert on `loginPromise`; attaching a handler here keeps a deliberately
            // rejected login from being reported as an unhandled rejection first.
            pending.catch(() => {});
          }}
        >
          sign in
        </button>
        <button onClick={() => setActiveOrgId('org-b')}>switch org</button>
      </div>
    );
  }

  return render(
    <AppProvider>
      <Probe />
    </AppProvider>
  );
}

function click(name: string) {
  return act(async () => {
    screen.getByRole('button', { name }).click();
  });
}

function emit(event: AuthChangeEvent, session: Session | null) {
  return act(async () => {
    authCallback?.(event, session);
  });
}

const aSession = (userId: string) => ({ user: { id: userId } }) as unknown as Session;

beforeEach(() => {
  vi.resetModules();
  authCallback = null;
  callOrder = [];
  loginPromise = null;
  localStorage.clear();
  setAuthProviderCookie.mockImplementation((provider: string) => {
    callOrder.push(`cookie:${provider}`);
  });
  setSession.mockImplementation(async () => {
    callOrder.push('setSession');
    return { data: {}, error: null };
  });
  clearQueryCache.mockImplementation(() => {
    callOrder.push(`clearCache:${localStorage.getItem('prepper_active_org_id') ?? 'none'}`);
  });
  getMe.mockResolvedValue({ id: 'user-1', username: 'chef', email: 'chef@example.test' });
});

afterEach(() => {
  // Explicit: without it a leftover tree from one test is still mounted during the next, and its
  // subscription keeps answering auth events.
  cleanup();
  vi.clearAllMocks();
});

describe('isAuthResolving', () => {
  it('starts true so AuthGuard does not decide before identity has landed', async () => {
    await renderStore();

    expect(screen.getByTestId('resolving')).toHaveTextContent('true');
    expect(screen.getByTestId('userId')).toHaveTextContent('none');
  });

  it('settles to false with no user when the restored session is absent', async () => {
    await renderStore();

    await emit('INITIAL_SESSION', null);

    // A signed-out user must reach a settled state, or /login renders forever.
    expect(screen.getByTestId('resolving')).toHaveTextContent('false');
    expect(screen.getByTestId('userId')).toHaveTextContent('none');
  });

  it('settles to false with the identity from /auth/me when a session is restored', async () => {
    await renderStore();

    await emit('INITIAL_SESSION', aSession('sub-1'));

    await waitFor(() => expect(screen.getByTestId('userId')).toHaveTextContent('user-1'));
    expect(screen.getByTestId('username')).toHaveTextContent('chef');
    expect(screen.getByTestId('resolving')).toHaveTextContent('false');
  });

  it('settles to false when /auth/me refuses the session, rather than hanging the app', async () => {
    getMe.mockRejectedValue(new Error('403'));
    await renderStore();

    await emit('INITIAL_SESSION', aSession('sub-1'));

    await waitFor(() => expect(screen.getByTestId('resolving')).toHaveTextContent('false'));
    expect(screen.getByTestId('userId')).toHaveTextContent('none');
  });

  it('does not re-fetch identity on TOKEN_REFRESHED — a new token for the same person', async () => {
    await renderStore();

    await emit('INITIAL_SESSION', aSession('sub-1'));
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));

    await emit('TOKEN_REFRESHED', aSession('sub-1'));

    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch identity when the same subject is re-announced', async () => {
    await renderStore();

    await emit('INITIAL_SESSION', aSession('sub-1'));
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));

    await emit('SIGNED_IN', aSession('sub-1'));

    expect(getMe).toHaveBeenCalledTimes(1);
  });
});

describe('login', () => {
  it('writes the provider cookie BEFORE handing the tokens to the client', async () => {
    await renderStore();
    await emit('INITIAL_SESSION', null);

    await click('sign in');

    // The cookie is what every later getActiveSupabaseClient() reads to find this session again.
    // Written after setSession, there is a window in which the session sits on a client nothing
    // will look at.
    expect(callOrder.indexOf('cookie:app-native')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('cookie:app-native')).toBeLessThan(callOrder.indexOf('setSession'));
  });

  it("installs the session on Prepper's own client and marks it app-native", async () => {
    await renderStore();
    await emit('INITIAL_SESSION', null);

    await click('sign in');

    expect(setAuthProviderCookie).toHaveBeenCalledWith('app-native');
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-tok',
      refresh_token: 'refresh-tok',
    });
  });

  it('does NOT publish identity until setSession has resolved', async () => {
    let releaseSetSession!: () => void;
    setSession.mockImplementationOnce(async () => {
      callOrder.push('setSession');
      await new Promise<void>((r) => {
        releaseSetSession = r;
      });
      return { data: {}, error: null };
    });

    await renderStore();
    await emit('INITIAL_SESSION', null);

    await click('sign in');

    // setSession is a network round trip (_getUser) for a non-expired token. Publishing identity
    // inside that window lets AuthGuard navigate, mounts the protected tree, and its queries hit
    // a client with no session yet — every one 401s and the 401 rule signs the user out. A login
    // that immediately un-logs-in.
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('userId')).toHaveTextContent('none');

    await act(async () => {
      releaseSetSession();
      await loginPromise;
    });

    expect(screen.getByTestId('userId')).toHaveTextContent('user-1');
    expect(screen.getByTestId('resolving')).toHaveTextContent('false');
  });

  it('does NOT publish identity when setSession returns an error', async () => {
    // auth-js's _setSession catches isAuthError and RETURNS { data: { session: null }, error } —
    // it does not throw. A rejected token therefore resolves normally, and publishing identity on
    // that resolve puts a signed-in UI in front of a client with no session: the same failure the
    // await ordering exists to prevent, reached through a different door.
    setSession.mockImplementationOnce(async () => {
      callOrder.push('setSession');
      return { data: { session: null, user: null }, error: new Error('Invalid refresh token') };
    });

    await renderStore();
    await emit('INITIAL_SESSION', null);

    await click('sign in');

    await expect(loginPromise).rejects.toThrow('Invalid refresh token');
    expect(screen.getByTestId('userId')).toHaveTextContent('none');
    expect(screen.getByTestId('username')).toHaveTextContent('none');
  });
});

describe('setActiveOrgId', () => {
  it('persists the new org BEFORE clearing the cache that triggers the refetch wave', async () => {
    await renderStore();
    await emit('INITIAL_SESSION', null);

    await click('switch org');

    // api.ts reads the org from localStorage at request time, and clear() notifies its observers
    // on a microtask. Persist second and the refetch wave CAUSED by the switch carries the old
    // org id — and since query keys do not include the org, those responses cache and render
    // under the newly selected org and are never refetched. A persistent wrong-org render.
    expect(callOrder).toContain('clearCache:org-b');
    expect(localStorage.getItem('prepper_active_org_id')).toBe('org-b');
    expect(screen.getByTestId('activeOrgId')).toHaveTextContent('org-b');
  });

  it('does nothing at all when the org is unchanged', async () => {
    localStorage.setItem('prepper_active_org_id', 'org-b');
    await renderStore();
    await emit('INITIAL_SESSION', null);
    clearQueryCache.mockClear();

    await click('switch org');

    // Clearing the whole cache for a no-op switch would throw away every page's data.
    expect(clearQueryCache).not.toHaveBeenCalled();
  });
});

describe('hydration housekeeping', () => {
  it('drops the legacy prepper_auth blob, which held a refresh token', async () => {
    localStorage.setItem('prepper_auth', JSON.stringify({ jwt: 'j', refreshToken: 'r' }));

    await renderStore();

    // Nothing reads it any more, and getting tokens out of localStorage is the point of the
    // migration — a stale copy must not sit there forever.
    expect(localStorage.getItem('prepper_auth')).toBeNull();
  });

  it('restores the acting org from its own key', async () => {
    localStorage.setItem('prepper_active_org_id', 'org-a');

    await renderStore();

    expect(screen.getByTestId('activeOrgId')).toHaveTextContent('org-a');
  });

  it('unsubscribes from auth state on unmount', async () => {
    const view = await renderStore();
    unsubscribe.mockClear();

    view.unmount();

    // A leaked subscription keeps calling setState on an unmounted tree, and survives a provider
    // remount — two listeners then race to resolve identity.
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('a slow /auth/me', () => {
  it('does not resurrect identity when the session ended while it was in flight', async () => {
    let releaseGetMe!: (value: { id: string; username: string; email: string }) => void;
    getMe.mockImplementationOnce(
      () =>
        new Promise((r) => {
          releaseGetMe = r;
        })
    );

    await renderStore();
    await emit('INITIAL_SESSION', aSession('sub-1'));
    await emit('SIGNED_OUT', null);

    expect(screen.getByTestId('userId')).toHaveTextContent('none');

    await act(async () => {
      releaseGetMe({ id: 'user-1', username: 'chef', email: 'chef@example.test' });
    });

    // Publishing now would show a signed-in user against a session that is gone.
    expect(screen.getByTestId('userId')).toHaveTextContent('none');
    expect(screen.getByTestId('resolving')).toHaveTextContent('false');
  });
});
