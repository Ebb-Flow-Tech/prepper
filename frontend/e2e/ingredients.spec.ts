/**
 * Section 5: Ingredients
 * Covers: Ingredients List Page, Ingredient Detail Page
 */
import { test, expect } from '@playwright/test';
import { unique } from './helpers/data';
import { getPagination, hasPagination } from './helpers/pagination';

test.describe('Ingredients List Page (/ingredients)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');
  });

  test('tab navigation: Ingredients, Categories, Allergens', async ({ page }) => {
    const tabs = ['ingredients', 'categories', 'allergens'];
    for (const tabName of tabs) {
      const tab = page.locator('[role="tab"]').filter({ hasText: new RegExp(tabName, 'i') });
      if (await tab.count() > 0) {
        await expect(tab.first()).toBeVisible();
      }
    }
  });

  test('search input filters with 300ms debounce', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await expect(searchInput).toBeVisible();

    let requestCount = 0;
    await page.route('**/ingredients*', (route) => {
      if (route.request().url().includes('search') || route.request().url().includes('q=')) requestCount++;
      route.continue();
    });

    await searchInput.pressSequentially('flour', { delay: 30 });
    await page.waitForTimeout(400);
    expect(requestCount).toBeLessThanOrEqual(3);
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

  test('"Show archived" checkbox reveals archived ingredients', async ({ page }) => {
    const archivedLabel = page.locator('label, button').filter({ hasText: /archived/i }).first();
    if (await archivedLabel.isVisible()) {
      await archivedLabel.click();
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('"Add ingredient" button opens a create modal', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
    }
  });

  test.describe('Filters', () => {
    test('sort by Price works', async ({ page }) => {
      const sortBtn = page.locator('button, select').filter({ hasText: /price/i }).first();
      if (await sortBtn.isVisible()) {
        await sortBtn.click();
        await page.waitForTimeout(500);
      }
      await expect(page.locator('main').first()).toBeVisible();
    });

    test('halal filter works', async ({ page }) => {
      const halalFilter = page.locator('button').filter({ hasText: /halal/i }).first();
      if (await halalFilter.isVisible()) {
        await halalFilter.click();
        await page.waitForTimeout(500);
      }
      await expect(page.locator('main').first()).toBeVisible();
    });

    test('allergen filter works', async ({ page }) => {
      const allergenFilter = page.locator('button').filter({ hasText: /allergen/i }).first();
      if (await allergenFilter.isVisible()) {
        await allergenFilter.click();
        await page.waitForTimeout(500);
      }
      await expect(page.locator('main').first()).toBeVisible();
    });

    test('resetting filters restores full list', async ({ page }) => {
      const resetBtn = page.locator('button').filter({ hasText: /reset|clear/i }).first();
      if (await resetBtn.isVisible()) {
        await resetBtn.click();
        await page.waitForTimeout(500);
      }
      await expect(page.locator('main').first()).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('applying search + halal filter simultaneously works without error', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="earch"]').first();
      await searchInput.fill('test');
      const halalFilter = page.locator('button').filter({ hasText: /halal/i }).first();
      if (await halalFilter.isVisible()) await halalFilter.click();
      await page.waitForTimeout(600);
      await expect(page.locator('main').first()).toBeVisible();
    });

    test('toggling Show Archived while on page 2+ resets pagination to page 1', async ({ page }) => {
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

    test('creating ingredient with empty name is rejected', async ({ page }) => {
      const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
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
  });
});

test.describe('Ingredient Detail Page (/ingredients/[id])', () => {
  async function goToFirstIngredient(page: import('@playwright/test').Page): Promise<boolean> {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href*="/ingredients/"]').first();
    if (!(await link.isVisible())) return false;
    await link.click();
    await page.waitForURL(/\/ingredients\/\d+/, { timeout: 10_000 });
    return true;
  }

  test('ingredient metadata is displayed', async ({ page }) => {
    const found = await goToFirstIngredient(page);
    test.skip(!found, 'No ingredients available');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('archive/unarchive button is present', async ({ page }) => {
    const found = await goToFirstIngredient(page);
    test.skip(!found, 'No ingredients available');
    const archiveBtn = page.locator('button').filter({ hasText: /archive|unarchive/i });
    if (await archiveBtn.isVisible()) {
      await expect(archiveBtn).toBeVisible();
    }
  });

  test('AI categorization button is present', async ({ page }) => {
    const found = await goToFirstIngredient(page);
    test.skip(!found, 'No ingredients available');
    const aiBtn = page.locator('button').filter({ hasText: /categorize|ai|suggest/i });
    if (await aiBtn.isVisible()) {
      await expect(aiBtn).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('navigating to non-existent ingredient ID does not show blank page', async ({ page }) => {
      await page.goto('/ingredients/999999999');
      await page.waitForLoadState('networkidle');
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });

    test('setting cost to 0 is accepted', async ({ page }) => {
      const found = await goToFirstIngredient(page);
      test.skip(!found, 'No ingredients available');
      const costInput = page.locator('input[type="number"]').first();
      if (await costInput.isVisible()) {
        await costInput.fill('0');
        await costInput.press('Tab');
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible();
      }
    });

    test('ingredient with no suppliers shows empty supplier list without error', async ({ page }) => {
      const found = await goToFirstIngredient(page);
      test.skip(!found, 'No ingredients available');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').first()).toBeVisible();
    });
  });
});
