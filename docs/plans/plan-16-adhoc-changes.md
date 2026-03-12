# Plan 16 — Ad Hoc Changes

## Source
Notion page: https://www.notion.so/Ad-hoc-changes-321ca9b8c2ee80ab9236f626846ca82c

---

## Change 1: Add Litre/Millilitre Units to Ingredient Card

**Issue:** Volume units (litres, millilitres) are not available in the ingredient unit selector, limiting usability for liquid ingredients.

**Fix:** Add `l` (litre) and `ml` (millilitre) to the ingredient unit options. For costing calculations, assume density = 1 g/ml so 1 ml = 1 g and 1 l = 1 kg.

**Files:**
- `backend/app/utils/unit_conversion.py` — ensure `l` and `ml` are in the volume/weight conversion map with density-1 equivalences
- `frontend/src/lib/` — wherever `UNIT_OPTIONS` or unit dropdown constants are defined, add `l` and `ml` if not present
- `frontend/src/components/ingredients/` — verify the unit selector in ingredient detail/card renders `l` and `ml`

**Notes:**
- Treat density as 1 (1 ml = 1 g, 1 l = 1000 g) for calculation purposes
- No DB schema changes needed — units are stored as strings

---

## Change 2: Ingredient Detail Page (`/ingredients/[id]`) — Editing Clarity

**Issue:** The top section of the ingredient overview does not make it obvious that fields are editable.

**Fix:** Add clear visual edit indicators (e.g. pencil icon, edit-state highlight border, or explicit edit mode toggle) to the top overview section on the ingredient detail page.

**File:** `frontend/src/app/ingredients/[id]/page.tsx` and relevant sub-components

- Fields in the top card should show a visible edit affordance (focus ring, hover underline, or edit icon alongside each field)
- Follow whatever edit-indicator pattern is used in `/recipes/[id]`

---

## Change 3: Ingredient Detail Page — Remove Image Section

**Issue:** The image section appears on the ingredient detail page but is not used.

**Fix:** Remove the image upload/display section from `/ingredients/[id]`.

**File:** `frontend/src/app/ingredients/[id]/page.tsx`

- Delete or hide the image component/block entirely
- No backend changes needed

---

## Change 4: Recipe Detail Page (`/recipes/[id]`) — Editing Clarity

**Issue:** The top section of the recipe canvas overview does not make it obvious that fields are editable.

**Fix:** Add clear visual edit indicators to the top part of the recipe overview (same treatment as Change 2 for ingredients).

**File:** `frontend/src/app/recipes/[id]/page.tsx` and `frontend/src/components/layout/tabs/OverviewTab.tsx`

- Mirror the same edit-affordance pattern applied to the ingredient page
- Editable fields (name, description, etc.) should show a visible hover/focus state or inline edit icon

---

## Change 5: Ingredients Page (`/ingredients`) — Ingredient Tab

### 5a: Remove Image Icon
**Issue:** Each ingredient card/row shows an image icon, but images are not used for ingredients.

**Fix:** Remove the image icon from ingredient cards and list rows.

**Files:** `frontend/src/components/ingredients/IngredientCard.tsx`, `frontend/src/components/ingredients/IngredientListRow.tsx`

### 5b: Category Tags Pagination ("See More")
**Issue:** All ingredient category filter tags are shown at once; with many categories this becomes overwhelming.

**Fix:** Show a limited number of category tags (e.g. first 8–10) with a "See more" button that expands the full list.

**File:** `frontend/src/components/ingredients/FilterButtons.tsx` (or wherever category filter chips are rendered on the ingredients page)

- Default: render first N tags
- "See more" toggles showing all tags
- "See less" collapses back

---

## Change 6: Ingredients Page — Categories Tab

**Issue:** No pagination on the categories tab; all categories are listed at once.

**Fix:** Add pagination (e.g. "Show more" / page numbers) to the categories tab on `/ingredients`.

**File:** `frontend/src/app/ingredients/page.tsx` or the `CategoriesTab` component

---

## Change 7: Recipes Page (`/recipes`) — Recipe Category Tags Pagination

**Issue:** Recipe category filter tags on the recipe management tab may not have pagination.

**Fix:** Check and add "See more" pagination for recipe category filter tags, matching the ingredient category pattern from Change 5b.

**Files:** `frontend/src/components/recipes/RecipeCategoryFilterButtons.tsx` (or equivalent)

---

## Change 8: Recipes Page — Category Tab

**Issue:** No pagination on the recipe category tab.

**Fix:** Check and add pagination if missing; keep consistent with ingredient categories approach.

---

## Change 9: Suppliers Page — Show Shipping Company Name

**Issue:** The shipping company name is not visible in card or row views on `/suppliers`.

**Fix:** Display the shipping company name in both card view (`SupplierCard`) and row view (`SupplierListRow`) on the suppliers listing page.

**Files:**
- `frontend/src/components/suppliers/SupplierListRow.tsx`
- Any `SupplierCard` component or inline card rendering in `frontend/src/app/suppliers/page.tsx`

**Note:** Verify the `Supplier` type includes a `shipping_company` (or equivalent) field; if not, check what the backend returns and align the type.

---

## Change 10: MenuBuilder — Collapsible Outlets Selection

**Issue:** The outlets selection in the MenuBuilder is always expanded.

**Fix:** Make the outlets section collapsible. Selected options must be preserved regardless of expand/collapse state.

**File:** `frontend/src/components/menu/MenuBuilder.tsx`

- Wrap the outlets selector in a collapsible/accordion component
- State (selected outlets) lives outside the collapsible so it is not reset on toggle
- Default state: collapsed or expanded (confirm with design preference; use expanded as default if unsure)

---

## Change 11: MenuBuilder — Collapsible Key Highlights, Additional Info, Substitution

**Issue:** In card view, "Key Highlights", "Additional Info", and "Substitution" fields are always expanded and take up space.

**Fix:** Make these three sections collapsible in the card view. Default state = expanded. Content must not change or reset when toggling collapse/expand.

**File:** `frontend/src/components/menu/MenuBuilder.tsx`

- Wrap each of the three sections (`key_highlights`, `additional_info`, substitution) in individual collapsible blocks with a toggle header
- State (field values) must be controlled outside the collapsible so values are preserved on toggle
- Default: expanded

---

## Summary of Files to Touch

| File | Changes |
|------|---------|
| `backend/app/utils/unit_conversion.py` | Add l/ml volume↔weight conversions (density=1) |
| `frontend/src/lib/` (unit constants) | Add `l`, `ml` to unit options |
| `frontend/src/app/ingredients/[id]/page.tsx` | Editing indicators + remove image section |
| `frontend/src/app/recipes/[id]/page.tsx` / `OverviewTab.tsx` | Editing indicators |
| `frontend/src/components/ingredients/IngredientCard.tsx` | Remove image icon |
| `frontend/src/components/ingredients/IngredientListRow.tsx` | Remove image icon |
| `frontend/src/components/ingredients/FilterButtons.tsx` | "See more" pagination for category tags |
| `frontend/src/app/ingredients/page.tsx` (Categories tab) | Add pagination |
| `frontend/src/components/recipes/RecipeCategoryFilterButtons.tsx` | "See more" pagination |
| `frontend/src/app/recipes/page.tsx` (Category tab) | Add pagination if missing |
| `frontend/src/components/suppliers/SupplierListRow.tsx` | Show shipping company name |
| Supplier card component | Show shipping company name |
| `frontend/src/components/menu/MenuBuilder.tsx` | Collapsible outlets, key highlights, additional info, substitution |
