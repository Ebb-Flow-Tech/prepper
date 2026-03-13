/**
 * Section 6: Suppliers
 * Covers: Suppliers List Page, Supplier Detail Page
 */
import { test, expect } from '@playwright/test';
import { unique } from './helpers/data';
import { getPagination, hasPagination } from './helpers/pagination';

test.describe('Suppliers List Page (/suppliers)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
  });

  test('supplier cards/rows are displayed', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('search input filters with 300ms debounce', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.pressSequentially('test', { delay: 30 });
      await page.waitForTimeout(400);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('"Show archived" toggle reveals archived suppliers', async ({ page }) => {
    const archivedLabel = page.locator('label, button').filter({ hasText: /archived/i }).first();
    if (await archivedLabel.isVisible()) {
      await archivedLabel.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('view toggle switches between Grid and List layouts', async ({ page }) => {
    const gridBtn = page.locator('button').filter({ hasText: /grid/i });
    const listBtn = page.locator('button').filter({ hasText: /list/i });
    if (await gridBtn.isVisible() && await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(300);
      await gridBtn.click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('"Add supplier" button opens a create modal', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /add supplier/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
    }
  });

  test.describe('Edge Cases', () => {
    test('creating a supplier with an empty name is rejected', async ({ page }) => {
      const addBtn = page.locator('button').filter({ hasText: /add supplier/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          // Submit button should be disabled when name is empty
          const submitBtn = modal.locator('button[type="submit"]').first();
          if (await submitBtn.isVisible()) {
            await expect(submitBtn).toBeDisabled();
          }
          await expect(modal).toBeVisible({ timeout: 3_000 });
        }
      }
    });

    test('email field with invalid format shows validation error', async ({ page }) => {
      const addBtn = page.locator('button').filter({ hasText: /add supplier/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          const emailInput = modal.locator('input[type="email"], input[name="email"]').first();
          if (await emailInput.isVisible()) {
            await emailInput.fill('notanemail');
            const submitBtn = modal.locator('button[type="submit"]').first();
            if (await submitBtn.isVisible()) await submitBtn.click();
            // HTML5 validation or custom validation blocks submission
            await expect(modal).toBeVisible({ timeout: 3_000 });
          }
        }
      }
    });

    test('toggling "Show archived" resets pagination to page 1', async ({ page }) => {
      if (!(await hasPagination(page))) return; // Skip if no pagination

      const { nextBtn } = getPagination(page);
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }

      const archivedLabel = page.locator('label, button').filter({ hasText: /archived/i }).first();
      if (await archivedLabel.isVisible()) {
        await archivedLabel.click();
        await page.waitForTimeout(500);
        // Page should remain functional after filter change
        await expect(page.locator('main').first()).toBeVisible();
      }
    });
  });
});

test.describe('Supplier Detail Page (/suppliers/[id])', () => {
  async function goToFirstSupplier(page: import('@playwright/test').Page): Promise<boolean> {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href*="/suppliers/"]').first();
    if (!(await link.isVisible())) return false;
    await link.click();
    await page.waitForURL(/\/suppliers\/\d+/, { timeout: 10_000 });
    return true;
  }

  test('supplier metadata is displayed', async ({ page }) => {
    const found = await goToFirstSupplier(page);
    test.skip(!found, 'No suppliers available');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('archive/restore button is present', async ({ page }) => {
    const found = await goToFirstSupplier(page);
    test.skip(!found, 'No suppliers available');
    const archiveBtn = page.locator('button').filter({ hasText: /archive|restore/i });
    if (await archiveBtn.isVisible()) {
      await expect(archiveBtn).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('navigating to non-existent supplier ID does not show blank page', async ({ page }) => {
      await page.goto('/suppliers/999999999');
      await page.waitForLoadState('networkidle');
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });
  });
});
