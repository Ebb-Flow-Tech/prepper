'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { registerLogoutCallback } from '@/lib/auth-interceptor';
import { getQueryClient } from '@/lib/query-client-ref';

const AUTH_STORAGE_KEY = 'prepper_auth';

// Module-level save handler — kept outside React to avoid re-render loops
let _canvasSaveHandler: (() => Promise<void>) | null = null;
export function setCanvasSaveHandler(handler: (() => Promise<void>) | null) {
  _canvasSaveHandler = handler;
}
export function getCanvasSaveHandler(): (() => Promise<void>) | null {
  return _canvasSaveHandler;
}

/**
 * Auth state carries NO role. Prepper has no `user_type`/`is_manager` any more: roles live in
 * Passport and are read PER BRAND (`usePassportBrands()` -> `my_role`). A cached global flag is
 * exactly the bug that removal fixed — do not add one back.
 */
interface StoredAuth {
  userId: string | null;
  jwt: string | null;
  refreshToken: string | null;
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
}

function getStoredAuth(): StoredAuth {
  if (typeof window === 'undefined') {
    return { userId: null, jwt: null, refreshToken: null, username: null, email: null, activeOrgId: null };
  }
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { userId: null, jwt: null, refreshToken: null, username: null, email: null, activeOrgId: null };
}

function setStoredAuth(auth: StoredAuth) {
  if (typeof window === 'undefined') return;
  if (auth.userId && auth.jwt && auth.username) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export type CanvasTab = 'canvas' | 'overview' | 'ingredients' | 'costs' | 'units' | 'instructions' | 'tasting' | 'versions';
export type IngredientTab = 'ingredients' | 'products' | 'categories' | 'allergens' | 'suppliers';
export type RecipeTab = 'management' | 'categories';
export type CanvasViewMode = 'grid' | 'list' | 'table';

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
  jwt: string | null;
  refreshToken: string | null;
  username: string | null;
  email: string | null;
  activeOrgId: string | null;
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
  setJwt: (jwt: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setUsername: (username: string | null) => void;
  setEmail: (email: string | null) => void;
  setActiveOrgId: (orgId: string | null) => void;
  login: (userId: string, jwt: string, refreshToken: string, username: string, email: string) => void;
  logout: () => void;
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
    jwt: null,
    refreshToken: null,
    username: null,
    email: null,
    activeOrgId: null
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate auth state from localStorage after mount (client-only)
  useEffect(() => {
    const storedAuth = getStoredAuth();
    setState((prev) => ({
      ...prev,
      userId: storedAuth.userId,
      jwt: storedAuth.jwt,
      refreshToken: storedAuth.refreshToken,
      username: storedAuth.username,
      email: storedAuth.email,
      activeOrgId: storedAuth.activeOrgId
    }));
    setIsHydrated(true);
  }, []);

  // Register logout callback for auth-interceptor (forced logout on expired token)
  useEffect(() => {
    registerLogoutCallback(() => {
      setState((prev) => ({
        ...prev,
        userId: null,
        jwt: null,
        refreshToken: null,
        username: null,
        email: null
      }));
      // Clear TanStack Query cache so next user doesn't see stale data
      getQueryClient()?.clear();
    });
  }, []);

  // Sync auth state to localStorage whenever it changes
  useEffect(() => {
    if (!isHydrated) return;
    setStoredAuth({
      userId: state.userId,
      jwt: state.jwt,
      refreshToken: state.refreshToken,
      username: state.username,
      email: state.email,
      activeOrgId: state.activeOrgId
    });
  }, [state.userId, state.jwt, state.refreshToken, state.username, state.email, state.activeOrgId, isHydrated]);

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

  const setJwt = useCallback((jwt: string | null) => {
    setState((prev) => ({ ...prev, jwt }));
  }, []);

  const setRefreshToken = useCallback((token: string | null) => {
    setState((prev) => ({ ...prev, refreshToken: token }));
  }, []);

  const setUsername = useCallback((username: string | null) => {
    setState((prev) => ({ ...prev, username }));
  }, []);

  const setEmail = useCallback((email: string | null) => {
    setState((prev) => ({ ...prev, email }));
  }, []);

  const setActiveOrgId = useCallback((activeOrgId: string | null) => {
    setState((prev) => {
      if (prev.activeOrgId === activeOrgId) return prev;
      // EVERY cached key is org-dependent, so the whole cache is stale the instant the org
      // changes. Per-key invalidation is not enough: anything less risks rendering org A's
      // recipes under org B's name, which is the exact failure org scoping exists to prevent.
      getQueryClient()?.clear();
      return { ...prev, activeOrgId };
    });
  }, []);

  const login = useCallback((userId: string, jwt: string, refreshToken: string, username: string, email: string) => {
    // Clear any data cached from previous user session before setting new auth
    getQueryClient()?.clear();
    setState((prev) => ({ ...prev, userId, jwt, refreshToken, username, email }));
  }, []);

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, userId: null, jwt: null, refreshToken: null, username: null, email: null, activeOrgId: null }));
    // Clear TanStack Query cache so the next user doesn't see stale data
    getQueryClient()?.clear();
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
        setJwt,
        setRefreshToken,
        setUsername,
        setEmail,
        setActiveOrgId,
        login,
        logout
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
