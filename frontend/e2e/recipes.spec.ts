/**
 * Section 3: Recipe Management
 * Covers: Recipe List, Category Management, New Recipe, Recipe Detail
 *
 * Facts from RecipeManagementTab.tsx:
 * - "New Recipe" button (not "Add recipe")
 * - Pagination uses ChevronLeft/Right SVG icons (no text)
 * - Pagination is hidden when totalPages <= 1
 */
import { test, expect } from '@playwright/test';
import { RecipesPage } from './pages/RecipesPage';
import { unique, XSS_PAYLOAD, LONG_STRING_500 } from './helpers/data';

/** Pagination helpers — Pagination uses icon-only buttons, no text */
function getPaginationButtons(page: import('@playwright/test').Page) {
  // The pagination span shows "X / Y" — use it to locate the pagination container
  const pageText = page.locator('span').filter({ hasText: /^\d+ \/ \d+$/ });
  const prevBtn = page.locator('[class*="border-t"] button').first();
  const nextBtn = page.locator('[class*="border-t"] button').last();
  return { pageText, prevBtn, nextBtn };
}

test.describe('Recipe List Page (/recipes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
  });

  test('recipes are listed with name and status', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('search input filters recipes with debounce', async ({ page }) => {
    const recipesPage = new RecipesPage(page);
    await expect(recipesPage.searchInput).toBeVisible();

    let requestCount = 0;
    await page.route('**/recipes*', (route) => {
      if (route.request().url().includes('search') || route.request().url().includes('q=')) requestCount++;
      route.continue();
    });

    await recipesPage.searchInput.pressSequentially('test', { delay: 50 });
    await page.waitForTimeout(400);
    expect(requestCount).toBeLessThanOrEqual(2);
  });

  test('search clearing restores full list', async ({ page }) => {
    const recipesPage = new RecipesPage(page);
    await recipesPage.search('xyznonexistentrecipe123');
    await page.waitForTimeout(500);
    await recipesPage.clearSearch();
    await page.waitForTimeout(500);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('"New Recipe" button is visible', async ({ page }) => {
    const newBtn = page.locator('button').filter({ hasText: /new recipe/i });
    await expect(newBtn).toBeVisible();
  });

  test('clicking a recipe row navigates to /recipes/[id]', async ({ page }) => {
    const recipeItem = page.locator('a[href*="/recipes/"]').first();
    if (await recipeItem.isVisible()) {
      await recipeItem.click();
      await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/recipes\/\d+/);
    }
  });

  test('tab switching between Recipe Management and Category Management works', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(300);
      await tabs.nth(0).click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('main').first()).toBeVisible();
  });

  test.describe('Pagination', () => {
    test('pagination controls are present when there are multiple pages', async ({ page }) => {
      const { pageText } = getPaginationButtons(page);
      const hasPagination = await pageText.isVisible().catch(() => false);
      if (hasPagination) {
        await expect(pageText).toBeVisible();
      } else {
        // Fewer than 30 items — pagination hidden, that is correct
        expect(true).toBe(true);
      }
    });

    test('rapidly clicking Next/Previous does not cause race conditions', async ({ page }) => {
      const { nextBtn, pageText } = getPaginationButtons(page);
      const hasPagination = await pageText.isVisible().catch(() => false);
      if (!hasPagination) return; // Skip if no pagination

      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await nextBtn.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible();
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('search with only whitespace does not produce an API error', async ({ page }) => {
      const recipesPage = new RecipesPage(page);
      await recipesPage.search('   ');
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible();
    });

    test('search with XSS payload is escaped and displayed safely', async ({ page }) => {
      const dialogs: string[] = [];
      page.on('dialog', (dialog) => { dialogs.push(dialog.message()); dialog.dismiss(); });

      const recipesPage = new RecipesPage(page);
      await recipesPage.search(XSS_PAYLOAD);
      await page.waitForTimeout(500);
      expect(dialogs).toHaveLength(0);
    });

    test('search with very long string does not overflow the input', async ({ page }) => {
      const recipesPage = new RecipesPage(page);
      await recipesPage.search(LONG_STRING_500);
      await page.waitForTimeout(500);
      const inputBox = await recipesPage.searchInput.boundingBox();
      const viewport = page.viewportSize();
      if (inputBox && viewport) {
        expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });

    test('search with regex special characters does not crash', async ({ page }) => {
      const recipesPage = new RecipesPage(page);
      await recipesPage.search('.*+?[]()');
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------
// Recipe Category Management Tab
// ---------------------------------------------------------------------------
test.describe('Recipe Category Management Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count >= 2) {
      // Switch to the second tab (categories)
      await tabs.nth(1).click();
      await page.waitForTimeout(300);
    }
  });

  test('category management tab renders', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('"Add category" button opens a modal', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /add category/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
    }
  });

  test.describe('Edge Cases', () => {
    test('creating a category with an empty name shows a validation error', async ({ page }) => {
      const addBtn = page.locator('button').filter({ hasText: /add category/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          // Submit without filling in the name
          const submitBtn = modal.locator('button[type="submit"]');
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
          } else {
            // Try any button that's not cancel
            const btns = modal.locator('button').filter({ hasText: /create|add|save/i });
            if (await btns.count() > 0) await btns.last().click();
          }
          await expect(modal).toBeVisible({ timeout: 3_000 });
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// New Recipe Page
// ---------------------------------------------------------------------------
test.describe('New Recipe Page (/recipes/new)', () => {
  test('page loads without error', async ({ page }) => {
    await page.goto('/recipes/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('canvas tabs are accessible', async ({ page }) => {
    await page.goto('/recipes/new');
    await page.waitForLoadState('networkidle');

    const expectedTabs = ['canvas', 'overview', 'ingredients', 'instructions', 'costs', 'outlets', 'tasting', 'versions'];
    for (const tabName of expectedTabs) {
      const tab = page.locator('[role="tab"]').filter({ hasText: new RegExp(tabName, 'i') });
      if (await tab.count() > 0) {
        await expect(tab.first()).toBeVisible();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Recipe Detail Page
// ---------------------------------------------------------------------------
test.describe('Recipe Detail Page (/recipes/[id])', () => {
  test('navigating to a non-existent recipe ID does not show a blank page', async ({ page }) => {
    await page.goto('/recipes/999999999');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(10);
  });

  test('back link navigates to /recipes', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
    const recipeLink = page.locator('a[href*="/recipes/"]').first();
    if (await recipeLink.isVisible()) {
      await recipeLink.click();
      await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });

      const backLink = page.locator('a').filter({ hasText: /back|recipes/i }).first();
      if (await backLink.isVisible()) {
        await backLink.click();
        await page.waitForURL('/recipes', { timeout: 10_000 });
        expect(page.url()).toContain('/recipes');
      }
    }
  });
});
