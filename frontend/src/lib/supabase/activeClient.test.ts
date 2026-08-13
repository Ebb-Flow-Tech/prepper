import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ createClient: vi.fn(() => ({ marker: 'app-native' })) }));
vi.mock('./passportClient', () => ({
  createPassportClient: vi.fn(() => ({ marker: 'passport' })),
}));

// jsdom supplies a real `document` whose `cookie` accessor accumulates writes, so
// every test stubs a plain object instead: it makes the last write readable and
// lets `vi.stubGlobal('document', undefined)` exercise the server-render guard.
describe('getActiveSupabaseClient', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: '' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns the app-native client when the cookie is absent', async () => {
    const { getActiveSupabaseClient } = await import('./activeClient');
    expect((getActiveSupabaseClient() as unknown as { marker: string }).marker).toBe('app-native');
  });

  it('returns the passport client when the cookie says passport', async () => {
    vi.stubGlobal('document', { cookie: 'prepper_auth_provider=passport' });
    const { getActiveSupabaseClient } = await import('./activeClient');
    expect((getActiveSupabaseClient() as unknown as { marker: string }).marker).toBe('passport');
  });

  it('re-reads the cookie on every call — never memoized', async () => {
    const { getActiveSupabaseClient } = await import('./activeClient');
    expect((getActiveSupabaseClient() as unknown as { marker: string }).marker).toBe('app-native');

    vi.stubGlobal('document', { cookie: 'prepper_auth_provider=passport' });
    expect((getActiveSupabaseClient() as unknown as { marker: string }).marker).toBe('passport');
  });

  it('throws when called outside a browser context (never during server rendering)', async () => {
    vi.stubGlobal('document', undefined);
    const { getActiveSupabaseClient } = await import('./activeClient');

    expect(() => getActiveSupabaseClient()).toThrow(/must only be called client-side/);
  });
});

describe('setAuthProviderCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the cookie with the shared attributes', async () => {
    const docStub = { cookie: '' };
    vi.stubGlobal('document', docStub);
    const { setAuthProviderCookie } = await import('./activeClient');

    setAuthProviderCookie('passport');

    expect(docStub.cookie).toContain('prepper_auth_provider=passport');
    expect(docStub.cookie).toContain('path=/');
    expect(docStub.cookie).toContain('SameSite=lax');
  });

  it('throws when called outside a browser context (never during server rendering)', async () => {
    vi.stubGlobal('document', undefined);
    const { setAuthProviderCookie } = await import('./activeClient');

    expect(() => setAuthProviderCookie('passport')).toThrow(/must only be called client-side/);
  });
});

describe('clearAuthProviderCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the cookie using AUTH_PROVIDER_COOKIE_OPTIONS.path, not a hardcoded value', async () => {
    const docStub = { cookie: '' };
    vi.stubGlobal('document', docStub);
    const { clearAuthProviderCookie } = await import('./activeClient');
    const { AUTH_PROVIDER_COOKIE_OPTIONS } = await import('@/lib/auth/authProviderCookie');

    clearAuthProviderCookie();

    expect(docStub.cookie).toContain(`path=${AUTH_PROVIDER_COOKIE_OPTIONS.path}`);
    expect(docStub.cookie).toContain('max-age=0');
  });

  it('throws when called outside a browser context (never during server rendering)', async () => {
    vi.stubGlobal('document', undefined);
    const { clearAuthProviderCookie } = await import('./activeClient');

    expect(() => clearAuthProviderCookie()).toThrow(/must only be called client-side/);
  });
});
