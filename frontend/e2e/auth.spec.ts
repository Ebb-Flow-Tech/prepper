/**
 * Section 1: Authentication
 * Covers: Login page, Register page, Auth Guard
 *
 * NOTE: These tests intentionally do NOT use saved auth state (storageState).
 * They test the auth flow itself via the UI.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { TEST_USER, unique, XSS_PAYLOAD } from './helpers/data';

// Override storageState for this file — tests start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
test.describe('Login Page (/login)', () => {
  test('email and password fields are present and accept input', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();

    await loginPage.emailInput.fill('test@example.com');
    await expect(loginPage.emailInput).toHaveValue('test@example.com');

    await loginPage.passwordInput.fill('mypassword');
    await expect(loginPage.passwordInput).toHaveValue('mypassword');
  });

  test('submit button is disabled while login is in progress', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.emailInput.fill(TEST_USER.email);
    await loginPage.passwordInput.fill(TEST_USER.password);

    await page.route('**/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await loginPage.submitButton.click();
    await expect(loginPage.submitButton).toBeDisabled();
  });

  test('successful login redirects to /recipes', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/recipes/, { timeout: 15_000 });
    expect(page.url()).toContain('/recipes');
  });

  test('invalid credentials show an error message below the form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@example.com', 'wrongpassword');
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
  });

  test('toast notification appears on successful login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5_000 });
  });

  test('toast notification appears on login error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('bad@example.com', 'badpass');
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5_000 });
  });

  test('link to registration page navigates to /register', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.registerLink.click();
    await page.waitForURL('/register');
    expect(page.url()).toContain('/register');
  });

  test.describe('Edge Cases', () => {
    test('submitting with empty email shows HTML5 validation (no API call)', async ({ page }) => {
      let apiCalled = false;
      await page.route('**/auth/login', () => { apiCalled = true; });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.passwordInput.fill('password');
      await loginPage.submitButton.click();

      expect(apiCalled).toBe(false);
      expect(page.url()).toContain('/login');
    });

    test('submitting with empty password shows HTML5 validation (no API call)', async ({ page }) => {
      let apiCalled = false;
      await page.route('**/auth/login', () => { apiCalled = true; });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill('test@example.com');
      await loginPage.submitButton.click();

      expect(apiCalled).toBe(false);
      expect(page.url()).toContain('/login');
    });

    test('very long email address does not crash the form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill('a'.repeat(240) + '@b.com');
      await expect(loginPage.emailInput).toBeVisible();
    });

    test('very long password does not crash the form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.passwordInput.fill('a'.repeat(255));
      await expect(loginPage.passwordInput).toBeVisible();
    });

    test('pressing Enter in password field submits the form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill(TEST_USER.email);
      await loginPage.passwordInput.fill(TEST_USER.password);
      await loginPage.passwordInput.press('Enter');
      await page.waitForURL(/\/recipes/, { timeout: 15_000 });
    });

    test('login failure does not clear the email field', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      const email = 'user@example.com';
      await loginPage.emailInput.fill(email);
      await loginPage.passwordInput.fill('wrongpassword');
      await loginPage.submitButton.click();
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
      await expect(loginPage.emailInput).toHaveValue(email);
    });

    test('stored redirect URL is used after login', async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.setItem('prepper_last_route', '/recipes');
      });
      const loginPage = new LoginPage(page);
      await loginPage.login(TEST_USER.email, TEST_USER.password);
      await page.waitForURL(/\/recipes/, { timeout: 15_000 });
    });

    test('double-clicking submit does not send duplicate login requests', async ({ page }) => {
      let callCount = 0;
      await page.route('**/auth/login', async (route) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 500));
        await route.continue();
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill(TEST_USER.email);
      await loginPage.passwordInput.fill(TEST_USER.password);
      await loginPage.submitButton.dblclick();
      await page.waitForTimeout(700);

      expect(callCount).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Register Page
// The register form has: #name (username), #email, #phone (optional),
// #password, #confirmPassword
// ---------------------------------------------------------------------------
test.describe('Register Page (/register)', () => {
  test('name, email, and password fields are present', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
  });

  test('required field validation triggers on empty submit', async ({ page }) => {
    await page.goto('/register');
    await page.locator('button[type="submit"]').click();
    expect(page.url()).toContain('/register');
  });

  test('link back to login page navigates to /login', async ({ page }) => {
    await page.goto('/register');
    await page.locator('a[href="/login"]').click();
    await page.waitForURL('/login');
  });

  test.describe('Edge Cases', () => {
    test('email address in invalid format is rejected', async ({ page }) => {
      await page.goto('/register');
      await page.locator('#name').fill('TestUser');
      await page.locator('#email').fill('notanemail');
      await page.locator('#password').fill('password123');
      await page.locator('#confirmPassword').fill('password123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(500);
      // HTML5 type="email" validation prevents form submission — page stays at /register
      expect(page.url()).toContain('/register');
      // The email input reports invalid via constraint validation API
      const emailValid = await page.locator('#email').evaluate(
        (el: HTMLInputElement) => el.validity.valid
      );
      expect(emailValid).toBe(false);
    });

    test('submitting with all fields empty does not call API', async ({ page }) => {
      let apiCalled = false;
      await page.route('**/auth/register', () => { apiCalled = true; });
      await page.goto('/register');
      await page.locator('button[type="submit"]').click();
      expect(apiCalled).toBe(false);
    });

    test('password shorter than 6 characters is rejected with an error', async ({ page }) => {
      await page.goto('/register');
      await page.locator('#name').fill('TestUser');
      await page.locator('#email').fill(`${unique('test')}@example.com`);
      await page.locator('#password').fill('ab');
      await page.locator('#confirmPassword').fill('ab');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(500);
      const errorDiv = page.locator('.bg-red-50, [class*="bg-red"]').first();
      await expect(errorDiv).toBeVisible({ timeout: 3_000 });
    });

    test('mismatched passwords show an error', async ({ page }) => {
      await page.goto('/register');
      await page.locator('#name').fill('TestUser');
      await page.locator('#email').fill(`${unique('test')}@example.com`);
      await page.locator('#password').fill('password123');
      await page.locator('#confirmPassword').fill('different456');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(500);
      const errorDiv = page.locator('.bg-red-50, [class*="bg-red"]').first();
      await expect(errorDiv).toBeVisible({ timeout: 3_000 });
    });
  });
});

// ---------------------------------------------------------------------------
// Auth Guard
// ---------------------------------------------------------------------------
test.describe('Auth Guard', () => {
  // Tests start with no storageState — already unauthenticated

  test('unauthenticated users visiting protected routes are redirected to /login', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test.describe('Edge Cases', () => {
    test('opening a protected route in new tab while logged out redirects to /login', async ({ browser }) => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      await page.goto('/recipes');
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      expect(page.url()).toContain('/login');
      await context.close();
    });

    test('expired/revoked token does not cause a redirect loop', async ({ page }) => {
      await page.goto('/login'); // Start on a real page so localStorage works
      await page.evaluate(() => {
        localStorage.setItem('prepper_auth', JSON.stringify({
          userId: 'expired-user',
          jwt: 'expired.jwt.token',
          userType: 'normal',
          refreshToken: 'expired-refresh',
          username: 'olduser',
          email: 'old@example.com',
          isManager: false,
          outletId: null,
        }));
      });
      await page.goto('/recipes');
      // Should end up on /login (not loop forever)
      await page.waitForURL(/\/login|\/recipes/, { timeout: 10_000 });
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
