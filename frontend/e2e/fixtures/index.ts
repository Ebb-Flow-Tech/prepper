import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type { Page };

/** Extended test fixtures */
export const test = base.extend<{
  /** Page with toast assertion helper */
  toastPage: Page & {
    expectToast: (message: string | RegExp) => Promise<void>;
    expectSuccessToast: () => Promise<void>;
    expectErrorToast: () => Promise<void>;
  };
}>({
  toastPage: async ({ page }, use) => {
    const extended = Object.assign(page, {
      async expectToast(message: string | RegExp) {
        // Sonner toasts render with role="status" or data-sonner-toast
        await expect(
          page.locator('[data-sonner-toast]').filter({ hasText: message })
        ).toBeVisible({ timeout: 5_000 });
      },
      async expectSuccessToast() {
        await expect(
          page.locator('[data-sonner-toast][data-type="success"]')
        ).toBeVisible({ timeout: 5_000 });
      },
      async expectErrorToast() {
        await expect(
          page.locator('[data-sonner-toast][data-type="error"]')
        ).toBeVisible({ timeout: 5_000 });
      },
    });
    await use(extended);
  },
});

export { expect };
