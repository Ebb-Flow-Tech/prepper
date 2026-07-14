# Plan 24: Ingredient Search Improvements & FMH Import Updates

## Context

Two improvements based on user feedback (source: Notion – 14 Apr 2026):

1. **Ingredient search** (both Ingredients page and Recipe Builder) should match by supplier name and category name in addition to ingredient name, and results should be sorted alphabetically by default. The Ingredients page should also surface matching **categories** directly in the search results.
2. **FMH import** should update existing ingredient records when re-imported, rather than silently skipping them.

---

## Feature 1: Ingredient Search Enhancement

### Current behaviour

- Backend `_build_list_query` (line ~89) only does `Ingredient.name.ilike(f"%{search}%")`.
- Results ordered by `Ingredient.id.desc()` (newest first).
- The Ingredients page "Ingredients" tab shows only ingredient rows when searching, never categories.

### Goal

- Search term matches any of: ingredient name, category name, supplier name.
- Default sort is alphabetical by ingredient name (A → Z).
- On the `/ingredients` page → Ingredients tab: when a search term is active, also show a "Matching Tags" section above the ingredient list displaying category cards that match the term.
- In the Recipe Builder (RightPanel): ingredient results only (no category cards), but expanded search still applies.

---

### Backend Changes

#### `backend/app/domain/ingredient_service.py`

**1. Expand `_build_list_query` search block**

Replace (line ~89–90):

```python
if search:
    statement = statement.where(Ingredient.name.ilike(f"%{search}%"))
```

with:

```python
if search:
    from sqlalchemy import or_
    from app.models.category import Category
    from app.models.supplier_ingredient import SupplierIngredient
    from app.models.supplier import Supplier

    term = f"%{search}%"

    cat_subq = (
        select(Ingredient.id)
        .join(Category, Ingredient.category_id == Category.id)
        .where(Category.name.ilike(term))
    ).scalar_subquery()

    sup_subq = (
        select(SupplierIngredient.ingredient_id)
        .join(Supplier, SupplierIngredient.supplier_id == Supplier.id)
        .where(Supplier.name.ilike(term))
    ).scalar_subquery()

    statement = statement.where(
        or_(
            Ingredient.name.ilike(term),
            Ingredient.id.in_(cat_subq),
            Ingredient.id.in_(sup_subq),
        )
    )
```

**2. Default alphabetical sort**

In both `list_paginated` (line ~109) and `list_paginated_with_count` (line ~128), change:

```python
.order_by(Ingredient.id.desc())
```

to:

```python
.order_by(Ingredient.name.asc())
```

---

### Frontend Changes

#### `/ingredients` page — `IngredientsListTab` (`frontend/src/app/ingredients/page.tsx`)

When `debouncedSearch` is non-empty, fire an additional `useCategories` (or `useCategoriesPaginated`) query with `{ search: debouncedSearch, page_size: 10 }` to fetch matching categories.

Render a collapsible **"Matching Tags"** section above the ingredient results, using the existing `CategoryCard` or `CategoryListRow` component:

```tsx
{debouncedSearch && matchingCategories.length > 0 && (
  <GroupSection title={`Tags matching "${debouncedSearch}"`}>
    <div className="flex flex-wrap gap-2">
      {matchingCategories.map(cat => (
        <CategoryListRow key={cat.id} category={cat} />
      ))}
    </div>
  </GroupSection>
)}
```

The `CategoryListRow` component already exists at `frontend/src/components/categories/CategoryListRow.tsx`. Clicking a category navigates to its detail page or applies it as a filter.

No changes needed to the Recipe Builder (RightPanel) — the expanded backend search already handles supplier/category name matching there.

---

## Feature 2: FMH Import — Update Existing Records

### Current behaviour

`import_ingredients` in `backend/app/domain/fmh_import_service.py`:
- **Ingredients** (line ~333–336): skips an ingredient if `name` already exists in DB.
- **SupplierIngredients** (line ~367): skips a SupplierIngredient if `sku` already in `si_by_sku`.

When FMH updates a product's price, pack size, or category and the file is re-imported, no changes are persisted.

### Goal

Re-importing an FMH file **updates** mutable fields on existing records instead of skipping them.

---

### Backend Changes

#### `backend/app/domain/fmh_import_service.py`

**1. Add update counters to `FMHImportResult`**

```python
class FMHImportResult(SQLModel):
    suppliers_created: int = 0
    suppliers_updated: int = 0
    outlets_created: int = 0
    categories_created: int = 0
    ingredients_created: int = 0
    ingredients_updated: int = 0           # NEW
    supplier_ingredients_created: int = 0
    supplier_ingredients_updated: int = 0  # NEW
    outlet_supplier_ingredients_created: int = 0
    warnings: list[str] = []
```

**2. Step 7 — Update existing ingredients**

Replace the ingredient upsert loop so that when `name in existing_ing_by_name`, the record is updated:

```python
for product_code, shape in ingredient_shapes.items():
    name = shape["name"]
    category_id = category_by_tag[shape["tag"]].id if shape["tag"] in category_by_tag else None
    if name in existing_ing_by_name:
        ing = existing_ing_by_name[name]
        # Overwrite mutable FMH-owned fields
        ing.base_unit = shape["base_unit"]
        if shape["cost_per_base_unit"] is not None:
            ing.cost_per_base_unit = shape["cost_per_base_unit"]
        if category_id is not None:
            ing.category_id = category_id
        session.add(ing)
        result.ingredients_updated += 1
        ingredient_by_product_code[product_code] = ing
    elif name not in new_ings_by_name:
        new_ings_by_name[name] = Ingredient(
            name=name,
            base_unit=shape["base_unit"],
            cost_per_base_unit=shape["cost_per_base_unit"],
            category_id=category_id,
            source=shape["source"],
            is_active=True,
        )
```

**3. Step 8 — Update existing SupplierIngredients**

Replace the `if product_code in si_by_sku: continue` guard:

```python
for product_code, shape in si_shapes.items():
    if product_code in si_by_sku:
        si = si_by_sku[product_code]
        si.pack_size = shape["pack_size"]
        si.pack_unit = shape["pack_unit"]
        si.price_per_pack = shape["price_per_pack"]
        session.add(si)
        result.supplier_ingredients_updated += 1
        continue  # still skip to next; outlet links handled below
    # ... existing create path unchanged
```

The `OutletSupplierIngredient` links are additive only (already skipped if pair exists), so no changes needed there.

---

### Frontend Changes

#### `frontend/src/types/index.ts`

Add the two new fields to `FMHImportResult`:

```typescript
export interface FMHImportResult {
  suppliers_created: number
  suppliers_updated: number
  outlets_created: number
  categories_created: number
  ingredients_created: number
  ingredients_updated: number           // NEW
  supplier_ingredients_created: number
  supplier_ingredients_updated: number  // NEW
  outlet_supplier_ingredients_created: number
  warnings: string[]
}
```

#### `frontend/src/components/ingredients/FMHIngredientImportModal.tsx`

Update the result summary section to display updated counts alongside created counts when non-zero:

```tsx
{result.ingredients_updated > 0 && (
  <p>{result.ingredients_updated} ingredient(s) updated</p>
)}
{result.supplier_ingredients_updated > 0 && (
  <p>{result.supplier_ingredients_updated} pricing record(s) updated</p>
)}
```

---

## Critical Files

| File | Change |
|------|--------|
| `backend/app/domain/ingredient_service.py` | Expand search to OR across category + supplier name; change sort to `name ASC` |
| `backend/app/domain/fmh_import_service.py` | Update existing ingredients and supplier-ingredients on re-import; add `_updated` counters |
| `frontend/src/app/ingredients/page.tsx` | Show "Matching Tags" section in Ingredients tab when search term is active |
| `frontend/src/types/index.ts` | Add `ingredients_updated`, `supplier_ingredients_updated` to `FMHImportResult` |
| `frontend/src/components/ingredients/FMHIngredientImportModal.tsx` | Display updated counts in result summary |

---

## Verification

**Search:**
1. Search "Supplier A" on `/ingredients` page → ingredients from that supplier appear; category hits for "Supplier A" shown if any.
2. Search "Wine" on `/ingredients` page → matching tag "Wine" appears in "Matching Tags" section; wine-category ingredients listed below.
3. Search by ingredient name still returns direct matches.
4. Results returned in alphabetical order (A → Z) by default.
5. Same expanded search in Recipe Builder (RightPanel) — no category cards, but supplier/category-matched ingredients appear.

**FMH Import:**
1. Import a product file; note an ingredient's `cost_per_base_unit`.
2. Modify the price in the file; re-import.
3. The ingredient's `cost_per_base_unit` is updated in DB; `ingredients_updated` counter reflects the change.
4. SupplierIngredient `price_per_pack` also updates on re-import.
5. Newly added rows still create fresh records (`ingredients_created` counter).
6. Modal displays both created and updated counts after import.

**Build:**
- `npm run build` — no type errors.
- `pytest backend/tests/test_fmh_import.py` — all tests pass including new update scenarios.
