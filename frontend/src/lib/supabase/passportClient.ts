import { createBrowserClient } from '@supabase/ssr';

/**
 * A second Supabase browser client, for Passport's project. Deliberately NOT a
 * copy of `lib/supabase/client.ts`'s `createClient()`: `@supabase/ssr`'s
 * `createBrowserClient` defaults to a single, unkeyed, module-level cache in the
 * browser (no `isSingleton` option = shared slot). Prepper's own `createClient()`
 * is called on nearly every session-touching path and wins that slot first — so a
 * second call here with a different URL/key and no `isSingleton` option would
 * silently return the ALREADY-CACHED Prepper-project client, and every Passport
 * session would validate against the wrong project.
 *
 * `isSingleton: false` opts out of that shared slot entirely (verified against
 * `@supabase/ssr`'s source: passing `isSingleton: false`, or any non-true value,
 * skips both reading and writing the shared cache; `isSingleton: true` explicitly
 * opts back into it, so it is NOT a safe alternative here).
 *
 * Wrapped in this file's own memo so repeat calls within one tab still return the
 * same instance, rather than constructing a fresh GoTrue client — and its own
 * auto-refresh timer — on every call.
 *
 * Guarded on `typeof window`, in the same spirit as the SDK's own `isBrowser()`
 * guard: this file must only ever be reached from client-side event handlers and
 * effects. A construction reached from a server-rendering pass could cache a
 * broken instance (the SDK's storage construction throws with no window and no
 * explicit `cookies` option) and then serve it to unrelated later requests, since
 * Next.js module state is shared across requests within a server worker.
 */
let cachedPassportClient: ReturnType<typeof createBrowserClient> | undefined;

export function createPassportClient() {
  if (typeof window === 'undefined') {
    throw new Error(
      'createPassportClient() must only be called client-side (event handlers/effects), never during server rendering — createBrowserClient\'s storage construction throws without a window. See lib/supabase/passportClient.ts.'
    );
  }

  if (cachedPassportClient) return cachedPassportClient;

  cachedPassportClient = createBrowserClient(
    process.env.NEXT_PUBLIC_PASSPORT_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_PASSPORT_SUPABASE_ANON_KEY!,
    { isSingleton: false }
  );
  return cachedPassportClient;
}
