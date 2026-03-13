import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const USER_AUTH_FILE = 'e2e/.auth/user.json';
const ADMIN_AUTH_FILE = 'e2e/.auth/admin.json';

// Inject auth state directly into localStorage to avoid depending on login UI
// Each test user must exist in the backend before running tests.
// Set credentials via env vars:
//   TEST_USER_EMAIL / TEST_USER_PASSWORD
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
//   TEST_API_URL (default: http://localhost:8000/api/v1)

async function loginViaApi(
  email: string,
  password: string,
  apiUrl: string
): Promise<{
  userId: string;
  jwt: string;
  userType: 'normal' | 'admin';
  refreshToken: string;
  username: string;
  email: string;
  isManager: boolean;
  outletId: number | null;
}> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      `Login failed for ${email}: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  return {
    userId: data.user.id,
    jwt: data.access_token,
    userType: data.user.user_type,
    refreshToken: data.refresh_token,
    username: data.user.username,
    email: data.user.email,
    isManager: data.user.is_manager ?? false,
    outletId: data.user.outlet_id ?? null,
  };
}

setup('authenticate as normal user', async ({ page }) => {
  const apiUrl = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';
  const email = process.env.TEST_USER_EMAIL || 'testuser@prepper.test';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

  const auth = await loginViaApi(email, password, apiUrl);

  await page.goto('/');
  await page.evaluate((authData) => {
    localStorage.setItem('prepper_auth', JSON.stringify(authData));
  }, auth);

  // Verify auth works by navigating to a protected page
  await page.goto('/recipes');
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: USER_AUTH_FILE });
});

setup('authenticate as admin user', async ({ page }) => {
  const apiUrl = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';
  const email = process.env.TEST_ADMIN_EMAIL || 'admin@prepper.test';
  const password = process.env.TEST_ADMIN_PASSWORD || 'adminpassword123';

  const auth = await loginViaApi(email, password, apiUrl);

  await page.goto('/');
  await page.evaluate((authData) => {
    localStorage.setItem('prepper_auth', JSON.stringify(authData));
  }, auth);

  await page.goto('/recipes');
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
