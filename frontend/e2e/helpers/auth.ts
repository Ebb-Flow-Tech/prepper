import type { Page } from '@playwright/test';

const AUTH_KEY = 'prepper_auth';

export interface AuthState {
  userId: string;
  jwt: string;
  userType: 'normal' | 'admin';
  refreshToken: string;
  username: string;
  email: string;
  isManager: boolean;
  outletId: number | null;
}

/** Inject auth state directly into localStorage without going through login UI */
export async function setAuth(page: Page, auth: AuthState): Promise<void> {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: AUTH_KEY, value: auth }
  );
}

/** Clear auth state from localStorage */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate((key) => localStorage.removeItem(key), AUTH_KEY);
}

/** Read current auth state from localStorage */
export async function getAuth(page: Page): Promise<AuthState | null> {
  return page.evaluate((key) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }, AUTH_KEY);
}

/** Login via the UI form — use only in auth-specific tests */
export async function loginViaUi(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}
