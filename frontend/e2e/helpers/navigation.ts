/**
 * Shared navigation helpers for e2e tests.
 *
 * All goTo* functions:
 *  - Prefer direct URL navigation via seed data (faster, no list-page scraping)
 *  - Fall back to scraping the list page when seed data is unavailable
 *  - Set prepper_last_route via addInitScript to survive any AuthGuard redirect
 *  - Return false (not throw) when no matching entity can be found — callers
 *    should test.skip() on a false return value
 */
import type { Page } from '@playwright/test';
import { readSeedUserData } from './seed';

/** Persist a last-route hint so AuthGuard redirects back to the target page. */
async function setLastRoute(page: Page, url: string): Promise<void> {
  await page.addInitScript((target: string) => {
    window.localStorage.setItem('prepper_last_route', target);
  }, url);
}

export async function goToFirstRecipe(page: Page): Promise<boolean> {
  const seed = readSeedUserData();
  if (seed?.recipeId) {
    const url = `/recipes/${seed.recipeId}`;
    await setLastRoute(page, url);
    await page.goto(url);
    await page.waitForURL(/\/recipes\/\d+/, { timeout: 15_000 });
    return true;
  }
  await page.goto('/recipes');
  await page.waitForLoadState('load');
  const link = page.locator('a[href*="/recipes/"]').first();
  if (!(await link.isVisible())) return false;
  await link.click();
  await page.waitForURL(/\/recipes\/\d+/, { timeout: 10_000 });
  return true;
}

export async function goToFirstIngredient(page: Page): Promise<boolean> {
  const seed = readSeedUserData();
  if (seed?.ingredientId) {
    const url = `/ingredients/${seed.ingredientId}`;
    await setLastRoute(page, url);
    await page.goto(url);
    await page.waitForURL(/\/ingredients\/\d+/, { timeout: 15_000 });
    return true;
  }
  await page.goto('/ingredients');
  await page.waitForLoadState('load');
  const link = page.locator('a[href*="/ingredients/"]').first();
  if (!(await link.isVisible())) return false;
  await link.click();
  await page.waitForURL(/\/ingredients\/\d+/, { timeout: 10_000 });
  return true;
}

/** Navigate directly to a known ingredient detail page (requires a valid ID). */
export async function goToIngredientDetail(page: Page, ingredientId: number): Promise<void> {
  const url = `/ingredients/${ingredientId}`;
  await setLastRoute(page, url);
  await page.goto(url);
  await page.waitForURL(/\/ingredients\/\d+/, { timeout: 10_000 });
  await page.waitForLoadState('load');
}

export async function goToFirstSupplier(page: Page): Promise<boolean> {
  const seed = readSeedUserData();
  if (seed?.supplierId) {
    const url = `/suppliers/${seed.supplierId}`;
    await setLastRoute(page, url);
    await page.goto(url);
    await page.waitForURL(/\/suppliers\/\d+/, { timeout: 15_000 });
    return true;
  }
  await page.goto('/suppliers');
  await page.waitForLoadState('load');
  const link = page.locator('a[href*="/suppliers/"]').first();
  // Wait up to 8s for async data to load before giving up
  const found = await link.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!found) return false;
  await link.click();
  await page.waitForURL(/\/suppliers\/\d+/, { timeout: 10_000 });
  return true;
}

export async function goToFirstSession(page: Page): Promise<boolean> {
  const seed = readSeedUserData();
  if (seed?.sessionId) {
    const url = `/tastings/${seed.sessionId}`;
    await setLastRoute(page, url);
    await page.goto(url);
    await page.waitForURL(/\/tastings\/\d+/, { timeout: 15_000 });
    return true;
  }
  await page.goto('/tastings');
  await page.waitForLoadState('load');
  const allLinks = await page.locator('a[href]').evaluateAll((els) =>
    (els as HTMLAnchorElement[])
      .filter((el) => /\/tastings\/\d+$/.test(el.getAttribute('href') || ''))
      .map((el) => el.getAttribute('href'))
  );
  if (allLinks.length === 0) return false;
  await page.goto(allLinks[0]!);
  await page.waitForURL(/\/tastings\/\d+/, { timeout: 10_000 });
  return true;
}

/**
 * Navigate to a menu preview page.
 * Pass the menuId from the appropriate seed file — admin seed for the chromium
 * project, manager seed for the manager project.
 */
export async function goToMenuPreview(page: Page, menuId?: number): Promise<boolean> {
  const previewUrl = menuId ? `/menu/preview/${menuId}` : null;

  // Navigate through /menu first to establish browser history for the back button.
  // addInitScript ensures AuthGuard redirects back to the target on load.
  await page.addInitScript((target: string) => {
    window.localStorage.setItem('prepper_last_route', target);
  }, previewUrl ?? '/menu');

  await page.goto('/menu');
  await page.waitForLoadState('load');

  if (previewUrl) {
    await page.goto(previewUrl);
    await page.waitForURL(/\/menu\/preview\/\d+/, { timeout: 10_000 });
    return true;
  }

  // Fallback: find a View/Preview button on the menu list page
  const viewBtn = page.locator('a, button').filter({ hasText: /view|preview/i }).first();
  if (!(await viewBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return false;
  await viewBtn.click();
  await page.waitForURL(/\/menu\/preview\/\d+/, { timeout: 10_000 });
  return true;
}
