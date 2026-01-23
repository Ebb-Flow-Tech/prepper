'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const AUTH_STORAGE_KEY = 'prepper_auth';

interface StoredAuth {
  userId: string | null;
  jwt: string | null;
  userType: 'normal' | 'admin' | null;
}

function getStoredAuth(): StoredAuth {
  if (typeof window === 'undefined') {
    return { userId: null, jwt: null, userType: null };
  }
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { userId: null, jwt: null, userType: null };
}

function setStoredAuth(auth: StoredAuth) {
  if (typeof window === 'undefined') return;
  if (auth.userId && auth.jwt && auth.userType) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export type CanvasTab = 'canvas' | 'overview' | 'ingredients' | 'costs' | 'outlets' | 'instructions' | 'tasting' | 'versions';
export type IngredientTab = 'ingredients' | 'categories';
export type RecipeTab = 'management' | 'outlets' | 'categories';
export type CanvasViewMode = 'grid' | 'list';

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
  userType: 'normal' | 'admin' | null;
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
  setUserType: (userType: 'normal' | 'admin' | null) => void;
  login: (userId: string, jwt: string, userType: 'normal' | 'admin') => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize with null to match server render - avoids hydration mismatch
  const [state, setState] = useState<AppState>({
    selectedRecipeId: null,
    instructionsTab: 'freeform',
    canvasTab: 'canvas',
    ingredientTab: 'ingredients',
    recipeTab: 'management',
    canvasHasUnsavedChanges: false,
    isDragDropEnabled: true,
    canvasViewMode: 'grid',
    userId: null,
    jwt: null,
    userType: null
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate auth state from localStorage after mount (client-only)
  useEffect(() => {
    const storedAuth = getStoredAuth();
    setState((prev) => ({
      ...prev,
      userId: storedAuth.userId,
      jwt: storedAuth.jwt,
      userType: storedAuth.userType
    }));
    setIsHydrated(true);
  }, []);

  // Sync auth state to localStorage whenever it changes
  useEffect(() => {
    if (!isHydrated) return;
    setStoredAuth({
      userId: state.userId,
      jwt: state.jwt,
      userType: state.userType
    });
  }, [state.userId, state.jwt, state.userType, isHydrated]);

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
    setState((prev) => ({ ...prev, canvasHasUnsavedChanges: hasChanges }));
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

  const setUserType = useCallback((userType: 'normal' | 'admin' | null) => {
    setState((prev) => ({ ...prev, userType }));
  }, []);

  const login = useCallback((userId: string, jwt: string, userType: 'normal' | 'admin') => {
    setState((prev) => ({ ...prev, userId, jwt, userType }));
  }, []);

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, userId: null, jwt: null, userType: null }));
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
        setUserType,
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
