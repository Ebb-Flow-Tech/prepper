/**
 * Pagination helpers for tests.
 *
 * The Pagination component uses ChevronLeft/Right SVG icon buttons (no text).
 * It renders null when totalPages <= 1.
 *
 * The component HTML structure:
 *   <div class="flex items-center justify-between border-t ... px-2 py-3 text-sm">
 *     <span>1–30 of 45</span>
 *     <div class="flex items-center gap-1">
 *       <button><ChevronLeft /></button>   ← prev
 *       <span class="px-2">1 / 2</span>   ← page indicator
 *       <button><ChevronRight /></button>  ← next
 *     </div>
 *   </div>
 */
import type { Page, Locator } from '@playwright/test';

export interface PaginationLocators {
  container: Locator;
  pageIndicator: Locator;
  prevBtn: Locator;
  nextBtn: Locator;
}

export function getPagination(page: Page): PaginationLocators {
  // The page indicator "X / Y" uniquely identifies the pagination container
  const pageIndicator = page.locator('span.px-2').filter({ hasText: /^\d+ \/ \d+$/ }).first();
  // Parent div of the indicator contains both buttons
  const buttonGroup = page.locator('.flex.items-center.gap-1').filter({ has: pageIndicator });
  const container = page.locator('.border-t').filter({ has: pageIndicator }).first();

  return {
    container,
    pageIndicator,
    prevBtn: buttonGroup.locator('button').first(),
    nextBtn: buttonGroup.locator('button').last(),
  };
}

/** Returns true if pagination is currently visible on the page */
export async function hasPagination(page: Page): Promise<boolean> {
  const { pageIndicator } = getPagination(page);
  return pageIndicator.isVisible().catch(() => false);
}
