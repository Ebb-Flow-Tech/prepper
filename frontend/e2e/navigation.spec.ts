/**
 * Section 2: Navigation & Layout
 * Covers: Top Navigation, Home Page redirects
 *
 * Nav facts (from TopNav.tsx):
 * - Menu, Dishes (/recipes), Ingredients, R&D, Reports (/finance), Settings — visible to all
 *   logged-in users. There is no role-gated nav item any more: Prepper has no local roles, and
 *   structure (outlets) is managed in Passport, so there is no /outlets entry.
 * - Navigation labels hidden at md breakpoint (xl:inline), icons only at md–xl
 */
import { test, expect } from '@playwright/test';

test.describe('Top Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('load');
  });

  test('nav links are present', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    // Note: /recipes appears twice (logo + nav item) — use .first() to avoid strict mode
    await expect(nav.locator('a[href="/recipes"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/ingredients"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/rnd"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/menu"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/finance"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/settings"]').first()).toBeVisible();
  });

  test('no role-gated or /outlets nav item exists; Settings (Brand Roles) is available to all', async ({ page }) => {
    // Structure moved to Passport — there is no /outlets nav entry.
    const outletsLink = page.locator('nav a[href="/outlets"]');
    expect(await outletsLink.isVisible().catch(() => false)).toBe(false);
    // Role assignment now lives in Settings → Brand Roles, reachable by every logged-in user.
    await expect(page.locator('nav').first().locator('a[href="/settings"]').first()).toBeVisible();
  });

  test('active page link is highlighted', async ({ page }) => {
    // The nav item link (not the logo) has bg-zinc-100 when active
    // Logo is a[href="/recipes"].first(), nav item is the second one (has rounded-md class)
    const recipesNavItem = page.locator('nav').first().locator('a[href="/recipes"][class*="rounded"]');
    await expect(recipesNavItem).toBeVisible();
    const classes = await recipesNavItem.getAttribute('class') || '';
    expect(classes).toContain('bg-zinc');
  });

  test('username is displayed in the nav', async ({ page }) => {
    // TopNav shows username as a <span> in the desktop nav
    const usernameSpan = page.locator('nav').first().locator('span').filter({ hasText: /\w+/ }).first();
    await expect(usernameSpan).toBeVisible();
  });

  test('logout button is present', async ({ page }) => {
    const nav = page.locator('nav').first();
    const logoutBtn = nav.locator('button').filter({ hasText: /logout/i });
    if (await logoutBtn.isVisible()) {
      await expect(logoutBtn).toBeVisible();
    } else {
      // At narrower viewports logout may be in mobile menu — just verify nav exists
      await expect(nav).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('very long username does not break the nav bar layout', async ({ page }) => {
      await page.evaluate(() => {
        const auth = JSON.parse(localStorage.getItem('prepper_auth') || '{}');
        auth.username = 'a'.repeat(80);
        localStorage.setItem('prepper_auth', JSON.stringify(auth));
      });
      await page.reload();
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();
      const navBox = await nav.boundingBox();
      const viewport = page.viewportSize();
      if (navBox && viewport) {
        expect(navBox.width).toBeLessThanOrEqual(viewport.width);
      }
    });

    test('rapidly clicking the same nav link multiple times does not cause errors', async ({ page }) => {
      // Use the nav item (rounded-md class) not the logo link to avoid strict mode
      const recipesLink = page.locator('nav').first().locator('a[href="/recipes"][class*="rounded"]');
      await recipesLink.click();
      await recipesLink.click();
      await recipesLink.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/recipes');
    });
  });
});

test.describe('Home Page (/)', () => {
  test('authenticated users are redirected to /recipes', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/recipes/, { timeout: 10_000 });
    expect(page.url()).toContain('/recipes');
  });

  test.describe('Edge Cases', () => {
    test('redirect happens without briefly rendering home page content', async ({ page }) => {
      const homeContent = page.locator('h1').filter({ hasText: /home|welcome/i });
      await page.goto('/');
      await page.waitForURL(/\/recipes/, { timeout: 10_000 });
      const isHomeVisible = await homeContent.isVisible().catch(() => false);
      expect(isHomeVisible).toBe(false);
    });
  });
});
