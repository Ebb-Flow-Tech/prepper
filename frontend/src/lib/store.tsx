'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { registerLogoutCallback } from '@/lib/auth-interceptor';
import { getQueryClient } from '@/lib/query-client-ref';
import { readActiveOrgId, writeActiveOrgId } from '@/lib/activeOrg';
import { getMe } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { getActiveSupabaseClient, setAuthProviderCookie } from '@/lib/supabase/activeClient';

// Module-level save handler — kept outside React to avoid re-render loops
let _canvasSaveHandler: (() => Promise<void>) | null = null;
export function setCanvasSaveHandler(handler: (() => Promise<void>) | null) {
  _canvasSaveHandler = handler;
}
export function getCanvasSaveHandler(): (() => Promise<void>) | null {
  return _canvasSaveHandler;
}

export type CanvasTab = 'canvas' | 'overview' | 'ingredients' | 'costs' | 'units' | 'instructions' | 'tasting' | 'versions';
export type IngredientTab = 'ingredients' | 'products' | 'categories' | 'allergens' | 'suppliers';
export type RecipeTab = 'management' | 'categories';
export type CanvasViewMode = 'grid' | 'list' | 'table';

/**
 * Auth state carries NO role and NO tokens.
 *
 * No role: Prepper has no `user_type`/`is_manager` any more — roles live in Passport and are
 * read PER BRAND (`usePassportBrands()` -> `my_role`). A cached global flag is exactly the bug
 * that removal fixed; do not add one back.
 *
 * No tokens: the session lives in whichever Supabase browser client the `prepper_auth_provider`
 * cookie names, and `api.ts` reads it from there. `userId` / `username` / `email` are Prepper's
 * own identity for the acting token and come from `GET /auth/me`.
 */
interface AppState {
  selectedRecipeId: number | null;
  instructionsTab: 'freeform' | 'steps';
  canvasTab: CanvasTab;
  ingredientTab: IngredientTab;
  recipeTab: RecipeTab;
  canvasHasUnsavedChanges: boolean;
  isDragDropEnabled: boolean;
  canvasViewMode: CanvasViewMode;
  userId: string | null;
  username: string | null;
  email: string | null;
  /**
   * The org the user is ACTING IN, sent as `X-Organization-Id` on every request.
   *
   * Client state, deliberately: the org LIST is server state and lives in `useOrganizations()`.
   * Only the selection is ours. It is a proposal, never an authority — the backend re-derives
   * membership from the Passport projection on every request and 403s a forged value.
   */
  activeOrgId: string | null;
  /**
   * True until the first `/auth/me` for the restored session settles.
   *
   * Resolving identity is now two network round trips, not a synchronous localStorage read, so
   * `!userId` on first paint no longer means "signed out". `AuthGuard` waits on this instead of
   * bouncing every deep link through /login before the session has had a chance to answer.
   */
  isAuthResolving: boolean;
}

interface AppContextValue extends AppState {
  selectRecipe: (id: number | null) => void;
  setInstructionsTab: (tab: 'freeform' | 'steps') => void;
  setCanvasTab: (tab: CanvasTab) => void;
  setIngredientTab: (tab: IngredientTab) => void;
  setRecipeTab: (tab: RecipeTab) => void;
  setCanvasHasUnsavedChanges: (hasChanges: boolean) => void;
  setIsDragDropEnabled: (enabled: boolean) => void;
  setCanvasViewMode: (mode: CanvasViewMode) => void;
  setUserId: (id: string | null) => void;
  setUsername: (username: string | null) => void;
  setEmail: (email: string | null) => void;
  setActiveOrgId: (orgId: string | null) => void;
  login: (userId: string, jwt: string, refreshToken: string, username: string, email: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize with null to match server render - avoids hydration mismatch
  const [state, setState] = useState<AppState>({
    selectedRecipeId: null,
    instructionsTab: 'freeform',
    canvasTab: 'canvas',
    ingredientTab: 'products',
    recipeTab: 'management',
    canvasHasUnsavedChanges: false,
    isDragDropEnabled: true,
    canvasViewMode: 'grid',
    userId: null,
    username: null,
    email: null,
    activeOrgId: null,
    isAuthResolving: true
  });
  /**
   * The subject whose identity is already resolved (or in flight). Guards against a second
   * `/auth/me` for the same user — `onAuthStateChange` also fires on every token refresh, and
   * StrictMode re-runs the subscription effect in development. Also the generation token that
   * stops a slow `/auth/me` publishing an identity the session no longer backs.
   */
  const resolvedSubjectRef = useRef<string | null>(null);

  /**
   * The acting org, mirrored outside React state so `setActiveOrgId` can answer "did this
   * actually change?" synchronously — it must decide before React has re-rendered. See the
   * ordering note on `setActiveOrgId`.
   */
  const activeOrgIdRef = useRef<string | null>(null);

  /**
   * Hydrate the acting org, and resolve identity from whichever Supabase client the provider
   * cookie names AT THIS MOMENT. `onAuthStateChange` emits INITIAL_SESSION on subscribe, so this
   * one subscription covers the restored session and every later sign-in — a separate
   * `getSession()` would only duplicate the `/auth/me` it triggers.
   *
   * KNOWN CONSTRAINT — this subscription is bound to ONE client for the life of the mount, and
   * nothing re-subscribes when `prepper_auth_provider` changes. A provider switch WITHOUT a full
   * page load is therefore invisible here, and the failure is severe and silent:
   *
   *   cookie flips to `passport` -> `setSession` lands on the Passport client -> this store is
   *   still listening to Prepper's own client -> no SIGNED_IN ever arrives -> `isAuthResolving` is
   *   already false -> `AuthGuard` sees `!userId` and redirects to /login, on a session that is
   *   genuinely live. It reads as "SSO is broken" and nothing logs.
   *
   * If you are chasing a bounce back to /login immediately after a successful Passport sign-in,
   * this is it. Two paths reach the switch, and both must cross it with a real navigation
   * (`window.location`), never `router.push` / `router.replace`:
   *
   *   1. `/auth/passport-callback` installing a Passport session. It arrives by browser redirect,
   *      so it must also LEAVE by one.
   *   2. Signing out of a Passport session and then signing in app-native. `performSignOut()`
   *      clears the cookie but does not remount this provider, so `TopNav.signOutAndReload()`
   *      exits via `window.location` — that is part of the contract, not cosmetic.
   *
   * The alternative — subscribing to both clients — was rejected: the Passport client cannot be
   * constructed at all when `NEXT_PUBLIC_PASSPORT_SUPABASE_URL` is unset, which is the supported
   * SSO-off configuration.
   */
  useEffect(() => {
    // One-time migration: the pre-Passport `prepper_auth` blob held a REFRESH TOKEN, and nothing
    // reads it any more. Getting tokens out of localStorage is the point of this change, so the
    // stale copy does not get to sit there forever.
    localStorage.removeItem('prepper_auth');

    const storedOrgId = readActiveOrgId();
    activeOrgIdRef.current = storedOrgId;
    setState((prev) => ({ ...prev, activeOrgId: storedOrgId }));

    let cancelled = false;

    const clearIdentity = () => {
      resolvedSubjectRef.current = null;
      if (!cancelled) {
        setState((prev) => ({ ...prev, userId: null, username: null, email: null, isAuthResolving: false }));
      }
    };

    const resolveIdentity = async (session: Session | null) => {
      if (!session) {
        clearIdentity();
        return;
      }
      const subject = session.user.id;
      if (subject === resolvedSubjectRef.current) return;
      resolvedSubjectRef.current = subject;

      try {
        const me = await getMe();
        // A SIGNED_OUT — or a sign-in as somebody else — can land while /auth/me is in flight.
        // Publishing now would resurrect an identity the current session no longer backs, leaving
        // the app showing a signed-in user against a session that is gone.
        if (cancelled || resolvedSubjectRef.current !== subject) return;
        setState((prev) => ({
          ...prev,
          userId: me.id,
          username: me.username,
          email: me.email,
          isAuthResolving: false
        }));
      } catch {
        // A session the backend will not identify is not a session this app can act on. Leave it
        // in place — api.ts's 401 rule decides whether it is revoked or merely unreachable.
        if (resolvedSubjectRef.current === subject) clearIdentity();
      }
    };

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      subscription = getActiveSupabaseClient().auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          // TOKEN_REFRESHED is a new token for the same person; /auth/me would answer the same.
          if (event === 'TOKEN_REFRESHED') return;
          void resolveIdentity(session);
        }
      ).data.subscription;
    } catch (error) {
      // A misconfigured Supabase project throws on client construction. Fail as signed-out rather
      // than leaving `isAuthResolving` true forever, which renders the whole app as null.
      console.error('Could not subscribe to auth state; treating the user as signed out:', error);
      clearIdentity();
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // Register logout callback for auth-interceptor (forced logout on a revoked session)
  useEffect(() => {
    registerLogoutCallback(() => {
      resolvedSubjectRef.current = null;
      activeOrgIdRef.current = null;
      writeActiveOrgId(null);
      setState((prev) => ({
        ...prev,
        userId: null,
        username: null,
        email: null,
        activeOrgId: null,
        isAuthResolving: false
      }));
      // Clear TanStack Query cache so next user doesn't see stale data
      getQueryClient()?.clear();
    });
  }, []);

  const selectRecipe = useCallback((id: number | null) => {
    setState((prev) => ({ ...prev, selectedRecipeId: id }));
  }, []);

  const setInstructionsTab = useCallback((tab: 'freeform' | 'steps') => {
    setState((prev) => ({ ...prev, instructionsTab: tab }));
  }, []);

  const setCanvasTab = useCallback((tab: CanvasTab) => {
    setState((prev) => ({ ...prev, canvasTab: tab }));
  }, []);

  const setIngredientTab = useCallback((tab: IngredientTab) => {
    setState((prev) => ({ ...prev, ingredientTab: tab }));
  }, []);

  const setRecipeTab = useCallback((tab: RecipeTab) => {
    setState((prev) => ({ ...prev, recipeTab: tab }));
  }, []);

  const setCanvasHasUnsavedChanges = useCallback((hasChanges: boolean) => {
    setState((prev) => prev.canvasHasUnsavedChanges === hasChanges ? prev : { ...prev, canvasHasUnsavedChanges: hasChanges });
  }, []);

  const setIsDragDropEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, isDragDropEnabled: enabled }));
  }, []);

  const setCanvasViewMode = useCallback((mode: CanvasViewMode) => {
    setState((prev) => ({ ...prev, canvasViewMode: mode }));
  }, []);

  const setUserId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, userId: id }));
  }, []);

  const setUsername = useCallback((username: string | null) => {
    setState((prev) => ({ ...prev, username }));
  }, []);

  const setEmail = useCallback((email: string | null) => {
    setState((prev) => ({ ...prev, email }));
  }, []);

  /**
   * Switch the acting org. The three steps are ordered, and the order is the whole correctness
   * argument:
   *
   * 1. Persist FIRST, synchronously. `api.ts` reads the org from localStorage at request time, so
   *    until the write lands every request still carries the OLD `X-Organization-Id`.
   * 2. Then clear the cache. EVERY cached key is org-dependent, so the whole cache is stale the
   *    instant the org changes. Per-key invalidation is not enough: anything less risks rendering
   *    org A's recipes under org B's name, which is the exact failure org scoping exists to
   *    prevent.
   * 3. Then re-render.
   *
   * Getting 1 and 2 the other way round is not a flicker, it is a persistent wrong-org render:
   * `clear()` notifies its observers on a MICROTASK, so the refetch wave it triggers would go out
   * before a passive effect could persist the new id. Query keys do not include the org, so those
   * old-org responses cache under the newly selected org and are never refetched.
   *
   * The side effects also stay OUT of the `setState` updater — a render-phase side effect is
   * double-invoked under StrictMode.
   */
  const setActiveOrgId = useCallback((activeOrgId: string | null) => {
    if (activeOrgIdRef.current === activeOrgId) return;
    activeOrgIdRef.current = activeOrgId;

    writeActiveOrgId(activeOrgId);
    getQueryClient()?.clear();
    setState((prev) => ({ ...prev, activeOrgId }));
  }, []);

  /**
   * Install an app-native session: tokens minted by Prepper's own project, handed back as JSON by
   * `POST /auth/login` or carried by the Google OAuth bridge.
   *
   * The store no longer keeps the tokens — it hands them to Prepper's browser client, which owns
   * the session and its refresh from here on, and marks the provider cookie so `api.ts` and the
   * sign-out path resolve that same client later.
   *
   * The three steps are ordered:
   *
   * 1. Cookie first. It is what every later `getActiveSupabaseClient()` reads to find the session
   *    again; written after, there is a window in which the session sits on a client nothing
   *    looks at.
   * 2. `setSession` next, AWAITED and CHECKED. It is not a local write — for a non-expired token
   *    it makes a `_getUser` round trip — and it does not throw on an auth error: `auth-js`'s
   *    `_setSession` catches `isAuthError` and RETURNS `{ data: { session: null }, error }`. A
   *    rejected token therefore resolves normally, so the error has to be read.
   * 3. Identity last.
   *
   * Publishing identity before step 2 has resolved AND succeeded is self-destructive, not merely
   * early: React commits the signed-in state, `AuthGuard` navigates, the protected tree mounts and
   * its queries hit `fetchApi` against a client that has no session. Every one 401s, the 401 rule
   * probes, finds no session, and signs the user out — a login that immediately un-logs-in. The
   * timing and the error arm are two doors into the same failure; both are closed here.
   *
   * Sign-out is deliberately NOT the mirror of this: it goes through `performSignOut()`, which
   * must also tear down the Supabase session and the cookie. A bare local-state clear here would
   * leave both live for the next page load to re-hydrate from.
   *
   * Callers must AWAIT this before navigating.
   */
  const login = useCallback(async (userId: string, jwt: string, refreshToken: string, username: string, email: string) => {
    // Clear any data cached from previous user session before setting new auth
    getQueryClient()?.clear();
    resolvedSubjectRef.current = null;
    setAuthProviderCookie('app-native');

    const { error } = await createClient().auth.setSession({
      access_token: jwt,
      refresh_token: refreshToken,
    });
    if (error) {
      // Surface it to the caller's own error handling rather than showing a signed-in UI backed by
      // nothing. The cookie is left reading `app-native`, which is exactly what an absent cookie
      // already means, so there is nothing to undo.
      throw error;
    }

    setState((prev) => ({ ...prev, userId, username, email, isAuthResolving: false }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        selectRecipe,
        setInstructionsTab,
        setCanvasTab,
        setIngredientTab,
        setRecipeTab,
        setCanvasHasUnsavedChanges,
        setIsDragDropEnabled,
        setCanvasViewMode,
        setUserId,
        setUsername,
        setEmail,
        setActiveOrgId,
        login
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}
