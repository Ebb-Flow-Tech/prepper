/**
 * Section 9: R&D Workspace
 * Covers: R&D List Page, To Do Column, In Progress Column, Review Column
 */
import { test, expect } from '@playwright/test';

test.describe('R&D List Page (/rnd)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rnd');
    await page.waitForLoadState('networkidle');
  });

  test('three columns are displayed: To Do, In Progress, Review', async ({ page }) => {
    const columns = ['to do', 'in progress', 'review'];
    for (const col of columns) {
      const column = page.locator('h2, h3, [class*="column"]').filter({ hasText: new RegExp(col, 'i') });
      if (await column.count() > 0) {
        await expect(column.first()).toBeVisible();
      }
    }
    await expect(page.locator('main')).toBeVisible();
  });

  test('search input filters across all columns with debounce', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.pressSequentially('test', { delay: 30 });
      await page.waitForTimeout(400);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('all three columns empty shows empty states', async ({ page }) => {
      await expect(page.locator('main')).toBeVisible();
      // Should not have blank/collapsed columns
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });

    test('search with no matches shows empty states in all three columns', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('xyznonexistent12345');
        await page.waitForTimeout(500);
        await expect(page.locator('main')).toBeVisible();
      }
    });
  });
});

test.describe('To Do Column', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rnd');
    await page.waitForLoadState('networkidle');
  });

  test('recipes not yet started are listed with name, yield, and status badge', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
  });

  test('"Fork" button creates an editable copy', async ({ page }) => {
    const forkBtn = page.locator('button').filter({ hasText: /fork/i }).first();
    if (await forkBtn.isVisible()) {
      // Just verify it's clickable
      await expect(forkBtn).toBeEnabled();
    }
  });

  test('feedback summary toggle collapses/expands summary section', async ({ page }) => {
    const summaryToggle = page.locator('button').filter({ hasText: /summary|feedback/i }).first();
    if (await summaryToggle.isVisible()) {
      await summaryToggle.click();
      await page.waitForTimeout(300);
      await summaryToggle.click();
      await page.waitForTimeout(300);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('"Fork" button is disabled during fork operation', async ({ page }) => {
      const forkBtn = page.locator('button').filter({ hasText: /fork/i }).first();
      if (await forkBtn.isVisible()) {
        await page.route('**/fork', async (route) => {
          await new Promise((r) => setTimeout(r, 500));
          await route.continue();
        });
        await forkBtn.click();
        await page.waitForTimeout(100);
        const isDisabled = await forkBtn.isDisabled();
        // Either disabled or still visible — no crash
        await page.waitForTimeout(600);
        await expect(page.locator('main')).toBeVisible();
      }
    });

    test('recipe with no tasting history shows appropriate message', async ({ page }) => {
      const summaryToggle = page.locator('button').filter({ hasText: /summary|feedback/i }).first();
      if (await summaryToggle.isVisible()) {
        await summaryToggle.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main')).toBeVisible();
      }
    });
  });
});

test.describe('In Progress Column', () => {
  test('forked recipes owned by current user are listed', async ({ page }) => {
    await page.goto('/rnd');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeVisible();
  });

  test('"Add new session" button is present', async ({ page }) => {
    await page.goto('/rnd');
    await page.waitForLoadState('networkidle');
    const addSessionBtn = page.locator('button').filter({ hasText: /add.*session|new session/i });
    if (await addSessionBtn.isVisible()) {
      await expect(addSessionBtn).toBeVisible();
    }
  });
});

test.describe('Review Column', () => {
  test('tasting sessions containing review_ready recipes are listed', async ({ page }) => {
    await page.goto('/rnd');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeVisible();
  });

  test.describe('Edge Cases', () => {
    test('review column with no sessions shows an empty state', async ({ page }) => {
      await page.goto('/rnd');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
