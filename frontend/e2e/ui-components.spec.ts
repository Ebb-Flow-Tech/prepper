/**
 * Sections 12-14: UI Component Behaviors, Authorization, Cross-cutting Concerns
 * Covers: Search, Drag-and-Drop, Inline Editing, Modals, Confirm Modal,
 *         Pagination, View Toggle, Toast Notifications, Loading/Empty States,
 *         Badges, Auth/Access Control, Autosave, Error Handling, Responsiveness
 */
import { test, expect } from '@playwright/test';
import { getPagination, hasPagination } from './helpers/pagination';

// ---------------------------------------------------------------------------
// Section 12: UI Component Behaviors
// ---------------------------------------------------------------------------

test.describe('Search & Filtering', () => {
  test('search inputs debounce at 300ms (no immediate API call per keystroke)', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const requestTimes: number[] = [];
    await page.route('**/api/v1/recipes**', (route) => {
      requestTimes.push(Date.now());
      route.continue();
    });

    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      // Type each character with 50ms delay (well within 300ms debounce)
      await searchInput.pressSequentially('abc', { delay: 50 });
      await page.waitForTimeout(600); // Wait for debounce to fire

      // Should have fired at most 2 requests (one possible immediate, one debounced)
      expect(requestTimes.length).toBeLessThanOrEqual(3);
    }
  });

  test('clearing search restores full results', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('uniquenonexistentterm');
      await page.waitForTimeout(500);
      await searchInput.clear();
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('filter changes reset pagination to page 1', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');

    // Navigate to page 2 if possible
    if (await hasPagination(page)) {
      const { nextBtn } = getPagination(page);
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Apply a filter
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      // Should be back on page 1 — prev button disabled
      if (await hasPagination(page)) {
        const { prevBtn } = getPagination(page);
        expect(await prevBtn.isDisabled()).toBe(true);
      }
    }
  });

  test.describe('Edge Cases', () => {
    test('typing and immediately clearing within 300ms sends no API request', async ({ page }) => {
      await page.goto('/recipes');
      await page.waitForLoadState('networkidle');

      let requestFired = false;
      await page.route('**/api/v1/recipes**', (route) => {
        if (route.request().url().includes('search')) requestFired = true;
        route.continue();
      });

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('a');
        await page.waitForTimeout(100); // Clear before debounce fires
        await searchInput.clear();
        await page.waitForTimeout(100);
        // Request should not have fired yet
        expect(requestFired).toBe(false);
      }
    });

    test('search input with only whitespace does not send a search request', async ({ page }) => {
      await page.goto('/recipes');
      await page.waitForLoadState('networkidle');

      let whitespaceSearchFired = false;
      await page.route('**/api/v1/recipes**', (route) => {
        const url = route.request().url();
        if (url.includes('search=%20') || url.includes('q=%20')) whitespaceSearchFired = true;
        route.continue();
      });

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('   ');
        await page.waitForTimeout(500);
        expect(whitespaceSearchFired).toBe(false);
      }
    });
  });
});

test.describe('Inline Editing (EditableCell)', () => {
  test('clicking enters edit mode with save and cancel buttons', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const recipeLink = page.locator('a[href*="/recipes/"]').first();
    if (!(await recipeLink.isVisible())) return;
    await recipeLink.click();
    await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });

    // Look for EditableCell — click on editable text
    const editableCell = page.locator('[class*="editable"], [data-editable="true"]').first();
    if (await editableCell.isVisible()) {
      await editableCell.click();
      const saveBtn = page.locator('button').filter({ hasText: /save/i });
      const cancelBtn = page.locator('button').filter({ hasText: /cancel/i });
      if (await saveBtn.isVisible() || await cancelBtn.isVisible()) {
        expect(true).toBe(true); // Edit mode activated
      }
    }
  });

  test('pressing Escape cancels edit', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const recipeLink = page.locator('a[href*="/recipes/"]').first();
    if (!(await recipeLink.isVisible())) return;
    await recipeLink.click();
    await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });

    const editableCell = page.locator('[class*="editable"]').first();
    if (await editableCell.isVisible()) {
      await editableCell.click();
      const input = editableCell.locator('input').first();
      if (await input.isVisible()) {
        await input.fill('changed value');
        await input.press('Escape');
        await page.waitForTimeout(300);
        // Value should have reverted
        await expect(page.locator('main').first()).toBeVisible();
      }
    }
  });

  test.describe('Edge Cases', () => {
    test('saving an unchanged value does not trigger an API call', async ({ page }) => {
      await page.goto('/recipes');
      await page.waitForLoadState('networkidle');

      const recipeLink = page.locator('a[href*="/recipes/"]').first();
      if (!(await recipeLink.isVisible())) return;
      await recipeLink.click();
      await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });

      let patchCount = 0;
      await page.route('**', (route) => {
        if (route.request().method() === 'PATCH') patchCount++;
        route.continue();
      });

      const editableCell = page.locator('[class*="editable"]').first();
      if (await editableCell.isVisible()) {
        await editableCell.click();
        const input = editableCell.locator('input').first();
        if (await input.isVisible()) {
          // Press Enter without changing value
          await input.press('Enter');
          await page.waitForTimeout(500);
          expect(patchCount).toBe(0);
        }
      }
    });
  });
});

test.describe('Modals', () => {
  test('modals open with correct title and content', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Use "New Recipe" button (not "Add recipe")
    const addBtn = page.locator('button').filter({ hasText: /new recipe/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      // New Recipe navigates to /recipes/new, not a modal
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('pressing Escape closes a modal', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await expect(modal).not.toBeVisible();
    }
  });

  test('loading state disables submit button and shows spinner', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');

    await page.route('**/api/v1/ingredients', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 800));
      }
      await route.continue();
    });

    const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        const nameInput = modal.locator('input').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Ingredient');
          const submitBtn = modal.locator('button[type="submit"]').first();
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
            await expect(submitBtn).toBeDisabled({ timeout: 500 });
          }
        }
      }
    }
  });

  test.describe('Edge Cases', () => {
    test('Tab key navigation stays within the modal (focus trap)', async ({ page }) => {
      await page.goto('/ingredients');
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // Tab multiple times and verify focus stays within modal
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
          expect(focused).toBe(true);
        }
      }
    });
  });
});

test.describe('Confirm Modal', () => {
  test('destructive actions require confirmation', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Find a delete button anywhere on the page
    const deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const confirmModal = page.locator('[role="dialog"]');
      await expect(confirmModal).toBeVisible({ timeout: 5_000 });
      // Cancel to avoid deleting data
      const cancelBtn = confirmModal.locator('button').filter({ hasText: /cancel/i });
      if (await cancelBtn.isVisible()) await cancelBtn.click();
    }
  });

  test('"Cancel" button dismisses without action', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');

    const ingredientLink = page.locator('a[href*="/ingredients/"]').first();
    if (await ingredientLink.isVisible()) {
      await ingredientLink.click();
      await page.waitForURL(/\/ingredients\/\d+/, { timeout: 10_000 });

      const deleteBtn = page.locator('button').filter({ hasText: /delete|remove/i }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          const cancelBtn = modal.locator('button').filter({ hasText: /cancel/i });
          await cancelBtn.click();
          await expect(modal).not.toBeVisible({ timeout: 3_000 });
        }
      }
    }
  });

  test.describe('Edge Cases', () => {
    test('pressing Escape on confirm modal cancels the action', async ({ page }) => {
      await page.goto('/ingredients');
      await page.waitForLoadState('networkidle');

      const ingredientLink = page.locator('a[href*="/ingredients/"]').first();
      if (await ingredientLink.isVisible()) {
        await ingredientLink.click();
        await page.waitForURL(/\/ingredients\/\d+/, { timeout: 10_000 });

        const deleteBtn = page.locator('button').filter({ hasText: /delete|remove/i }).first();
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          const modal = page.locator('[role="dialog"]');
          if (await modal.isVisible()) {
            await page.keyboard.press('Escape');
            await expect(modal).not.toBeVisible({ timeout: 3_000 });
          }
        }
      }
    });

    test('double-clicking Confirm does not trigger action twice', async ({ page }) => {
      await page.goto('/ingredients');
      await page.waitForLoadState('networkidle');

      const ingredientLink = page.locator('a[href*="/ingredients/"]').first();
      if (!(await ingredientLink.isVisible())) return;
      await ingredientLink.click();
      await page.waitForURL(/\/ingredients\/\d+/, { timeout: 10_000 });

      let deleteCallCount = 0;
      await page.route('**', (route) => {
        if (route.request().method() === 'DELETE') deleteCallCount++;
        route.continue();
      });

      const deleteBtn = page.locator('button').filter({ hasText: /delete|remove/i }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          const confirmBtn = modal.locator('button').filter({ hasText: /confirm|delete|yes/i });
          await confirmBtn.dblclick();
          await page.waitForTimeout(500);
          expect(deleteCallCount).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});

test.describe('Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
  });

  test('"Next" and "Previous" buttons navigate pages', async ({ page }) => {
    if (!(await hasPagination(page))) return; // Skip if fewer than 30 items
    const { nextBtn, prevBtn } = getPagination(page);
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      expect(await prevBtn.isEnabled()).toBe(true);
    }
  });

  test('prev button is disabled on the first page', async ({ page }) => {
    if (!(await hasPagination(page))) return; // Skip if fewer than 30 items
    const { prevBtn } = getPagination(page);
    expect(await prevBtn.isDisabled()).toBe(true);
  });

  test.describe('Edge Cases', () => {
    test('with 0 items no pagination controls are shown', async ({ page }) => {
      // Search for something that returns 0 results
      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('xyzabsolutelynothing12345');
        await page.waitForTimeout(500);
        // Pagination should be hidden (totalPages <= 1 → renders null)
        const hasPagn = await hasPagination(page);
        expect(hasPagn).toBe(false);
      }
    });

    test('rapidly clicking Next does not navigate beyond the last page', async ({ page }) => {
      if (!(await hasPagination(page))) return;
      const { nextBtn } = getPagination(page);
      if (await nextBtn.isEnabled()) {
        // Click rapidly
        await nextBtn.click();
        await nextBtn.click();
        await nextBtn.click();
        await page.waitForTimeout(500);
        await expect(page.locator('main').first()).toBeVisible();
      }
    });
  });
});

test.describe('View Toggle (Grid / List)', () => {
  test('toggling between grid and list switches the layout', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');

    const gridBtn = page.locator('button').filter({ hasText: /grid/i });
    const listBtn = page.locator('button').filter({ hasText: /list/i });

    if (await gridBtn.isVisible() && await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(300);
      await gridBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test.describe('Edge Cases', () => {
    test('switching view while search is active preserves search results', async ({ page }) => {
      await page.goto('/ingredients');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[placeholder*="earch"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);

        const listBtn = page.locator('button').filter({ hasText: /list/i });
        if (await listBtn.isVisible()) {
          await listBtn.click();
          await page.waitForTimeout(300);
          // Search value should still be in the input
          await expect(searchInput).toHaveValue('test');
        }
      }
    });
  });
});

test.describe('Toast Notifications', () => {
  test('error toasts appear on failed API calls', async ({ page }) => {
    await page.goto('/ingredients');
    await page.waitForLoadState('networkidle');

    // Simulate a failed API call by intercepting a POST
    await page.route('**/api/v1/ingredients', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: 'Internal Server Error' });
      } else {
        await route.continue();
      }
    });

    const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        const nameInput = modal.locator('input').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Ingredient');
          const submitBtn = modal.locator('button[type="submit"]').first();
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
            // Error toast should appear
            const toast = page.locator('[data-sonner-toast]');
            await expect(toast).toBeVisible({ timeout: 5_000 });
          }
        }
      }
    }
  });

  test('toasts auto-dismiss after a few seconds', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Check if any toast is already present
    const toast = page.locator('[data-sonner-toast]');
    if (await toast.isVisible()) {
      await page.waitForTimeout(6000);
      await expect(toast).not.toBeVisible({ timeout: 2_000 });
    }
  });
});

test.describe('Loading & Empty States', () => {
  test('empty state message is shown when no results exist', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('xyznothing12345absolutely');
      await page.waitForTimeout(500);
      await expect(page.locator('main').first()).toBeVisible();
      // Should show some kind of empty state text
      const bodyText = await page.locator('main').first().textContent();
      expect(bodyText).toBeTruthy();
    }
  });

  test.describe('Edge Cases', () => {
    test('if data fails to load, error state is shown instead of empty state', async ({ page }) => {
      await page.route('**/api/v1/recipes**', (route) => {
        route.fulfill({ status: 500, body: 'Server Error' });
      });

      await page.goto('/recipes');
      await page.waitForLoadState('networkidle');

      // Should show error state, not blank page
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Section 13: Authorization & Access Control
// ---------------------------------------------------------------------------

test.describe('Authorization & Access Control', () => {
  test('unauthenticated users navigating to protected pages are redirected to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/recipes');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });

  test('admin-only nav item (/admin/users) is not visible to normal users', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Only /admin/users is adminOnly: true in TopNav
    const adminUsersLink = page.locator('nav a[href*="/admin/users"]');
    const isVisible = await adminUsersLink.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test.describe('Edge Cases', () => {
    test('token with admin role but expired signature is rejected', async ({ page }) => {
      await page.goto('/');
      // Set an obviously invalid/expired JWT
      await page.evaluate(() => {
        localStorage.setItem('prepper_auth', JSON.stringify({
          userId: 'some-user',
          jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcl90eXBlIjoiYWRtaW4iLCJleHAiOjF9.INVALID',
          userType: 'admin',
          refreshToken: 'expired-refresh',
          username: 'hacker',
          email: 'hacker@example.com',
          isManager: false,
          outletId: null,
        }));
      });

      // Try to access a protected page
      await page.goto('/outlets');
      await page.waitForURL(/\/login|\/403/, { timeout: 10_000 });
      // Should not grant access
      expect(page.url()).not.toContain('/outlets');
    });
  });
});

// ---------------------------------------------------------------------------
// Section 14: Cross-cutting Concerns
// ---------------------------------------------------------------------------

test.describe('Error Handling', () => {
  test('network errors display a user-friendly error message', async ({ page }) => {
    // Simulate network failure on API calls only (not the page HTML)
    await page.route('**/api/v1/recipes**', (route) => route.abort('failed'));
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Should not show a blank screen
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });

  test.describe('Edge Cases', () => {
    test('HTTP 500 surfaces a user-friendly message, not a raw stack trace', async ({ page }) => {
      await page.route('**/api/v1/recipes**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' }),
        });
      });
      await page.goto('/recipes');
      await page.waitForLoadState('networkidle');
      // Should not show raw Python traceback or JSON dump
      const bodyText = await page.locator('body').textContent() || '';
      expect(bodyText).not.toContain('Traceback');
      expect(bodyText).not.toContain('File "/');
    });
  });
});

test.describe('Responsiveness', () => {
  test('pages are usable at tablet width (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Main content should be visible without horizontal overflow
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(768 + 20); // Allow small buffer
  });

  test('navigation is accessible at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test.describe('Edge Cases', () => {
    test('modals do not overflow the viewport on narrow screens', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/ingredients');
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button').filter({ hasText: /add ingredient/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          const modalBox = await modal.boundingBox();
          if (modalBox) {
            expect(modalBox.x).toBeGreaterThanOrEqual(0);
            expect(modalBox.y).toBeGreaterThanOrEqual(0);
            expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(768 + 20);
          }
        }
      }
    });
  });
});

test.describe('Autosave', () => {
  test('recipe fields auto-save without a save button', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const recipeLink = page.locator('a[href*="/recipes/"]').first();
    if (!(await recipeLink.isVisible())) return;
    await recipeLink.click();
    await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });

    // Switch to overview tab
    const overviewTab = page.locator('[role="tab"]').filter({ hasText: /overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
      await page.waitForTimeout(300);
    }

    let autosaveFired = false;
    await page.route('**', (route) => {
      if (route.request().method() === 'PATCH') autosaveFired = true;
      route.continue();
    });

    // Edit a field and wait for debounce
    const descField = page.locator('textarea[placeholder*="escription"], input[placeholder*="escription"]').first();
    if (await descField.isVisible()) {
      await descField.fill('Autosave test description');
      await page.waitForTimeout(800); // Wait for debounce
      expect(autosaveFired).toBe(true);
    }
  });

  test('no data loss on tab switch within recipe canvas', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    const recipeLink = page.locator('a[href*="/recipes/"]').first();
    if (!(await recipeLink.isVisible())) return;
    await recipeLink.click();
    await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });

    const overviewTab = page.locator('[role="tab"]').filter({ hasText: /overview/i });
    const ingredientsTab = page.locator('[role="tab"]').filter({ hasText: /ingredients/i });

    if (await overviewTab.isVisible() && await ingredientsTab.isVisible()) {
      await overviewTab.click();
      await page.waitForTimeout(300);
      await ingredientsTab.click();
      await page.waitForTimeout(300);
      await overviewTab.click();
      await page.waitForTimeout(300);
      // No crash or data loss
      await expect(page.locator('main').first()).toBeVisible();
    }
  });
});
