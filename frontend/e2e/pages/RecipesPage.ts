import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class RecipesPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly addRecipeButton: Locator;
  readonly nextPageButton: Locator;
  readonly prevPageButton: Locator;
  readonly recipeRows: Locator;
  readonly managementTab: Locator;
  readonly categoryTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[placeholder*="earch"]').first();
    this.addRecipeButton = page.locator('button').filter({ hasText: /add recipe/i });
    this.nextPageButton = page.locator('button').filter({ hasText: /next/i });
    this.prevPageButton = page.locator('button').filter({ hasText: /prev/i });
    // Recipe rows or cards — adapt selector to actual implementation
    this.recipeRows = page.locator('[data-testid="recipe-row"], tr[data-recipe-id], [class*="recipe-card"]');
    this.managementTab = page.locator('[role="tab"]').filter({ hasText: /recipe management/i });
    this.categoryTab = page.locator('[role="tab"]').filter({ hasText: /category/i });
  }

  async goto() {
    await this.page.goto('/recipes');
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async waitForResults() {
    // Wait for loading to settle (debounce + API)
    await this.page.waitForTimeout(500);
  }
}
