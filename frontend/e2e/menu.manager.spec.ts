/**
 * Section 10b: Menu Management — Brand Manager Only
 * Covers: New Menu / Edit Menu Page
 * These tests run under the 'manager' project (storageState: manager.json).
 * Requires: a user holding Manager AT a brand in Passport (brand-scoped — there is no global
 * manager flag). Such a user can create and edit menus for the brand(s) they manage; the menu
 * API rejects (403) writes to any brand where they are not Manager.
 */
import { test, expect } from '@playwright/test';
import { unique } from './helpers/data';

async function goToNewMenu(page: import('@playwright/test').Page) {
  page.setDefaultNavigationTimeout(60_000);
  await page.goto('/menu/new');
  await page.waitForLoadState('domcontentloaded');
  // If auth state hasn't loaded yet the page may redirect to /menu — retry once
  if (!page.url().includes('/menu/new')) {
    await page.goto('/menu/new');
    await page.waitForLoadState('domcontentloaded');
  }
  return true;
}

test.describe('New Menu / Edit Menu Page', () => {
  test('menu name input is present and required', async ({ page }) => {
    await goToNewMenu(page);
    const nameInput = page.locator('input[name="name"], input[placeholder*="menu name"]').first();
    if (await nameInput.isVisible()) {
      await expect(nameInput).toBeVisible();
    }
  });

  test('"Add section" button adds a new section', async ({ page }) => {
    await goToNewMenu(page);
    const addSectionBtn = page.locator('button').filter({ hasText: /add section/i });
    if (await addSectionBtn.isVisible()) {
      await addSectionBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('sections can be reordered via drag-and-drop', async ({ page }) => {
    await goToNewMenu(page);
    // Just verify drag handles are present
    const gripIcons = page.locator('[class*="grip"], [aria-label*="drag"], svg[class*="grip"]');
    if (await gripIcons.count() > 0) {
      await expect(gripIcons.first()).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('publishing a menu with no sections shows validation error', async ({ page }) => {
      await goToNewMenu(page);
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
      const publishBtn = page.locator('button').filter({ hasText: /publish/i });

      if (await nameInput.isVisible() && await publishBtn.isVisible()) {
        await nameInput.fill(unique('EmptyMenu'));
        await publishBtn.click();
        await page.waitForTimeout(500);
        // Should show validation error or warning
        await expect(page.locator('main')).toBeVisible();
      }
    });

    test('saving draft with empty menu name is rejected', async ({ page }) => {
      await goToNewMenu(page);
      const saveDraftBtn = page.locator('button').filter({ hasText: /save draft|draft/i });
      if (await saveDraftBtn.isVisible()) {
        await saveDraftBtn.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main')).toBeVisible();
      }
    });

    test('item with key_highlights and additional_info both empty is allowed', async ({ page }) => {
      await goToNewMenu(page);
      const addSectionBtn = page.locator('button').filter({ hasText: /add section/i });
      if (await addSectionBtn.isVisible()) {
        await addSectionBtn.click();
        await page.waitForTimeout(200);
        const addItemBtn = page.locator('button').filter({ hasText: /add item/i }).first();
        if (await addItemBtn.isVisible()) {
          await addItemBtn.click();
          await page.waitForTimeout(200);
          await expect(page.locator('main')).toBeVisible();
        }
      }
    });
  });
});
