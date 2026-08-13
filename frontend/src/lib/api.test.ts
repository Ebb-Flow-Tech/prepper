import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const performSignOut = vi.fn(async () => {});

vi.mock('@/lib/supabase/activeClient', () => ({
  getActiveSupabaseClient: () => ({ auth: { getSession } }),
}));
vi.mock('@/lib/auth/signOut', () => ({
  performSignOut: () => performSignOut(),
}));

function session(accessToken: string) {
  return { data: { session: { access_token: accessToken } }, error: null };
}
const noSession = { data: { session: null }, error: null };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('the acting-org header', () => {
  it('sends X-Organization-Id from the activeOrgId store, beside the bearer token', async () => {
    localStorage.setItem('prepper_active_org_id', 'org-abc');
    getSession.mockResolvedValue(session('tok'));
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1' }));

    const { getMe } = await import('./api');
    await getMe();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['X-Organization-Id']).toBe('org-abc');
    expect(headers['Authorization']).toBe('Bearer tok');
  });

  it('omits the header when no org is selected — the server resolves a single-org user itself', async () => {
    getSession.mockResolvedValue(session('tok'));
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1' }));

    const { getMe } = await import('./api');
    await getMe();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers).not.toHaveProperty('X-Organization-Id');
  });
});

describe('the 401 rule', () => {
  it('retries once, and the retry carries the FRESH token', async () => {
    getSession.mockResolvedValueOnce(session('stale')); // request
    getSession.mockResolvedValueOnce(session('fresh')); // probe after the 401
    getSession.mockResolvedValueOnce(session('fresh')); // retry
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 'u1' }));

    const { getMe } = await import('./api');
    await expect(getMe()).resolves.toEqual({ id: 'u1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Counting calls is not enough: a retry that re-sent the stale token would 401 again and
    // still satisfy a call-count assertion. The point of the retry is the new credential.
    const first = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    const retry = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(first['Authorization']).toBe('Bearer stale');
    expect(retry['Authorization']).toBe('Bearer fresh');
    expect(performSignOut).not.toHaveBeenCalled();
  });

  it('retries at most once — a second 401 is surfaced, not re-probed', async () => {
    getSession.mockResolvedValueOnce(session('stale'));
    getSession.mockResolvedValueOnce(session('fresh'));
    getSession.mockResolvedValue(session('fresh'));
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'still no' }));

    const { getMe } = await import('./api');
    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(performSignOut).not.toHaveBeenCalled();
  });

  it('signs out and throws when there is no session — a genuine revocation', async () => {
    getSession.mockResolvedValueOnce(session('dead'));
    getSession.mockResolvedValueOnce(noSession);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'revoked' }));

    const { getMe } = await import('./api');
    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    expect(performSignOut).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT sign out when the session lookup throws — an outage must not mass-log-out', async () => {
    getSession.mockResolvedValueOnce(session('tok'));
    getSession.mockRejectedValueOnce(new Error('network down'));
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'nope' }));

    const { getMe } = await import('./api');
    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    expect(performSignOut).not.toHaveBeenCalled();
  });

  it('does NOT sign out when getSession reports an error rather than a verdict', async () => {
    getSession.mockResolvedValueOnce(session('tok'));
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('5xx') });
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'nope' }));

    const { getMe } = await import('./api');
    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    expect(performSignOut).not.toHaveBeenCalled();
  });

  it('does NOT sign out or retry when the token the server rejected is still the current one', async () => {
    getSession.mockResolvedValue(session('same'));
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'issuer unavailable' }));

    const { getMe } = await import('./api');
    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(performSignOut).not.toHaveBeenCalled();
  });

  it('does NOT sign out off the browser — there is no client to ask and no document to clear', async () => {
    // Route handlers import this module (app/api/generate-image uploads through it) and the
    // backend is default-deny, so a tokenless server-side 401 is routine. Treating it as a
    // verdict would call performSignOut(), whose first act reads document.cookie — a
    // ReferenceError escaping in place of the ApiError every caller is typed for.
    vi.stubGlobal('window', undefined);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Not authenticated' }));

    const { getMe } = await import('./api');
    await expect(getMe()).rejects.toMatchObject({ status: 401 });

    expect(performSignOut).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('surfaces a 401 to every one of several concurrent callers', async () => {
    getSession.mockResolvedValueOnce(session('dead'));
    getSession.mockResolvedValue(noSession);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'revoked' }));

    const { getMe } = await import('./api');
    const results = await Promise.allSettled([getMe(), getMe(), getMe()]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    // Each caller asks; performSignOut itself collapses them into one teardown (see
    // signOut.test.ts) — that de-duplication is deliberately NOT this module's job.
    expect(performSignOut).toHaveBeenCalled();
  });
});

describe('the sign-out request itself', () => {
  it('opts out of the 401 rule, so signing out with a dead token cannot re-enter sign-out', async () => {
    getSession.mockResolvedValue(noSession);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Not authenticated' }));

    const { logoutUser } = await import('./api');
    await expect(logoutUser()).rejects.toMatchObject({ status: 401 });

    // performSignOut() shares one in-flight promise between concurrent callers, so a call made
    // from inside its own body would await itself and deadlock. logoutUser() is the only request
    // it makes, and this is what keeps it from becoming one.
    expect(performSignOut).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
