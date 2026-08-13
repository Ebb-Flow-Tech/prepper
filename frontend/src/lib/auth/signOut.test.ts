import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn(async () => ({ error: null }));
const getActiveSupabaseClient = vi.fn(() => ({ auth: { signOut } }));
const clearAuthProviderCookie = vi.fn();
const logoutUser = vi.fn(async () => {});
const triggerLogout = vi.fn();

vi.mock('@/lib/supabase/activeClient', () => ({
  getActiveSupabaseClient: () => getActiveSupabaseClient(),
  clearAuthProviderCookie: () => clearAuthProviderCookie(),
}));
vi.mock('@/lib/api', () => ({ logoutUser: () => logoutUser() }));
vi.mock('@/lib/auth-interceptor', () => ({ triggerLogout: () => triggerLogout() }));

/** The order in which the sequence's externally visible steps actually happened. */
let callOrder: string[];

beforeEach(async () => {
  vi.resetModules();
  callOrder = [];
  getActiveSupabaseClient.mockImplementation(() => {
    callOrder.push('resolveClient');
    return { auth: { signOut } };
  });
  signOut.mockImplementation(async () => {
    callOrder.push('signOut');
    return { error: null };
  });
  clearAuthProviderCookie.mockImplementation(() => {
    callOrder.push('clearCookie');
  });
  logoutUser.mockImplementation(async () => {
    callOrder.push('logoutUser');
  });
  triggerLogout.mockImplementation(() => {
    callOrder.push('triggerLogout');
  });
  vi.stubGlobal('document', { cookie: 'prepper_auth_provider=app-native' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('performSignOut', () => {
  it('passes scope: "local" explicitly — the SDK default is "global"', async () => {
    const { performSignOut } = await import('./signOut');

    await performSignOut();

    // A global sign-out revokes the refresh token server-side for EVERY session sharing it:
    // for a Passport-minted session that signs the user out of Passport's own hosted login
    // and every other consumer app. Recorded as a production incident on 2026-08-11.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('resolves the active client BEFORE clearing the cookie', async () => {
    const { performSignOut } = await import('./signOut');

    await performSignOut();

    // getActiveSupabaseClient() re-reads the cookie on every call. Clear it first and "the
    // active client" resolves to the absent-cookie default (app-native) whatever was really
    // active — signing out of a client the user was never signed into and leaving the real
    // session live while the app merely looks signed out.
    expect(callOrder.indexOf('resolveClient')).toBeLessThan(callOrder.indexOf('clearCookie'));
    expect(callOrder.indexOf('signOut')).toBeLessThan(callOrder.indexOf('clearCookie'));
  });

  it('calls the backend logout for an app-native session, while its token is still live', async () => {
    const { performSignOut } = await import('./signOut');

    await performSignOut();

    expect(logoutUser).toHaveBeenCalledTimes(1);
    // POST /auth/logout requires a bearer token; after the client signOut there is none, so
    // the call would 401 and be a permanent no-op.
    expect(callOrder.indexOf('logoutUser')).toBeLessThan(callOrder.indexOf('signOut'));
  });

  it('skips the backend logout for a passport session', async () => {
    vi.stubGlobal('document', { cookie: 'prepper_auth_provider=passport' });
    const { performSignOut } = await import('./signOut');

    await performSignOut();

    // The backend sees a bearer token and cannot tell which project minted it — and should not
    // have to. The marker is a frontend cookie, so the frontend skips the call.
    expect(logoutUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('clears local state through the interceptor callback', async () => {
    const { performSignOut } = await import('./signOut');

    await performSignOut();

    expect(triggerLogout).toHaveBeenCalledTimes(1);
  });

  it('tears the session down even when the backend logout fails', async () => {
    logoutUser.mockRejectedValueOnce(new Error('backend unreachable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { performSignOut } = await import('./signOut');

    await performSignOut();

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearAuthProviderCookie).toHaveBeenCalledTimes(1);
    expect(triggerLogout).toHaveBeenCalledTimes(1);
  });

  it('still clears the cookie and local state when the CLIENT cannot even be constructed', async () => {
    // The rollback state: SSO switched off, the frontend redeployed without the Passport env, and
    // a user still holding `prepper_auth_provider=passport`. `createPassportClient()` passes
    // `process.env.NEXT_PUBLIC_PASSPORT_SUPABASE_URL!` straight into the SDK, so resolving the
    // active client THROWS. Resolved above the `try`, that escaped before any cleanup ran and left
    // the cookie, the store state and the query cache live — on the one path whose entire job is
    // to leave nothing behind.
    vi.stubGlobal('document', { cookie: 'prepper_auth_provider=passport' });
    getActiveSupabaseClient.mockImplementationOnce(() => {
      throw new Error('@supabase/ssr: Your project\'s URL and API key are required');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { performSignOut } = await import('./signOut');

    await expect(performSignOut()).resolves.toBeUndefined();

    expect(clearAuthProviderCookie).toHaveBeenCalledTimes(1);
    expect(triggerLogout).toHaveBeenCalledTimes(1);
    // `passport` provider: the backend logout is skipped by design, so nothing else can have run.
    expect(logoutUser).not.toHaveBeenCalled();
  });

  it('still clears the cookie and local state when signOut() itself throws', async () => {
    signOut.mockRejectedValueOnce(new Error('gotrue down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { performSignOut } = await import('./signOut');

    await expect(performSignOut()).resolves.toBeUndefined();

    // Abandoning teardown here would leave the cookie and local state behind — exactly the
    // inconsistent state this helper exists to prevent, and what the next page load re-hydrates
    // from. It must also not throw: a non-ApiError escaping fetchApi's 401 path breaks callers.
    expect(clearAuthProviderCookie).toHaveBeenCalledTimes(1);
    expect(triggerLogout).toHaveBeenCalledTimes(1);
  });
});

describe('performSignOut concurrency', () => {
  /** A promise the test resolves by hand, to hold teardown open across concurrent callers. */
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('collapses concurrent callers into ONE teardown that they all await', async () => {
    const gate = deferred();
    logoutUser.mockImplementationOnce(async () => {
      callOrder.push('logoutUser');
      await gate.promise;
    });
    const { performSignOut } = await import('./signOut');

    // The realistic shape: a page with many queries in flight gets many simultaneous 401s.
    const all = Promise.all([performSignOut(), performSignOut(), performSignOut()]);
    gate.resolve();
    await all;

    expect(logoutUser).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearAuthProviderCookie).toHaveBeenCalledTimes(1);
    expect(triggerLogout).toHaveBeenCalledTimes(1);
  });

  it('makes every concurrent caller wait for the REAL teardown, not a no-op resolve', async () => {
    const gate = deferred();
    logoutUser.mockImplementationOnce(async () => {
      callOrder.push('logoutUser');
      await gate.promise;
    });
    const { performSignOut } = await import('./signOut');

    void performSignOut();
    let secondSettled = false;
    const second = performSignOut().then(() => {
      secondSettled = true;
    });

    await Promise.resolve();
    // Returning early would resolve here, and TopNav would fire window.location.assign
    // mid-teardown, while the session is still live.
    expect(secondSettled).toBe(false);

    gate.resolve();
    await second;
    expect(secondSettled).toBe(true);
    expect(triggerLogout).toHaveBeenCalledTimes(1);
  });

  it('releases the slot so a later sign-out still runs', async () => {
    const { performSignOut } = await import('./signOut');

    await performSignOut();
    await performSignOut();

    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('releases the slot even after a teardown that failed', async () => {
    signOut.mockRejectedValueOnce(new Error('gotrue down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { performSignOut } = await import('./signOut');

    await performSignOut();
    await performSignOut();

    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
