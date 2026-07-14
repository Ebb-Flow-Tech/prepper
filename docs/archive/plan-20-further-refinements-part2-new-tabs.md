# Plan 20 Part 2: New Content Tabs

## Goal

Implement two new content areas introduced as tab stubs in Part 1:

1. **Products tab** on `/ingredients` — paginated table of supplier ingredients
2. **Users tab** on `/settings` — individual user profile view for the logged-in user

No new database tables or migrations are introduced in this part.

---

## 1. Products Tab on `/ingredients`

### Data source

Products are sourced from the existing `supplier_ingredients` table joined with `ingredients` and `suppliers`. The existing API endpoint `GET /api/v1/suppliers/{id}/ingredients` returns data per supplier; a new backend endpoint is needed to list all supplier ingredients in one call.

### 1a. New backend endpoint ✅

**File:** `backend/app/api/supplier_ingredients.py`

```
GET /api/v1/supplier-ingredients
```

Query params: `page_number` (int, default 1), `page_size` (int, default 20), `search` (optional string — matched against product/ingredient name or SKU).

Response shape (list + pagination metadata):
```json
{
  "items": [
    {
      "id": 1,
      "ingredient_id": 5,
      "ingredient_name": "Tomato",
      "category_name": "Vegetables",
      "sku": "TOM-001",
      "supplier_id": 3,
      "supplier_name": "FreshCo",
      "unit": "kg",
      "price_per_pack": 12.50
    }
  ],
  "total_count": 42,
  "page_number": 1,
  "page_size": 20,
  "total_pages": 3,
  "current_page_size": 20
}
```

Router mounted at `/api/v1/supplier-ingredients` in `main.py`.

### 1b. Frontend API helper ✅

**File:** `frontend/src/lib/api.ts`

```ts
export async function getSupplierIngredientsPaginated(params: {
  page_number?: number;
  page_size?: number;
  search?: string;
}): Promise<PaginatedResponse<SupplierIngredientItem>>
```

### 1c. TanStack Query hook ✅

**File:** `frontend/src/lib/hooks/useSupplierIngredients.ts`

```ts
export function useSupplierIngredientsPaginated(params: {
  page_number: number;
  page_size: number;
  search: string;
})
```

Exported from `frontend/src/lib/hooks/index.ts`.

### 1d. ProductsTab component ✅

**File:** `frontend/src/components/ingredients/ProductsTab.tsx`

A paginated table with the following columns:

| Column | Source | Behaviour |
|--------|--------|-----------|
| Product Name | `ingredient_name` | Clickable → `/ingredients/[ingredient_id]` |
| Category | `category_name` | Static label |
| SKU | `sku` | Static label |
| Supplier | `supplier_name` | Clickable → `/suppliers/[supplier_id]` |
| Unit | `unit` | Static label |
| Price / Pack | `price_per_pack` | Formatted as SGD currency |

- Uses the existing `<Pagination>` component for page controls
- Uses existing `<SearchInput>` for filtering
- Uses existing `<Skeleton>` for loading state
- Tags column is **omitted** (added in Part 3)

### 1e. Wire into ingredients page ✅

**File:** `frontend/src/app/ingredients/page.tsx`

- `{ id: 'products', label: 'Products' }` is the first entry in `INGREDIENT_TABS`
- Default tab is `'products'` (set in `frontend/src/lib/store.tsx`)
- When tab is `products`, renders `<ProductsTab />`

---

## 2. Users Tab on `/settings`

### Intent

The `'users'` tab on `/settings` is the **current user's own profile view** — not an all-users list. It shows the logged-in user's account information and assigned outlet.

### 2a. UserProfileTab component ✅

**File:** `frontend/src/components/settings/UserProfileTab.tsx`

Displays for the current logged-in user:

| Field | Source |
|-------|--------|
| Username | `username` from app state |
| Email Address | `email` from app state |
| Role | `user_type` displayed with colour dot (`Administrator` / `Normal`) |
| Managerial Status | `isManager` boolean |
| Assigned Outlet | outlet name, code, and parent outlet (fetched via `useOutlet`) |

- Read-only display
- Uses `<Skeleton>` for loading state
- Shows "Last updated" timestamp relative to now

### 2b. Wire into settings page ✅

**File:** `frontend/src/app/settings/page.tsx`

The `'users'` tab renders `<UserProfileTab />`. Admin user management is handled separately under the `'admin'` tab via `<UserManagementTab />`.

---

## Verification

1. Products tab renders a paginated table; search filters results; clicking Product Name navigates to the ingredient detail page; clicking Supplier navigates to the supplier detail page. ✅
2. Users tab shows the current user's profile information and assigned outlet. ✅
3. Both tabs respect loading and empty states. ✅
4. `npm run build` and `npm run lint` pass with no errors. ✅
