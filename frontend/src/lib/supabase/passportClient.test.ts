import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ marker: Symbol('client-instance') })),
}));

describe('createPassportClient', () => {
  // vitest.config.ts has no dotenv/loadEnv wiring, so `process.env` inside a vitest
  // run reflects only real OS/shell env vars, never `frontend/.env`. The two
  // NEXT_PUBLIC_PASSPORT_* vars must be stubbed explicitly, or this test fails on
  // every machine and in CI permanently — not just until Passport ops provisions
  // the real anon key.
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_PASSPORT_SUPABASE_URL', 'https://passport.example.test');
    vi.stubEnv('NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules(); // fresh module state per test — cachedPassportClient must not leak between tests
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("passes isSingleton: false so it never collides with the SDK's shared cache slot", async () => {
    const { createBrowserClient } = await import('@supabase/ssr');
    const { createPassportClient } = await import('./passportClient');

    createPassportClient();

    // The URL and key are asserted by VALUE, not `expect.any(String)`. Constructing this client
    // against Prepper's own project is the precise failure the file exists to prevent, and a
    // loose matcher would wave it through.
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://passport.example.test',
      'test-anon-key',
      expect.objectContaining({ isSingleton: false })
    );
  });

  it('memoizes its own instance across repeat calls', async () => {
    const { createPassportClient } = await import('./passportClient');

    const first = createPassportClient();
    const second = createPassportClient();

    expect(first).toBe(second);
  });

  it('throws when called outside a browser context (never during server rendering)', async () => {
    // jsdom supplies a real `window`; stub it away to reach the guard.
    vi.stubGlobal('window', undefined);
    const { createPassportClient } = await import('./passportClient');

    expect(() => createPassportClient()).toThrow(/must only be called client-side/);
  });
});
