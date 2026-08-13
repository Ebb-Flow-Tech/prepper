import type { Page, Locator } from '@playwright/test';

/**
 * The login form is a two-step router: one email field, then — only for an address the backend
 * routes `app-native` — the password field appears IN PLACE on the same screen. A Passport member
 * never reaches step 2; the browser leaves for Passport's hosted login instead.
 *
 * The e2e suite runs with SSO off (see `global.setup.ts`), so every address routes `app-native`
 * and step 2 always renders.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  /** Both steps submit through the form's own button; only one is on screen at a time. */
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly googleButton: Locator;
  readonly useDifferentEmailButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.bg-red-50, [class*="bg-red"]').first();
    this.googleButton = page.locator('button', { hasText: /sign in with google/i });
    this.useDifferentEmailButton = page.locator('button', { hasText: /use a different email/i });
  }

  async goto() {
    await this.page.goto('/login');
  }

  /** Step 1. Resolves once the password field has rendered in place. */
  async continueWithEmail(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
    await this.passwordInput.waitFor({ state: 'visible' });
  }

  async login(email: string, password: string) {
    await this.continueWithEmail(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async submitEmpty() {
    await this.submitButton.click();
  }
}
