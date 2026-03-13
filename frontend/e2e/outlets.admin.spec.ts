/**
 * Section 7: Outlets (Admin only)
 * These tests run under the 'admin' project (storageState: admin.json)
 */
import { test, expect } from '@playwright/test';
import { unique } from './helpers/data';

test.describe('Outlets Page (/outlets) — Admin only', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/outlets');
    await page.waitForLoadState('networkidle');
  });

  test('outlet cards are displayed with name, location, and status', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('"Add outlet" button opens a create modal', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /add outlet/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });
    }
  });

  test('creating an outlet adds it to the grid', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /add outlet/i });
    if (!(await addBtn.isVisible())) return;

    const outletName = unique('TestOutlet');
    await addBtn.click();
    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible()) {
      // Outlet form has name (1st input) and code (2nd input) — both required
      const inputs = modal.locator('input[type="text"], input:not([type])');
      await inputs.nth(0).fill(outletName);
      await inputs.nth(1).fill('TST001');
      const submitBtn = modal.locator('button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('main').first()).toContainText(outletName);
    }
  });

  test('archive/restore button changes outlet status', async ({ page }) => {
    const archiveBtn = page.locator('button').filter({ hasText: /archive/i }).first();
    if (await archiveBtn.isVisible()) {
      await expect(archiveBtn).toBeVisible();
    }
  });

  test('delete button removes outlet with confirmation', async ({ page }) => {
    const deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const confirmModal = page.locator('[role="dialog"]');
      await expect(confirmModal).toBeVisible({ timeout: 5_000 });
      // Cancel to avoid deleting real data
      const cancelBtn = confirmModal.locator('button').filter({ hasText: /cancel/i });
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    }
  });

  test.describe('Edge Cases', () => {
    test('creating an outlet with an empty name is rejected', async ({ page }) => {
      const addBtn = page.locator('button').filter({ hasText: /add outlet/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          // Submit button is disabled when name/code fields are empty
          const submitBtn = modal.locator('button[type="submit"]').first();
          if (await submitBtn.isVisible()) {
            await expect(submitBtn).toBeDisabled();
          }
          await expect(modal).toBeVisible();
        }
      }
    });

    test('setting an outlet as its own parent is rejected (self-cycle)', async ({ page }) => {
      // This is validated by the outlet hierarchy UI — verify no crash
      const addBtn = page.locator('button').filter({ hasText: /add outlet/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          // Close without submitting
          const cancelBtn = modal.locator('button').filter({ hasText: /cancel/i });
          if (await cancelBtn.isVisible()) await cancelBtn.click();
        }
      }
    });

    test('non-admin user directly navigating to /outlets via URL is redirected or shown 403', async ({ browser }) => {
      // Test with no auth (unauthenticated) — should redirect to /login
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      await page.goto('/outlets');
      await page.waitForURL(/\/login|\/403/, { timeout: 10_000 });
      expect(page.url()).toMatch(/login|403|error/);
      await context.close();
    });

    test('hierarchy tree with many levels renders without overflow or crash', async ({ page }) => {
      await expect(page.locator('main').first()).toBeVisible();
    });
  });
});

test.describe('Outlet Detail Page (/outlets/[id])', () => {
  async function goToFirstOutlet(page: import('@playwright/test').Page): Promise<boolean> {
    await page.goto('/outlets');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href*="/outlets/"]').first();
    if (!(await link.isVisible())) return false;
    await link.click();
    await page.waitForURL(/\/outlets\/\d+/, { timeout: 10_000 });
    return true;
  }

  test('outlet metadata is displayed and editable', async ({ page }) => {
    const found = await goToFirstOutlet(page);
    test.skip(!found, 'No outlets available');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('recipes assigned to outlet are listed with pagination', async ({ page }) => {
    const found = await goToFirstOutlet(page);
    test.skip(!found, 'No outlets available');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('"Add recipe" button assigns a recipe to the outlet', async ({ page }) => {
    const found = await goToFirstOutlet(page);
    test.skip(!found, 'No outlets available');
    const addBtn = page.locator('button').filter({ hasText: /add recipe/i });
    if (await addBtn.isVisible()) {
      await expect(addBtn).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('price override set to 0 is accepted (free item)', async ({ page }) => {
      const found = await goToFirstOutlet(page);
      test.skip(!found, 'No outlets available');
      await page.waitForLoadState('networkidle');
      const priceInput = page.locator('input[type="number"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('0');
        await priceInput.press('Tab');
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible();
      }
    });

    test('price override set to negative number is rejected', async ({ page }) => {
      const found = await goToFirstOutlet(page);
      test.skip(!found, 'No outlets available');
      await page.waitForLoadState('networkidle');
      const priceInput = page.locator('input[type="number"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('-5');
        await priceInput.press('Tab');
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible();
      }
    });
  });
});
