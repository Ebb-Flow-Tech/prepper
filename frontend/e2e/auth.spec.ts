/**
 * Section 1: Authentication
 * Covers: the two-step login page and the Auth Guard.
 *
 * NOTE: These tests intentionally do NOT use saved auth state (storageState).
 * They test the auth flow itself via the UI.
 *
 * The suite runs with SSO OFF (see `global.setup.ts`), so `/auth/resolve-login` answers
 * `app-native` for every address and step 2 always renders. Self-signup is gone with `/register`.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { corruptStoredSession, loginViaUi } from './helpers/auth';
import { TEST_USER } from './helpers/data';

// Override storageState for this file — tests start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

// ---------------------------------------------------------------------------
// Login Page — step 1 (email)
// ---------------------------------------------------------------------------
test.describe('Login Page (/login)', () => {
  test('step 1 asks for an email only — no password field until Continue', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toHaveCount(0);

    await loginPage.emailInput.fill('test@example.com');
    await expect(loginPage.emailInput).toHaveValue('test@example.com');

    await loginPage.continueWithEmail('test@example.com');
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.emailInput).toHaveValue('test@example.com');
  });

  test('step 1 offers no SSO toggle, but does offer Google', async ({ page }) => {
    // The email-first router still decides Passport-vs-app-native from the address alone — no SSO
    // button, no toggle for that choice. Google is a front-door choice again (D7 reversed).
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.googleButton).toBeVisible();
    await expect(page.locator('button', { hasText: /sso|single sign|company account|passport/i }))
      .toHaveCount(0);
  });

  test('step 2 echoes the email read-only and offers Google', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.continueWithEmail('test@example.com');

    await expect(loginPage.emailInput).toHaveAttribute('readonly', '');
    await expect(loginPage.googleButton).toBeVisible();
  });

  test('"Use a different email" returns to step 1', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.continueWithEmail('test@example.com');

    await loginPage.useDifferentEmailButton.click();

    await expect(loginPage.passwordInput).toHaveCount(0);
    await expect(loginPage.emailInput).toBeEditable();
  });

  test('every SSO failure code renders the SAME message', async ({ page }) => {
    // All three codes share one message on purpose: a per-code message would report whether an
    // address has a Passport membership and whether it still has access — the enumeration channel
    // the two-valued router exists to close. Asserting only "a red box appeared" would let a
    // future per-code message pass while reopening it, so compare the actual text.
    const loginPage = new LoginPage(page);
    const messages: string[] = [];

    for (const code of ['passport_unavailable', 'passport_sso_failed', 'passport_no_access']) {
      await page.goto(`/login?error=${code}`);
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
      messages.push(((await loginPage.errorMessage.textContent()) ?? '').trim());
    }

    expect(messages[0]).not.toBe('');
    expect(messages[1]).toBe(messages[0]);
    expect(messages[2]).toBe(messages[0]);
  });

  test('submit button is disabled while login is in progress', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.continueWithEmail(TEST_USER.email);
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
    await page.waitForURL(/\/recipes/, { timeout: 30_000 });
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

  test.describe('Edge Cases', () => {
    test('submitting with an empty email calls nothing (HTML5 validation)', async ({ page }) => {
      let apiCalled = false;
      await page.route('**/auth/resolve-login', () => { apiCalled = true; });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.submitEmpty();

      expect(apiCalled).toBe(false);
      expect(page.url()).toContain('/login');
    });

    test('submitting with empty password shows HTML5 validation (no API call)', async ({ page }) => {
      let apiCalled = false;
      await page.route('**/auth/login', () => { apiCalled = true; });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.continueWithEmail('test@example.com');
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
      await loginPage.continueWithEmail('test@example.com');
      await loginPage.passwordInput.fill('a'.repeat(255));
      await expect(loginPage.passwordInput).toBeVisible();
    });

    test('pressing Enter in password field submits the form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.continueWithEmail(TEST_USER.email);
      await loginPage.passwordInput.fill(TEST_USER.password);
      await loginPage.passwordInput.press('Enter');
      await page.waitForURL(/\/recipes/, { timeout: 15_000 });
    });

    test('login failure does not clear the email field', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      const email = 'user@example.com';
      await loginPage.login(email, 'wrongpassword');
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
      await loginPage.continueWithEmail(TEST_USER.email);
      await loginPage.passwordInput.fill(TEST_USER.password);
      await loginPage.submitButton.dblclick();
      await page.waitForTimeout(700);

      // `toBeLessThanOrEqual(1)` also passes at ZERO — i.e. if the click never reached the form
      // at all. Exactly one request is the property being asserted.
      expect(callCount).toBe(1);
    });

    test('double-clicking Continue does not send duplicate routing requests', async ({ page }) => {
      let callCount = 0;
      await page.route('**/auth/resolve-login', async (route) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 500));
        await route.continue();
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill(TEST_USER.email);
      await loginPage.submitButton.dblclick();
      await page.waitForTimeout(700);

      // `toBeLessThanOrEqual(1)` also passes at ZERO — i.e. if the click never reached the form
      // at all. Exactly one request is the property being asserted.
      expect(callCount).toBe(1);
    });

    test('email with leading/trailing whitespace is trimmed before submission', async ({ page }) => {
      let submittedEmail = '';
      await page.route('**/auth/login', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        submittedEmail = body.email ?? body.username ?? '';
        await route.fulfill({ status: 401, body: JSON.stringify({ detail: 'Invalid credentials' }) });
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(`  ${TEST_USER.email}  `, 'anypassword');
      await page.waitForTimeout(500);

      // The submitted email should be trimmed (no leading/trailing spaces)
      if (submittedEmail) {
        expect(submittedEmail).toBe(submittedEmail.trim());
      }
    });

    test('browser back button after successful login does not return to login page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(TEST_USER.email, TEST_USER.password);
      await page.waitForURL(/\/recipes/, { timeout: 15_000 });

      await page.goBack();
      await page.waitForTimeout(1000);
      // Should redirect back to /recipes, not stay on /login
      expect(page.url()).not.toContain('/login');
    });

    test('malformed stored redirect URL falls back to /recipes safely', async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.setItem('prepper_last_route', 'javascript:alert(1)');
      });
      const loginPage = new LoginPage(page);
      await loginPage.login(TEST_USER.email, TEST_USER.password);
      await page.waitForURL(/\/recipes/, { timeout: 15_000 });
      // Should land on /recipes (safe fallback), not execute the malicious URL
      expect(page.url()).toContain('/recipes');
    });
  });
});

// ---------------------------------------------------------------------------
// Self-signup is deleted (spec D8): /register no longer exists in the frontend or the backend.
// ---------------------------------------------------------------------------
test.describe('Self-signup', () => {
  test('/register is gone — it is not a route of this app any more', async ({ page }) => {
    const response = await page.goto('/register');
    await page.waitForLoadState('load');

    // The status is the load-bearing assertion: `#confirmPassword` being absent, or the body
    // being attached, is true of every page in the app and would pass with the route still live.
    expect(response?.status()).toBe(404);
    await expect(page.locator('form')).toHaveCount(0);
  });

  test('the login page does not link to a signup page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('a[href="/register"]')).toHaveCount(0);
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

    test('a corrupted session does not cause a redirect loop', async ({ page }) => {
      // A token cannot be injected any more — the session lives in the Supabase client's own
      // cookies — so this signs in for real and then corrupts what it stored.
      await loginViaUi(page, TEST_USER.email, TEST_USER.password);
      await page.waitForURL(/\/recipes/, { timeout: 30_000 });

      await corruptStoredSession(page);

      await page.goto('/recipes');
      // Should settle on one of the two, not loop forever
      await page.waitForURL(/\/login|\/recipes/, { timeout: 10_000 });
      await expect(page.locator('body')).toBeVisible();
    });

    test('authenticated users visiting /login are redirected away', async ({ page }) => {
      await loginViaUi(page, TEST_USER.email, TEST_USER.password);
      await page.waitForURL(/\/recipes/, { timeout: 30_000 });

      await page.goto('/login');
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
      expect(page.url()).not.toContain('/login');
    });
  });
});
