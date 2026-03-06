# Plan 12: Backend Performance Audit

> Inconsistent loading speed for server (for ALL endpoints) → audit required

## Audit Results

| # | Severity | Issue | File(s) |
|---|----------|-------|---------|
| 1 | **P0 Critical** | Supabase client re-created + network round-trip on every authenticated request | `deps.py:37`, `supabase_auth_service.py:15-22` |
| 2 | **P0 Critical** | Multiple Supabase clients created in auth endpoints (register = 3 round-trips) | `auth.py:39,92,172,208` |
| 3 | **P1 High** | Synchronous DB calls blocking async event loop | `tasting_note_images.py:64`, `recipe_images.py:41` |
| 4 | **P1 High** | N+1 query pattern in cycle detection BFS | `subrecipe_service.py:36-69` |
| 5 | **P1 High** | N+1 in batch recipe-to-session adds (2N queries per batch) | `recipe_tasting_service.py:58-95` |
| 6 | **P1 High** | N+1 in batch ingredient-to-session adds | `ingredient_tasting_service.py:58-95` |
| 7 | **P1 High** | Full outlet table scan on many code paths | `ingredient_service.py:29`, `outlet_service.py:255,289` |
| 8 | **P2 Medium** | Redundant DB fetches in tasting session access control | `tastings.py:111-188` |
| 9 | **P2 Medium** | Double query for paginated endpoints (items + count) | `recipes.py:58`, `ingredients.py:63`, `tastings.py:84` |
| 10 | **P2 Medium** | New httpx client per storage upload/delete | `storage_service.py:72,125` |
| 11 | **P2 Medium** | Excessive commits in menu fork/update (10+ per fork) | `menu_service.py:126-185` |
| 12 | **P2 Medium** | Recursive per-query outlet walking in router | `outlets.py:46-53` |
| 13 | **P2 Medium** | Unbounded global costing cache (memory leak) | `costing.py:15-31` |
| 14 | **P3 Low** | No connection pool warming at startup | `main.py:15-21` |
| 15 | **P3 Low** | Debug SQL logging risk in production | `database.py:29` |
| 16 | **P3 Low** | Sequential version tree root traversal (N queries for N depth) | `recipe_service.py:547-555` |
| 17 | **P3 Low** | Duplicated outlet hierarchy logic across 5+ files | Multiple service files |

## Performance Implications

### P0 — Supabase Auth: The Primary Bottleneck

Every authenticated request (i.e. nearly every endpoint) creates a **new Supabase client** from scratch — TCP connection, TLS handshake — then makes a **synchronous network round-trip** to Supabase's external API to verify the JWT token. This adds **50–300ms of unpredictable latency** to every single request. The variance in network jitter to Supabase directly translates to the inconsistent response times observed across all endpoints.

The `register` endpoint is the worst offender: it creates **3 separate Supabase clients** and makes **3 network round-trips** in a single request.

### P1 — Event Loop Blocking & N+1 Queries

Several `async def` endpoints perform **synchronous database calls**, which block the entire asyncio event loop. While one endpoint waits for a DB response, **all other concurrent async operations stall** — including storage uploads and other requests. This creates cascading latency spikes.

N+1 query patterns in cycle detection, batch operations, and outlet hierarchy traversal cause **linear query growth** proportional to data size. A recipe with 20 sub-recipes triggers 20+ individual SELECT queries instead of 1-2 batch queries.

### P2 — Cumulative Overhead

Redundant DB fetches (loading the same session 2-3 times per request), creating new HTTP clients per file upload, and issuing 10+ commits per menu fork all add incremental latency. Individually minor, but collectively they compound — especially under concurrent load.

The unbounded costing cache grows without limit, risking **memory exhaustion** in long-running processes.

### P3 — Cold Start & Maintenance Debt

First requests after deployment are slower due to unwarmed connection pools. Duplicated outlet hierarchy logic across 5+ files means the same expensive queries are independently repeated, and fixing one location doesn't fix the others.

## Fixes & Performance Impact

### Fix 1: Singleton Supabase Client + Local JWT Verification

**Addresses: P0 #1, P0 #2** — Estimated impact: **-50 to -300ms per request**

**What to change:**
- Create the Supabase client **once** at module level or during app lifespan, not per-request
- Verify JWTs **locally** using the Supabase JWT secret (`PyJWT` or `python-jose`) instead of calling Supabase's API
- Add an in-memory TTL cache (e.g. 60s) mapping `token → user_id` as a fallback if local verification isn't feasible

**Impact:** Eliminates the single biggest source of inconsistent latency. Every authenticated endpoint becomes faster and more predictable.

### Fix 2: Fix Async/Sync Mismatch

**Addresses: P1 #3** — Estimated impact: **Eliminates event loop stalls under concurrent load**

**What to change:**
- Change `async def` endpoints that only do synchronous DB work to plain `def` (FastAPI dispatches these to a threadpool automatically)
- For endpoints that mix sync DB + async I/O (like `sync_tasting_note_images`), use `asyncio.to_thread()` for the DB calls
- Keep `async def` only for endpoints that genuinely `await` async I/O

**Impact:** Prevents one slow DB query from stalling all other concurrent requests. Critical for multi-user scenarios.

### Fix 3: Batch-Fetch for N+1 Elimination

**Addresses: P1 #4, #5, #6** — Estimated impact: **-50 to -200ms on affected endpoints**

**What to change:**
- `can_add_subrecipe`: Fetch all `RecipeRecipe` links in one query, do BFS in memory
- `add_recipes_to_session`: Batch-fetch all recipes + existing links in 2 queries upfront
- `add_ingredients_to_session`: Same batch-fetch pattern

**Impact:** Reduces 2N sequential queries to 2-3 queries regardless of batch size.

### Fix 4: Centralize & Cache Outlet Hierarchy

**Addresses: P1 #7, P3 #17** — Estimated impact: **-20 to -50ms on outlet-filtered endpoints**

**What to change:**
- Consolidate duplicated outlet hierarchy logic (currently in 5+ files) into a single shared utility on `OutletService`
- Add per-request or short-TTL application-level caching for outlet hierarchy resolution

**Impact:** Eliminates redundant full table scans and ensures consistency across all access control checks.

### Fix 5: Reuse httpx Client & Reduce Commits

**Addresses: P2 #10, #11** — Estimated impact: **-30 to -100ms on image uploads and menu forks**

**What to change:**
- Share a single `httpx.AsyncClient` instance across storage operations (created at service init)
- Replace `session.commit()` with `session.flush()` in menu fork/update loops; do a single commit at the end

**Impact:** 5 image uploads reuse 1 connection pool instead of creating 5. Menu forks go from 10+ DB round-trips to 1.

### Fix 6: Bounded Costing Cache + Connection Pool Warming

**Addresses: P2 #13, P3 #14** — Estimated impact: **Prevents memory leak; faster cold starts**

**What to change:**
- Replace unbounded `dict` cache with `cachetools.TTLCache(maxsize=256, ttl=300)`
- Add a warm-up `SELECT 1` query in the app lifespan to pre-establish connection pool

**Impact:** Prevents OOM in long-running processes. First requests after deploy are no longer noticeably slower.

### Fix 7: Eliminate Redundant Fetches in Tasting Endpoints

**Addresses: P2 #8** — Estimated impact: **-10 to -30ms per tasting endpoint**

**What to change:**
- Pass the already-loaded session object into subsequent service methods instead of re-fetching by ID
- `get_stats`, `update`, and `delete` should accept an optional pre-loaded session

**Impact:** Removes 1-2 redundant queries per tasting session endpoint.
