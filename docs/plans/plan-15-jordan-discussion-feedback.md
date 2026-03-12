# Plan 15 — Jordan Discussion Feedback

## Source
Notion discussion: https://www.notion.so/Discussion-320ca9b8c2ee80f48af3f774b76b5a26

---

## Recipes

### Change 1: Inline Category Creation in Overview Tab

**Issue:** When selecting recipe categories in the Overview tab, if the desired category doesn't exist, the user must navigate away to create it.

**Fix:** Mirror the ingredient-add UX — allow users to type a new category name and create it inline from within the category picker dropdown.

**File:** `frontend/src/components/layout/tabs/OverviewTab.tsx`

- In the category dropdown/search input, if no matching category exists, show a **"+ Create '[query]'"** option at the bottom of the list
- On click, call `useCreateRecipeCategory()` (mutate), then immediately link the new category to the recipe via `useAddRecipeToCategory()`
- Optimistically add the badge; show error toast on failure

---

### Change 2: Category-Aware Recipe Search

**Issue:** Searching for a category name (e.g. "breakfast") in the recipe management search box returns no results, even when recipes are tagged with a "breakfast recipes" category.

**Fix:** Extend the recipe search to include matches on associated category names.

**File:** `frontend/src/app/recipes/page.tsx` (or `frontend/src/components/recipes/RecipeManagementTab.tsx`)

- When filtering the recipe list client-side, also match against each recipe's associated category names (the `categories` field returned from the API)
- If category data isn't yet included in the recipe list response, either:
  - Option A: fetch recipe-category links in bulk and join client-side, or
  - Option B: extend the backend `GET /recipes` response to include a `category_names: string[]` summary field

---

### Change 3: Remove Centilitre (cl) and Decilitre (dl) Measurements

**Issue:** `cl` and `dl` units add clutter. Nobody uses them in practice.

**Fix:** Remove from all unit dropdown lists in the frontend.

**Files to check:**
- `frontend/src/lib/unitConversion.ts` — remove `cl` and `dl` entries from `VOLUME_CONVERSIONS`
- Any unit `<select>` or `UNIT_OPTIONS` constant in `CanvasTab.tsx`, `RecipeIngredientRow.tsx`, or shared unit helpers
- Backend `app/utils/unit_conversion.py` — remove `cl` and `dl` from volume map to keep in sync

---

## Tasting

### Change 4: Fix Drag-and-Drop Image Upload

**Issue:** Drag-and-drop image upload for tasting note feedback is broken (see Loom: https://www.loom.com/share/bf674f78afd94c47a64fc28fe10f1e47).

**Fix:** Debug and restore drag-and-drop functionality in `ImageUploadPreview`.

**File:** `frontend/src/components/tasting/ImageUploadPreview.tsx`

- Review the `onDragOver`, `onDrop`, and `onDragLeave` event handlers
- Ensure `e.preventDefault()` is called in `onDragOver` to allow drop
- Confirm `e.dataTransfer.files` is read correctly in `onDrop` and handed off to the existing upload pipeline (base64 encoding → Supabase upload)
- Re-test with the Loom scenario: drag file from desktop → drop on upload zone → image appears in preview

---

## Menus

### Change 5: Allow Draft Recipes in Menu Creation

**Issue:** Only active recipes can be added to menus. Chefs building draft/preview menus need to include draft recipes.

**Note from JN:** Could not replicate — may be a non-issue. Investigate before implementing.

**If confirmed:** `frontend/src/components/menu/MenuBuilder.tsx` (or wherever recipes are filtered for the menu item picker)
- Remove or relax the `status === 'active'` filter when listing recipes available to add as menu items

---

### Change 6: Searchable Recipes in Menu Builder (Search-as-you-type + Category Filter)

**Issue:** All recipes are shown as a flat list. With many recipes this becomes unmanageable.

**Fix:** Add search-as-you-type and category filter to the recipe picker inside Menu Builder.

**File:** `frontend/src/components/menu/MenuBuilder.tsx`

- Add a text input above the recipe list: filter by recipe name as user types
- Add a category filter dropdown: selecting a category filters the list to only recipes tagged with it
- Add multi-select support: allow checking multiple recipes at once before adding them to the menu section, so chefs can batch-add and then reorder

---

### Change 7: Add Descriptions to Menu View

**Issue:** Recipe descriptions are absent from the menu view. These are important for training purposes.

**Fix:** Render `recipe.description` below the recipe name in both list and card views of the menu.

**Files:** Menu view/preview component (e.g. `frontend/src/app/menus/[id]/page.tsx` or similar)
- In list view row: add a second line or paragraph for `description`
- In card view: add `description` text below the recipe title

---

### Change 8: Add Key Highlights, Additional Info, and Allergen Info to Menu List View

**Issue:** The `key_highlights` and `additional_info` fields added to menu items are not visible in list view. Allergen information is also missing.

**Fix:** Surface all metadata fields in list view.

**File:** Menu list view component

- Show `key_highlights` (e.g. "Signature dish", "Seasonal") as a highlighted label or badge row beneath the recipe name
- Show `additional_info` (e.g. "Contains nuts", "Preparation notes") as a secondary text block
- Derive and display allergen info from the recipe's ingredient allergen data (already tracked on `Ingredient.allergen`)
  - Option A: backend computes aggregated allergens for a recipe (via BOM traversal) and includes in recipe/menu response
  - Option B: frontend reads `recipe.ingredients[].allergen` and deduplicates for display

---

### Change 9: Fix Card View Image Aspect Ratio + Add Allergen Info

**Issue:** In card view, images are too wide and don't expand. Allergen info is also absent.

**Fix:**
- Adjust image container: change from full-width to a constrained aspect ratio (e.g. `aspect-[4/3]` or `aspect-square`) with `object-cover` so more of the image is visible
- Add an allergen badge section to card view (same derivation as Change 8)

**File:** Menu card view component

---

### Change 10: Allow Recipe Editing from Menu Preview Page

**Issue:** Recipes cannot be edited from the menu view/preview page.

**Fix:** Add an edit affordance for managers/admins that redirects to the recipe detail page.

**File:** Menu view/preview component

- If current user is admin or manager: show a small **"Edit Recipe →"** link/icon on each menu item that navigates to `/recipes/[recipeId]`
- JN's note: consider whether the edit view in menu builder can be dropped entirely if in-place redirect to recipe page covers the use case

---

## Files Summary

| Area | File(s) | Change |
|------|---------|--------|
| Recipes | `OverviewTab.tsx` | Inline category creation |
| Recipes | `recipes/page.tsx` or `RecipeManagementTab.tsx` | Category-aware search |
| Recipes | `unitConversion.ts`, `CanvasTab.tsx`, `unit_conversion.py` | Remove cl/dl |
| Tasting | `ImageUploadPreview.tsx` | Fix drag-and-drop upload |
| Menus | `MenuBuilder.tsx` | Draft recipes + searchable picker + multi-select |
| Menus | Menu view/preview component | Descriptions, key_highlights, additional_info |
| Menus | Menu view/preview component | Allergen info (list + card) |
| Menus | Menu card component | Fix image aspect ratio |
| Menus | Menu view/preview component | Edit recipe redirect for admins |

---

## Verification

1. `cd frontend && npm run lint && npm run build` — no errors
2. Manual tests:
   - Overview tab → category picker → type a new category name → verify "+ Create" option appears → create → badge appears immediately
   - Recipe list → search "breakfast" → verify recipes tagged "breakfast recipes" appear
   - Canvas tab → ingredient unit dropdown → verify cl and dl are absent from volume options
   - Tasting note → drag image file onto upload zone → verify image preview appears
   - Menu builder → recipe picker → type recipe name → verify list filters in real time
   - Menu builder → category filter → select category → verify only matching recipes shown
   - Menu view (list) → verify description, key_highlights, additional_info, and allergens visible per item
   - Menu view (card) → verify image fits within frame without excessive cropping, allergens shown
   - Menu view → logged in as admin → verify "Edit Recipe →" link present per item
3. `cd backend && pytest` — no regressions
