# Plan 10: Performance & Build Optimisation

**Status**: Complete
**Priority**: High
**Dependencies**: None (no functional changes)
**Owner**: Engineering

---

## Overview

This plan identifies performance and build optimisations across the Prepper application. All changes are non-functional — core business logic, features, and user-facing behaviour remain untouched. The focus is on reducing bundle size, eliminating redundant database queries, improving caching, and hardening production configuration.

---

## Goal

1. Reduce frontend bundle size and improve load times
2. Eliminate N+1 queries and add missing database indexes
3. Add pagination to unbounded list endpoints
4. Improve production readiness (connection pooling, CORS, caching)

---

## Common Areas of Optimisation & Their Impacts

| Area | What It Addresses | Typical Impact |
|------|-------------------|----------------|
| **Bundle Size Reduction** | Large JS payloads slow initial page load. Tree-shaking, code-splitting, and selective imports reduce bytes sent to browser. | 15-30% smaller JS bundles, faster FCP/LCP |
| **N+1 Query Elimination** | Loop-based DB queries (1 per item) cause linear query growth. Batch queries collapse N+1 into 1-2 queries. | 50-100x fewer DB round-trips on list pages |
| **Database Indexing** | Missing indexes on filtered/joined columns force full table scans. Adding indexes enables O(log n) lookups. | 10-100x faster queries on large tables |
| **Pagination** | Unbounded list endpoints return all rows, wasting bandwidth and memory. Pagination caps response size. | Prevents timeouts and OOM on large datasets |
| **Connection Pooling** | Default pool sizes (5) are insufficient under concurrent load. Tuning pool parameters prevents connection exhaustion. | Prevents connection starvation under load |
| **Response Caching** | Expensive computations (costing, version trees) are recalculated on every request. Caching avoids redundant work. | 80-95% reduction in compute for repeat requests |
| **Image Optimisation** | Raw `<img>` tags skip format conversion and responsive sizing. Next.js `<Image>` auto-serves WebP/AVIF at correct dimensions. | 30-40% bandwidth reduction on image-heavy pages |
| **CSS Deduplication** | Duplicate variable definitions and unused styles increase CSS parse time. Consolidation reduces file size. | ~150-200 lines removed, marginal parse improvement |
| **React Memoisation** | Missing `React.memo()` and unstable references cause unnecessary re-renders. Memoisation skips renders when props are unchanged. | 20-30% fewer re-renders on complex list views |
| **Over-Fetching Reduction** | List endpoints returning full objects (including large text fields) waste bandwidth. Lean DTOs return only needed fields. | 50-70% smaller list payloads |

---

## Frontend Optimisations

### F1. Tree-Shake Hook Barrel Exports [HIGH]

**File:** `frontend/src/lib/hooks/index.ts`

**Problem:** Wildcard re-exports (`export * from './useRecipes'`) prevent bundler tree-shaking. Every page importing from `@/lib/hooks` loads ALL hook code.

**Fix:** Use `optimizePackageImports` in Next.js config (zero code changes needed):
```ts
// next.config.ts
experimental: {
  optimizePackageImports: ['@/lib/hooks', 'lucide-react', '@tanstack/react-query'],
}
```

**Impact:** 15-25% reduction in per-page JS bundles.

---

### F2. Next.js Image Optimisation [HIGH]

**Files:** Components using raw `<img>` tags (e.g. `RecipeImageCarousel.tsx`, various card components)

**Problem:** Raw `<img>` tags skip Next.js image pipeline — no WebP/AVIF conversion, no responsive srcset, no lazy loading.

**Fix:**
1. Replace `<img>` with `<Image>` from `next/image` where Supabase URLs are used
2. Add image config to `next.config.ts`:
```ts
images: {
  remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
}
```

**Impact:** 30-40% bandwidth reduction on image-heavy pages.

---

### F3. Next.js Build Config Hardening [MEDIUM]

**File:** `frontend/next.config.ts`

**Problem:** Minimal config missing production optimisations.

**Fix:** Add:
```ts
const nextConfig: NextConfig = {
  images: { /* ... from F2 */ },
  experimental: {
    optimizePackageImports: ['@/lib/hooks', 'lucide-react', '@tanstack/react-query'],
  },
  compress: true,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    }];
  },
};
```

**Impact:** Smaller production bundles, immutable cache headers for static assets.

---

### F4. TanStack Query Stale Time Tuning [MEDIUM]

**File:** `frontend/src/lib/providers.tsx`

**Problem:** Global `staleTime: 5 min` is one-size-fits-all. Stable data (outlets, categories) refetches too often; volatile data (costing) may be too stale.

**Fix:** Override `staleTime` per query type:
| Query | Recommended staleTime |
|-------|----------------------|
| Outlets, Categories | 30 min |
| Recipes, Ingredients | 10 min |
| Costing | 1 min |
| Tasting Sessions | 5 min (keep default) |

**Impact:** Fewer unnecessary refetches, reduced API load.

---

### F5. Image Upload Memory Management [MEDIUM]

**File:** `frontend/src/components/tasting/ImageUploadPreview.tsx`

**Problem:** Batch file-to-base64 conversion loads all images into memory simultaneously. Large batches can cause browser OOM.

**Fix:**
1. Add file size validation before conversion (e.g. max 5MB per file)
2. Process files sequentially instead of all at once
3. Add client-side compression via Canvas API before base64 encoding

**Impact:** Prevents OOM on batch uploads, reduces upload payload size.

---

### F6. CSS Deduplication [LOW]

**File:** `frontend/src/app/globals.css`

**Problem:** Dark mode variables (lines ~599-673) are duplicated from earlier definitions. ~150 lines of redundant CSS.

**Fix:** Consolidate dark mode overrides to only include values that differ from light mode defaults.

**Impact:** ~150 lines removed. Marginal parse time improvement.

---

### F7. React Memoisation for Heavy Components [LOW]

**Files:** `RecipeManagementTab.tsx`, `MenuBuilder.tsx`

**Problem:** Large components with multiple `useMemo()` blocks re-render when parent updates, even if their own props are unchanged.

**Fix:**
1. Wrap with `React.memo()`
2. Stabilise callback references with proper `useCallback` dependency arrays
3. Extract inline objects passed to hooks (e.g. `useDroppable` config) into `useMemo`

**Impact:** 20-30% fewer re-renders on recipe list and menu builder views.

---

## Backend Optimisations

### B1. Eliminate N+1 Queries in Menu Endpoints [CRITICAL]

**File:** `backend/app/api/menus.py` (lines ~92, 165, 579)

**Problem:** Inside nested loops, each menu item triggers an individual `session.get(Recipe, item.recipe_id)` call. A menu with 50 items produces 50+ individual queries.

**Fix:** Batch-fetch all recipes before the loop:
```python
recipe_ids = [item.recipe_id for section in sections for item in section.items]
recipes = {r.id: r for r in session.exec(
    select(Recipe).where(Recipe.id.in_(recipe_ids))
).all()}
```

**Impact:** 50+ queries reduced to 1. Massive latency improvement on menu detail endpoints.

---

### B2. Add Missing Database Indexes [HIGH]

**Files:** `backend/app/models/recipe.py`, `backend/app/models/outlet.py`

**Problem:** Frequently filtered columns lack indexes:
- `Recipe.owner_id` — used in access control filtering
- `Recipe.root_id` — used in version tree queries
- `RecipeIngredient` FK columns — used in joins

**Fix:** Add `index=True` to these fields and create an Alembic migration:
```python
owner_id: str | None = Field(default=None, index=True)
root_id: int | None = Field(default=None, index=True)
```

**Impact:** 10-100x faster queries on large recipe tables, especially for access control checks.

---

### B3. Add Pagination to List Endpoints [HIGH]

**Files:** `backend/app/api/recipes.py`, `ingredients.py`, `outlets.py`, `suppliers.py`, `recipe_categories.py`

**Problem:** Most list endpoints return unbounded results. Only `tastings.py` has pagination.

**Pagination Shape:**

Query parameters:
- `page_number: int` (default: 1) — 1-indexed page number
- `page_size: int` (default: 30, max: 100) — rows per page

Response body:
```python
class PaginatedResponse(SQLModel, Generic[T]):
    items: list[T]
    page_number: int          # Current page (1-indexed)
    current_page_size: int    # Number of rows in this page (may be < page_size on last page)
    total_count: int          # Total matching rows across all pages
    total_pages: int          # ceil(total_count / page_size)
```

**Fix:** Add pagination parameters and return paginated response:
```python
import math

@router.get("")
def list_recipes(
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    ...
) -> PaginatedResponse[RecipeListRead]:
    offset = (page_number - 1) * page_size
    items = service.list(offset=offset, limit=page_size, search=search, ...)
    total_count = service.count(search=search, ...)
    return PaginatedResponse(
        items=items,
        page_number=page_number,
        current_page_size=len(items),
        total_count=total_count,
        total_pages=math.ceil(total_count / page_size) if total_count > 0 else 0,
    )
```

**Important:** Endpoints that currently support client-side filtering (recipes, ingredients, suppliers) must also accept server-side filter parameters (`search`, `status`, `category`, etc.) so that filtering works correctly with paginated results. See B3a below.

**Impact:** Prevents timeouts and excessive memory usage on large datasets. Ensures consistent API behaviour.

---

### B3a. Add Server-Side Filtering to Paginated Endpoints [HIGH]

**Problem:** Frontend currently fetches ALL records and filters client-side (search, status, category, sort). Once pagination is added, client-side filtering only operates on the current page — not the full dataset. Filtering must move server-side.

**Current client-side filters by endpoint:**

| Endpoint | Filters to Move Server-Side |
|----------|----------------------------|
| `/recipes` | `search` (name), `status`, `category_id`, `sort_by` (price asc/desc) |
| `/ingredients` | `search` (name), `category`, `unit`, `halal`, `allergen`, `sort_by` (price) |
| `/suppliers` | `search` (name), `active_only` (already exists) |
| `/outlets` | `search` (name), `is_active` (already exists) |
| `/tasting-sessions` | `search` (name), `date_from`/`date_to` |

**Fix:** Add query parameters matching the frontend's current filter capabilities:
```python
@router.get("")
def list_recipes(
    page_number: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    sort_by: str | None = Query(default=None),  # "price_asc", "price_desc", "name"
    ...
) -> PaginatedResponse[RecipeListRead]:
```

Each service's `list()` and `count()` methods must accept the same filter parameters and apply them to the query before pagination and counting respectively.

The `search` parameter should use case-insensitive `ILIKE` for partial matching:
```python
if search:
    statement = statement.where(Recipe.name.ilike(f"%{search}%"))
```

**Impact:** Preserves all existing filter/sort behaviour after pagination is introduced. Users see the same results they do today.

---

### B3b. Search-As-You-Type with Server-Side Query [HIGH]

**Problem:** With pagination and server-side filtering, search must hit the API on every query change. Naive implementation fires a request per keystroke, causing excessive API load and UI jank.

**Solution — Backend:**

The `search` query parameter (from B3a) already handles the server side. No additional backend endpoint is needed — the same paginated list endpoint serves both browsing and searching. The search always resets to `page_number=1`.

**Solution — Frontend (debounce + query coordination):**

1. **Debounced search state** — User input is debounced before being sent as a query parameter. This prevents firing API requests on every keystroke.

```tsx
// lib/hooks/useDebouncedValue.ts
import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

2. **Integration with paginated hooks** — The debounced search value feeds into TanStack Query keys, triggering a refetch only after the user stops typing. **Search persists across page changes** — navigating to page 2, 3, etc. keeps the current search term in place.

```tsx
// Example usage in a list page
const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search, 300);
const [pageNumber, setPageNumber] = useState(1);

// Reset to page 1 ONLY when search changes — not on page navigation
useEffect(() => setPageNumber(1), [debouncedSearch]);

// Page navigation keeps the same search term
const { data, isLoading, isPlaceholderData } = useRecipes({
  page_number: pageNumber,
  page_size: 30,
  search: debouncedSearch || undefined,
});

// Pagination handler — search stays unchanged
const goToPage = (page: number) => setPageNumber(page);
```

**Key behaviour:** Changing the page number only changes `page_number` in the query key. The `search` parameter remains the same. The user sees filtered results across all pages without re-entering their query.

3. **TanStack Query caching strategy:**

The query key structure `['recipes', { page_number, page_size, search }]` means each unique combination of page + search is cached independently. This gives us:
   - **Page-level caching** — Navigating back to a previously visited page is instant (served from cache)
   - **Search-level caching** — Pressing backspace to a previous search term is instant
   - **Cross-page search persistence** — Moving between pages within the same search term hits cache for visited pages

```tsx
export function useRecipes(params: { page_number: number; page_size: number; search?: string }) {
  return useQuery({
    queryKey: ['recipes', params],
    queryFn: () => api.getRecipes(params),
    placeholderData: keepPreviousData,  // Show previous page/search results while loading
    staleTime: 1000 * 60 * 5,          // Cache each page+search combo for 5 minutes
    gcTime: 1000 * 60 * 10,            // Keep in garbage-collectible cache for 10 minutes
  });
}
```

   | Scenario | Behaviour |
   |----------|-----------|
   | User on page 1, goes to page 2 | Page 2 fetched; page 1 stays cached. Going back to page 1 is instant. |
   | User searches "chicken", then "beef", then "chicken" again | Second "chicken" search served from cache — no API call. |
   | User searches "chicken" on page 1, goes to page 2 | Page 2 fetched with `search=chicken`. Search input unchanged. |
   | User clears search on page 3 | Resets to page 1 with no filter. Previous unfiltered page 1 may be cached. |
   | User returns to list after viewing detail page | TanStack Query serves cached page — no loading state if within `staleTime`. |

4. **UX considerations:**
   - Show a subtle loading indicator (spinner in search input) during debounce/fetch, not a full skeleton
   - 300ms debounce is the recommended balance — fast enough to feel responsive, slow enough to batch keystrokes
   - Minimum query length: no minimum enforced (empty string = no filter), but optionally skip API call for 1-character searches if result sets are too broad
   - Cancel in-flight requests when a new search term arrives (TanStack Query handles this automatically via query key changes)
   - Search input is a controlled component — its value is independent of pagination state and never resets on page change

**Impact:** Enables real-time search without overloading the API. Per-page+search caching means revisiting pages and search terms is near-instant with zero API calls.

---

### B4. Eager Loading in Costing Service [HIGH]

**File:** `backend/app/domain/costing_service.py` (lines ~106-128)

**Problem:** `calculate_recipe_cost()` fetches each ingredient individually inside a loop, then queries supplier details per ingredient.

**Fix:** Use `selectinload` for relationships and batch-fetch supplier data:
```python
statement = (
    select(RecipeIngredient)
    .where(RecipeIngredient.recipe_id == recipe_id)
    .options(selectinload(RecipeIngredient.ingredient))
)
```

**Impact:** Reduces costing endpoint queries from O(n) to O(1) where n = number of ingredients.

---

### B5. Configure Connection Pooling [HIGH]

**File:** `backend/app/database.py` (lines ~16-20)

**Problem:** No pool configuration — defaults to pool_size=5 with no overflow or recycling.

**Fix:**
```python
engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=connect_args,
    pool_size=20,
    max_overflow=40,
    pool_recycle=3600,
    pool_pre_ping=True,
)
```

**Impact:** Prevents connection exhaustion under concurrent load. `pool_pre_ping` avoids stale connection errors.

---

### B6. Cache Outlet Hierarchy Per-Request [MEDIUM]

**File:** `backend/app/domain/ingredient_service.py` (lines ~23-52)

**Problem:** `get_accessible_outlet_ids()` loads ALL outlets and does BFS traversal on every call. This is invoked repeatedly in list operations.

**Fix:** Compute once per request and pass through or cache in request state:
```python
# Compute once
accessible_ids = get_accessible_outlet_ids(session, current_user.outlet_id)
# Pass to service methods instead of recomputing
```

**Impact:** Eliminates redundant full-table scans and BFS traversals per request.

---

### B7. Lean List DTOs [MEDIUM]

**Files:** `backend/app/models/recipe.py`, `backend/app/api/recipes.py`

**Problem:** List endpoints return full model objects including large text fields (`instructions_raw`, `instructions_structured`, `description`).

**Fix:** Create slim read models for list views:
```python
class RecipeListRead(SQLModel):
    id: int
    name: str
    status: str
    cost_price: float | None
    yield_quantity: float
    owner_id: str | None
    image_url: str | None
```

**Impact:** 50-70% smaller list response payloads. Faster serialisation and network transfer.

---

### B9. Response Caching for Expensive Computations [LOW]

**Problem:** Recipe costing and version tree endpoints recalculate on every request despite data changing infrequently.

**Fix:** Add in-memory or Redis-backed caching with TTL:
- Recipe costing: 5 min TTL, invalidate on ingredient/recipe update
- Version tree: 10 min TTL, invalidate on fork
- Outlet hierarchy: 30 min TTL, invalidate on outlet update

**Impact:** 80-95% reduction in compute for repeat requests to these endpoints.

---

## Implementation Steps

### Phase 1: Quick Wins (No schema/API changes)
- [x] F1. Add `optimizePackageImports` to `next.config.ts`
- [x] F3. Add production build config (compress, source maps, cache headers)
- [x] B5. Configure connection pooling in `database.py`

### Phase 2: Database & Query Optimisations
- [x] B1. Batch-fetch recipes in menu endpoints (eliminate N+1)
- [x] B2. Add indexes to `Recipe.owner_id`, `Recipe.root_id` + Alembic migration
- [x] B4. Add eager loading (`selectinload`) in costing service
- [x] B6. Cache outlet hierarchy computation per-request

### Phase 3: Pagination & Server-Side Search
- [x] B3. Add `page_number`/`page_size` pagination to recipes, ingredients, outlets, suppliers, recipe-categories endpoints
- [x] B3a. Add server-side filter/sort query parameters to all paginated endpoints
- [x] B7. Create lean list DTOs for recipe and ingredient list views
- [x] F8. Create `useDebouncedValue` hook (300ms default)
- [x] F8. Create reusable `Pagination` UI component
- [x] F8. Update `api.ts` fetch functions to accept pagination + search params
- [x] F8. Update TanStack Query hooks to accept paginated params with `keepPreviousData`
- [x] F8. Update list pages (recipes, ingredients, suppliers, outlets, tastings) to use paginated hooks with debounced search
- [x] F8. Reset `page_number` to 1 on search/filter changes

### Phase 4: Frontend Asset Optimisations
- [x] F2. Replace raw `<img>` tags with Next.js `<Image>` components
- [x] F4. Tune TanStack Query `staleTime` per query type
- [x] F5. Add file size validation and sequential processing for image uploads

### Phase 5: Polish
- [x] F6. Deduplicate dark mode CSS variables
- [x] F7. Add `React.memo()` to heavy list components
- [x] B9. Add response caching for costing and version tree endpoints

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Pagination breaks existing frontend list consumption | Frontend hooks updated to consume `PaginatedResponse` shape; list pages manage `page_number` state and render `Pagination` component |
| Search-as-you-type fires too many requests | 300ms debounce via `useDebouncedValue`; TanStack Query auto-cancels stale in-flight requests on query key change |
| User types fast then clears search — stale results flash | `placeholderData: keepPreviousData` keeps previous results visible until new data arrives |
| User navigates to page 2 — search input clears | Search state is independent of page state; only `page_number` changes on pagination, search input value is untouched |
| User goes to page 3, back to page 1 — refetches unnecessarily | Each page+search combo is cached with 5min `staleTime` and 10min `gcTime`; revisiting a page is instant from cache |
| User searches, visits detail page, comes back — loses position | TanStack Query cache preserves the last page+search state; returning to list restores from cache without loading |
| 1-character search returns too many results | Optionally skip API call for queries < 2 characters; show "keep typing" hint instead |
| Filter/sort change doesn't reset page | `useEffect` resets `page_number` to 1 whenever `debouncedSearch`, `status`, `category`, or `sort_by` changes |
| Lean DTOs miss fields needed by some views | Keep full-object endpoints alongside list endpoints; frontend uses lean for lists, full for detail |
| Image component breaks external URLs | Ensure `remotePatterns` in `next.config.ts` covers all image hosts (Supabase, DALL-E) |
| Connection pool too large for dev SQLite | Guard pool config behind `if not sqlite` check |
| Cache invalidation misses an update path | Start with short TTLs (1-5 min) and rely on natural expiry rather than complex invalidation |

---

## Acceptance Criteria

- [x] No changes to core business logic, features, or user-facing behaviour
- [x] Frontend production build size is measurably smaller (compare before/after `npm run build`)
- [x] Menu detail endpoint query count reduced from O(n) to O(1)
- [x] All list endpoints support `page_number`/`page_size` pagination with `PaginatedResponse` shape
- [x] All paginated endpoints accept `search` query parameter with case-insensitive partial matching
- [x] Frontend list pages render a `Pagination` component with page navigation
- [x] Search inputs are debounced (300ms) before triggering API requests
- [x] Page resets to 1 when search or filter values change
- [x] Previous results remain visible during loading (`keepPreviousData`)
- [x] Database has indexes on `Recipe.owner_id` and `Recipe.root_id`
- [x] Connection pooling configured for PostgreSQL
- [x] All existing tests pass without modification
