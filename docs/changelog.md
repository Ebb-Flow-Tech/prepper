# Changelog

All notable changes to this project will be documented in this file.

---

## Version History

- **0.0.26** (2026-03-13) - Cross-Category Unit Conversion in Canvas: Weight↔Volume unit switching (g/kg↔ml/l) with automatic quantity and price conversion in CanvasLayout ingredient table and cards
- **0.0.25** (2026-03-12) - FMH Import Pipeline, Recipe-Category Search, Menu UX Enhancements, Recipe Category Soft Delete, Ingredient Filter Pagination & UI Polish
- **0.0.24** (2026-03-09) - Lark Integration & Tasting UX: Lark DM Invitations, Add-to-Calendar Applink, Branded Email Template, Inline Recipe Feedback Modal, Derived Session Ingredients & Sequential Lark Fix
- **0.0.23** (2026-03-06) - Performance Audit Fixes: Singleton Supabase Client, Local JWT Verification, N+1 Elimination, Centralized Outlet Hierarchy, Shared httpx Client & Bounded Costing Cache
- **0.0.22** (2026-03-06) - Bug Fixes: Canvas Navigation, Recipe Creation Race Condition, Untitled Recipe Flash, Submit Button Logic, Tasting Session UX & Ingredient/Recipe Tasting DTOs
- **0.0.21** (2026-03-05) - Participant-Only Feedback, Canvas Unit Price Auto-Conversion & Recipe Loading Fix
- **0.0.20** (2026-03-04) - Server-Side Pagination & Performance: Paginated List Endpoints, Server-Side Search/Filtering, Database Indexes, Connection Pooling & Next.js Optimization
- **0.0.19** (2026-03-03) - Outlet-Scoped Supplier Ingredients: Per-Outlet Pricing, Hierarchical Access Control & Outlet Selector UI
- **0.0.18** (2026-03-02) - Supplier-Ingredient Normalization & UX Improvements: JSONB-to-Join-Table Refactor, Canvas Supplier Selection, Costing Integration, Session Creator Tracking, ID-Based Participants & Quick-Add Ingredients
- **0.0.17** (2026-02-27) - UI Redesign & Performance Optimization: Canvas Layout Overhaul, Supplier UI Polish, Menu Publish/Unpublish & Backend Query Optimization
- **0.0.16** (2026-02-26) - SMS Invitations, Tasting Participant Association & Menu Management: Twilio SMS Integration, User-Based Session Relationships & Drag-and-Drop Menu Reordering
- **0.0.15** (2026-02-23) - Access Control & Allergen Management: Admin User Management, Hierarchical Access Control, Allergen Tracking & Supplier Soft Delete
- **0.0.14** (2026-02-12) - Parent Outlet Recipes Display: Read-Only Table for Multi-Brand Recipe Management
- **0.0.13** (2026-01-28) - Ingredient Tasting & Text-Based Features: Standalone Tasting Notes, Direct Ingredient Input, Collapsible UI & Image Support
- **0.0.12** (2026-01-21) - Wastage, Outlets & Recipe Enhancements: Multi-Image Gallery, Outlet Hierarchy, Profit Margins, AI Feedback Summary & R&D Workflow
- **0.0.11** (2026-01-23) - User Authentication & Recipe Categories: Supabase Auth Integration, Full CRUD Category Management, Tasting Note Images & Branding
- **0.0.10** (2025-12-18) - Tasting Notes: R&D Feedback Tracking with Sessions, Ratings, Decisions & Recipe History Integration
- **0.0.9** (2025-12-17) - Bugfix: Enum-to-VARCHAR Mismatch Fix for Ingredients API + CORS Update for Vercel
- **0.0.8** (2025-12-17) - Frontend Multi-Page Expansion: Ingredients Library, Recipes Gallery, Recipe Detail, R&D Workspace, Finance Placeholder
- **0.0.7** (2025-12-17) - Recipe Extensions: Sub-Recipe BOM Hierarchy, Authorship Tracking, Outlet/Brand Attribution
- **0.0.6** (2025-12-17) - Ingredient Data Model Enhancements: Multi-Supplier Pricing, Master Ingredient Linking, Food Categories & Source Tracking
- **0.0.5** (2025-12-03) - AI-Powered Instructions Parsing: Vercel AI SDK + GPT-5.1 for Freeform→Structured Conversion, UX Improvements & CORS Fixes
- **0.0.4** (2025-12-02) - Backend Deployment: Fly.io Production Setup with Supabase PostgreSQL
- **0.0.3** (2024-11-27) - Database Migration: Alembic Initial Tables to Supabase + PostgreSQL JSON Compatibility Fix
- **0.0.2** (2024-11-27) - Frontend Implementation: Next.js 15 Recipe Canvas with Drag-and-Drop, Autosave & TanStack Query
- **0.0.1** (2024-11-27) - Backend Foundation: FastAPI + SQLModel with 17 API Endpoints, Domain Services & Unit Conversio
---

## [0.0.25] - 2026-03-12

### Added

#### FMH Import Pipeline — `seed_fmh.py` & `reset_fmh.py`

Scripts to bulk-import Food Market Hub (FMH) Excel exports into the database and cleanly remove them.

**`seed_fmh.py`**:
- Reads three Excel exports from `backend/exports/`: `Suppliers.xlsx`, `SponsoredSupplierPricings.xlsx`, `ProductList_modified.xlsx`
- Seeds suppliers, outlets, categories, ingredients, and supplier-ingredient links in a single run
- Idempotent: skips rows that already exist by name/SKU
- Uses `openpyxl` to parse worksheets into dicts via header row

**`reset_fmh.py`**:
- Removes all FMH-seeded data: `supplier_ingredients` (source = `fmh`), ingredients (source = `fmh`), all categories, suppliers, and outlets
- Confirmation prompt by default; `--yes` flag skips it
- Uses `sqlalchemy inspect` to check table existence before deleting

**Database Change — `OutletSupplierIngredient` join table**:
- New `outlet_supplier_ingredient` table links a `supplier_ingredient` record to one or more outlets for display scoping
- Unique constraint on `(supplier_ingredient_id, outlet_id)`
- Alembic migration `h9_refactor_supplier_ingredient_outlet_scope.py`
- `SupplierIngredient` model updated: removed `outlet_id` direct column, added `outlet_links` relationship to `OutletSupplierIngredient`
- `ingredient_service.py` and `supplier_service.py` refactored for new join table structure

**Files Created**:
- `backend/scripts/seed_fmh.py`
- `backend/scripts/reset_fmh.py`
- `backend/app/models/outlet_supplier_ingredient.py`
- `backend/alembic/versions/h9_refactor_supplier_ingredient_outlet_scope.py`

**Files Modified**:
- `backend/app/models/supplier_ingredient.py` — Removed `outlet_id`, added `outlet_links` relationship
- `backend/app/models/__init__.py` — Export `OutletSupplierIngredient`
- `backend/app/domain/ingredient_service.py` — Refactored for join table
- `backend/app/domain/supplier_service.py` — Refactored for join table

#### Supplier `code` & `shipping_company_name` Fields

Added two new display fields to the `Supplier` type and surfaces them in supplier list and detail views.

**Files Modified**:
- `frontend/src/types/index.ts` — `code` and `shipping_company_name` on `Supplier`, `CreateSupplierRequest`, `UpdateSupplierRequest`
- `frontend/src/app/suppliers/page.tsx` — Display in list
- `frontend/src/app/suppliers/[id]/page.tsx` — Display in detail
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Show code/shipping company
- `backend/tests/test_suppliers.py` — New tests for supplier fields

### Changed

#### Recipe Search Matches Category Names

Recipe list search (`GET /recipes?search=...`) now also returns recipes whose assigned category names match the search term, in addition to recipe name matches.

**Implementation**: Subquery joins `recipe_recipe_categories → recipe_categories` and filters by `RCat.name.ilike(...)` with `is_active = True`. Result is OR-combined with the existing name match.

**Files Modified**:
- `backend/app/domain/recipe_service.py` — Extended `_build_list_query()` with category name OR clause

#### Recipe-Category Links Soft-Delete

`delete_recipe_category_link()`, `delete_recipe_categories_by_recipe()`, and `delete_recipe_categories_by_category()` now soft-delete by setting `is_active = False` instead of issuing a hard `session.delete()`.

**Files Modified**:
- `backend/app/domain/recipe_recipe_category_service.py` — Soft-delete with `is_active = False` + `updated_at`
- `backend/tests/test_recipe_recipe_categories.py` — Updated tests for soft-delete behaviour

#### Recipe Category Badges on Recipe List Rows

Category names are now displayed as secondary badges alongside allergen badges on each recipe row in the recipe management list.

**Files Modified**:
- `frontend/src/components/recipes/RecipeListRow.tsx` — Added `categoryNames` prop and badge render
- `frontend/src/components/recipes/RecipeManagementTab.tsx` — Pass `getCategoryNamesForRecipe()` to each row

#### Inline "Create Category" in Overview Tag Dropdown

When searching for a category tag in the recipe Overview tab and no match exists, a **"+ Create \"{term}\""** button appears instead of a dead-end "No matching categories" message. Clicking it creates the category and immediately assigns it to the recipe.

**Files Modified**:
- `frontend/src/components/layout/tabs/OverviewTab.tsx` — `useCreateRecipeCategory` hook; inline create on empty state

#### Menu Builder — Multi-Add Recipe Picker (replaces single-add)

The `+` button on each menu section's items header now opens an inline multi-select panel instead of immediately adding a blank item.

**Features**:
- Debounced search input with clear button
- Scrollable recipe list with checkboxes; already-added recipes shown as disabled with "Added" label
- "View more" pagination via `useInfiniteRecipes`
- Footer shows selection count; "Add N item(s)" button confirms; Cancel closes the panel
- Only one section's panel can be open at a time

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — `MultiAddContent` component, `useInfiniteRecipes` + `useDebouncedValue` integration, removed single-add `addItem` function

#### Canvas Tab Order — Overview Before Canvas

`CANVAS_TABS` array reordered so **Overview** appears as the first tab, before **Canvas**.

**Files Modified**:
- `frontend/src/components/layout/TopAppBar.tsx`

#### Menu Preview Edit Button — Admins & Managers

"Edit Menu" link on `/menu/preview/[id]` is now visible to both `admin` users and users with `isManager = true` (previously admin-only).

**Files Modified**:
- `frontend/src/app/menu/preview/[id]/page.tsx`

#### Image Upload — Drag-and-Drop Support

`ImageUploadPreview` component refactored to extract `handleFiles(FileList)` as a shared handler, enabling programmatic file processing from both file input and drag-drop events. Added `isDragging` state for visual feedback.

**Files Modified**:
- `frontend/src/components/tasting/ImageUploadPreview.tsx`

#### Remove `cl`/`dl` Unit Support

`cl` (centilitre) and `dl` (decilitre) removed from `MASS_CONVERSIONS` in `unit_conversion.py` and from `COMMON_UNITS` in `utils.ts`. These units are not used in practice and were causing ambiguous conversions.

**Files Modified**:
- `backend/app/utils/unit_conversion.py`
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/unitConversion.ts`

#### Volume ↔ Mass Cross-Category Unit Conversion

`convert_to_base_unit()` now supports volume-to-mass and mass-to-volume conversions using density = 1 g/ml (i.e. 1 ml = 1 g, 1 l = 1 kg). Previously these combinations returned `None` as incompatible.

**Files Modified**:
- `backend/app/utils/unit_conversion.py` — Added cross-category conversion branch

#### Recipe Category Soft Delete & Pagination Parity

Recipe categories now match ingredient category behaviour end-to-end: soft delete (archive/unarchive) instead of hard delete, `active_only` filtering, and "Show archived" checkbox in the UI.

**Backend**:
- Added `is_active: bool = Field(default=True)` to `RecipeCategory` model
- `RecipeCategoryService._build_list_query()`, `list_paginated()`, and `count()` now accept `active_only` param
- Added `soft_delete_recipe_category()` service method
- `DELETE /recipe-categories/{id}` changed from hard delete (204) to soft delete (200, returns archived category)
- `GET /recipe-categories` accepts `active_only` query param (default `true`)
- Alembic migration `d5e6f7g8h9i0` — adds `is_active` column to `recipe_categories` with `server_default=true`

**Frontend**:
- Added `is_active` field to `RecipeCategory` type and `UpdateRecipeCategoryRequest`
- Added `RecipeCategoryListParams` interface with `active_only` in `api.ts`
- Updated `useRecipeCategories` hook to use `RecipeCategoryListParams`
- `RecipeCategoriesTab`: added `showArchived` state, `active_only` in query, page reset on filter change, archive confirmation modal, and unarchive via PATCH
- `RecipeCategoryCard` / `RecipeCategoryListRow`: replaced `onDelete` with `onArchive`/`onUnarchive`; added `Archive`/`ArchiveRestore` icons and "Archived" badge

**Tests**:
- `test_recipe_categories.py`: updated `test_delete_recipe_category` for soft-delete (200 + `is_active=false`); added `test_list_recipe_categories_active_only` and `test_unarchive_recipe_category`; added `is_active` assertions to create tests

**Files Modified**:
- `backend/app/models/recipe_category.py`
- `backend/app/domain/recipe_category_service.py`
- `backend/app/api/recipe_categories.py`
- `backend/alembic/versions/d5e6f7g8h9i0_add_is_active_to_recipe_categories.py` *(new)*
- `backend/tests/test_recipe_categories.py`
- `frontend/src/types/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/hooks/useRecipeCategories.ts`
- `frontend/src/components/recipes/RecipeCategoriesTab.tsx`
- `frontend/src/components/recipes/RecipeCategoryCard.tsx`
- `frontend/src/components/recipes/RecipeCategoryListRow.tsx`

#### Ingredient Category Filter — Server-Side Pagination with Load More

The category filter buttons on `/ingredients` now load categories from the server page-by-page (10 per page) with a "See more" button to append further pages, instead of loading all categories upfront.

**Files Modified**:
- `frontend/src/app/ingredients/page.tsx` — `useCategoriesPaginated` for filter buttons, append-on-load-more logic
- `frontend/src/components/ingredients/FilterButtons.tsx` — `hasMoreCategories`, `onLoadMoreCategories`, `isLoadingMoreCategories` props; "See more" button
- `frontend/src/lib/hooks/useCategories.ts` — Added `useCategoriesPaginated` hook

#### Recipe Category Filter Buttons — Show All Toggle

When more than 8 recipe category filter buttons exist, only the first 8 are shown with a `+N more` / `See less` toggle button.

**Files Modified**:
- `frontend/src/components/recipes/RecipeCategoryFilterButtons.tsx` — `showAll` state, `CATEGORY_VISIBLE_LIMIT`, toggle button

#### Recipe Overview Tab — Inline Recipe Name Editing

Recipe name in the Overview tab is now inline-editable via a hover-reveal pencil icon. Saves on Enter or confirm button; Escape reverts.

**Files Modified**:
- `frontend/src/components/layout/tabs/OverviewTab.tsx` — `isEditingName` / `nameValue` state, `handleSaveName()`, inline edit input with confirm/cancel

#### Menu Builder — Collapsible Item Fields

Key Highlights, Additional Info, and Substitution fields in `DraggableItem` are now collapsible via chevron toggle buttons (expanded by default). The Outlets section in the menu header is also collapsible.

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — `highlightsOpen`, `additionalOpen`, `substitutionOpen`, `outletsOpen` state; chevron toggle buttons

#### UI Polish — Remove Placeholder Image Elements

Removed non-functional image placeholder buttons from ingredient cards and the ingredient detail page header. The ingredient detail page now shows a subtle "Click any field below to edit" hint instead.

**Files Modified**:
- `frontend/src/components/ingredients/IngredientCard.tsx` — Removed `ImagePlus` placeholder button
- `frontend/src/app/ingredients/[id]/page.tsx` — Replaced image placeholder with edit hint; removed `ImagePlus` import
- `frontend/src/components/categories/CategoryCard.tsx` — Removed `FolderOpen` icon placeholder

#### Supplier List Row — Shipping Company Display

Supplier list rows now display `shipping_company_name` as "Ships via …" when present.

**Files Modified**:
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Inline shipping company name display

---

## [0.0.24] - 2026-03-09

### Added

#### Lark DM Invitations for Tasting Sessions (Plan 14)

Integrated Lark as a third notification channel alongside Email (SendGrid) and SMS (Twilio). Tasting session invitations are now sent as Lark direct messages to all participants.

**Features**:
- `@larksuiteoapi/node-sdk` integration for sending Lark DMs via bot
- SDK handles tenant token generation, caching, and refresh automatically
- Each recipient receives a Lark DM with session name, date, location, and invite link
- Graceful degradation: if `LARK_APP_ID`/`LARK_APP_SECRET` not configured, Email/SMS send normally with `lark_count: 0`
- Per-recipient error isolation: one failed Lark DM does not block others or Email/SMS
- API response includes `lark_count` alongside `email_count` and `sms_count`
- Toast message shows combined delivery summary across all channels

**Environment Variables**:
- `LARK_APP_ID` — Lark app ID from open.larksuite.com
- `LARK_APP_SECRET` — Lark app secret from open.larksuite.com

**Files Modified**:
- `frontend/package.json` — Added `@larksuiteoapi/node-sdk` dependency
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Lark client init, DM sending, `lark_count` response
- `frontend/src/lib/hooks/useSendTastingInvitation.ts` — Added `lark_count` to response type
- `frontend/.env.example` — Added `LARK_APP_ID`, `LARK_APP_SECRET`

#### Add-to-Calendar Applink in Lark Messages (Plan 14, Part 3)

Lark DMs now include a clickable deep link that opens the Lark Calendar event creation page with session details pre-filled.

**Features**:
- Applink URL: `https://applink.larksuite.com/client/calendar/event/create?startTime=...&endTime=...&summary=...`
- `startTime`: session date as Unix timestamp (seconds)
- `endTime`: startTime + 1 hour
- `summary`: URL-encoded "Tasting: {session_name}"
- Clicking the link opens Lark Calendar with pre-filled event — user confirms to add to their own calendar
- No server-side Calendar API calls or additional permissions needed

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Calendar applink URL generation

#### Branded Invitation Email Template (Plan 13, P1-4)

Redesigned the tasting invitation email with a professional, branded layout.

**Features**:
- Branded header with RecipePrep logo and distinct color scheme
- Personalized greeting using recipient name (if available)
- Session details card with icons for session name, date/time, and location
- Custom message support with styled blockquote
- Prominent CTA button ("View Tasting Session")
- Responsive HTML email design

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Full email template redesign

#### Inline Recipe Feedback Modal (Plan 13, P2-2)

Added expandable feedback cards on the tasting session detail page, allowing participants to submit tasting notes without navigating away.

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Inline feedback modal for recipes

#### Session Status Indicators & Loading States (Plan 13, P0-2/P0-3)

Added visual feedback for review progress and image upload states on tasting pages.

**Features**:
- Per-recipe feedback status indicators (checked/unchecked) on session detail page
- Loading spinners during image upload in feedback submission
- Form state improvements after submission

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Review status indicators
- `frontend/src/app/tastings/[id]/r/[recipeId]/page.tsx` — Loading states and form reset

### Changed

#### Lark DMs Sent Sequentially to Avoid Token Race Condition

Lark messages were previously dispatched in parallel via `forEach` + `Promise.all`. The SDK's automatic tenant token acquisition caused race conditions when multiple requests fired before the first token was cached.

**Fix**: Wrapped Lark sends in a sequential `for...of` loop so the first message acquires and caches the token, and subsequent messages reuse it.

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Sequential Lark DM sending

#### Derive Session Ingredients from Recipe Ingredients (Backend + Frontend)

Session ingredients were previously managed as a separate list (add/remove individually). Now they are derived automatically from the recipes linked to the session, eliminating duplicate data management.

**Backend**:
- `RecipeTastingRead` now includes `ingredients: list[RecipeTastingIngredient]` with ingredient id, name, base_unit, is_halal
- `RecipeTastingIngredient` DTO added for minimal nested ingredient info
- `get_recipes_for_session()` batch-loads recipe ingredients via JOIN query and groups by recipe_id
- Tests added for ingredient inclusion in recipe-tasting responses

**Frontend**:
- Session ingredients section now derives from recipe ingredients (no separate add/remove UI)
- `DerivedIngredient` type aggregates ingredients across recipes with `recipe_names[]`
- Removed `useSessionIngredients`, `useAddIngredientsToSession`, `useRemoveIngredientFromSession` usage from session detail page
- `RecipeFeedbackModal` updated with ingredient display improvements

**Files Modified**:
- `backend/app/models/recipe_tasting.py` — Added `RecipeTastingIngredient`, `ingredients` on `RecipeTastingRead`
- `backend/app/models/__init__.py` — Export new types
- `backend/app/domain/recipe_tasting_service.py` — Batch-load ingredients in `get_recipes_for_session()`
- `backend/tests/test_recipe_tastings.py` — Tests for ingredient inclusion
- `frontend/src/app/tastings/[id]/page.tsx` — Derived ingredients, removed manual ingredient management
- `frontend/src/components/tasting/RecipeFeedbackModal.tsx` — Updated ingredient display
- `frontend/src/types/index.ts` — Added `RecipeTastingIngredient` type

#### Moved flow-ui-starter to docs/

Relocated `flow-ui-starter/` directory under `docs/` for better project organization.

---

## [0.0.23] - 2026-03-06

### Performance

#### P0: Singleton Supabase Client + Local JWT Verification

Every authenticated request previously created a new Supabase client (TCP + TLS handshake) and made a synchronous network round-trip to Supabase to verify the JWT. This added 50–300ms of unpredictable latency per request. The `register` endpoint created 3 separate clients.

**Fix**:
- Supabase client created once via `@lru_cache` singleton (`_get_supabase_client()`) and reused across all requests
- `SupabaseAuthService` itself cached as module-level singleton via `get_auth_service()`
- JWT tokens verified locally using `PyJWT` when `SUPABASE_JWT_SECRET` is configured, eliminating the network round-trip entirely
- Falls back to remote Supabase verification if JWT secret is not set
- `auth.py` `/me` endpoint simplified to use `get_current_user` dependency (was duplicating auth logic manually)

**Files Modified**:
- `backend/app/domain/supabase_auth_service.py` — Singleton client, local JWT verification, `get_auth_service()` factory
- `backend/app/api/auth.py` — Use `get_auth_service()`, simplify `/me` endpoint
- `backend/app/api/deps.py` — Use `get_auth_service()` in `get_current_user`
- `backend/app/config.py` — Added `supabase_jwt_secret` setting
- `backend/pyproject.toml` — Added `PyJWT>=2.8.0` dependency
- `backend/tests/test_auth.py` — Clear singleton caches in fixtures, `auth_client` fixture for real auth flow

#### P1: Fix Async/Sync Mismatch

Several `async def` endpoints performed synchronous database calls, blocking the asyncio event loop. While one endpoint waited for a DB response, all other concurrent async operations stalled.

**Fix**: Wrapped synchronous DB calls with `asyncio.to_thread()` in async image upload/delete/sync endpoints.

**Files Modified**:
- `backend/app/api/recipe_images.py` — `to_thread` for `get_recipe` and `add_image`
- `backend/app/api/tasting_note_images.py` — `to_thread` for all sync DB calls in delete and sync endpoints

#### P1: Batch-Fetch N+1 Elimination

N+1 query patterns in cycle detection and batch add operations caused linear query growth. A recipe with 20 sub-recipes triggered 20+ individual SELECT queries.

**Fix**:
- `can_add_subrecipe()`: Fetch all `RecipeRecipe` links in one query, build adjacency map, BFS in memory
- `add_recipes_to_session()`: Batch-fetch all valid recipes + existing links in 2 queries upfront
- `add_ingredients_to_session()`: Same batch-fetch pattern
- `reorder_sub_recipes()`: Batch-fetch all links by IDs in one query

**Files Modified**:
- `backend/app/domain/subrecipe_service.py` — Batch-fetch links for cycle detection and reorder
- `backend/app/domain/recipe_tasting_service.py` — Batch-fetch recipes + existing links
- `backend/app/domain/ingredient_tasting_service.py` — Batch-fetch ingredients + existing links

#### P1/P3: Centralize & Deduplicate Outlet Hierarchy

Outlet hierarchy traversal logic was duplicated across 5+ files. Each copy did full table scans with recursive per-query walking.

**Fix**: Consolidated into `OutletService.get_accessible_outlet_ids()`. All callers now use this single method. Removed `get_accessible_outlet_ids()` standalone function from `ingredient_service.py`.

**Files Modified**:
- `backend/app/domain/outlet_service.py` — New `get_accessible_outlet_ids()` + `list_paginated_with_count()`
- `backend/app/domain/ingredient_service.py` — Removed standalone function, uses `OutletService`
- `backend/app/domain/menu_service.py` — Replaced 20-line hierarchy walk with single `OutletService` call
- `backend/app/domain/supplier_service.py` — Uses `OutletService`
- `backend/app/api/outlets.py` — Uses `OutletService.get_accessible_outlet_ids()`, moved cycle check into service

#### P2: Eliminate Redundant DB Fetches in Tasting Endpoints

Tasting session endpoints loaded the full session (with participants) 2-3 times per request — once for access control, once for the operation.

**Fix**:
- `get_raw()`: Lightweight session fetch without participant loading
- `is_participant()`: Single-column EXISTS query for access checks
- `_check_session_access_raw()`: Access check using raw session + lightweight participant check
- `update()` and `delete()` accept optional pre-loaded `existing` session to avoid re-fetching

**Files Modified**:
- `backend/app/domain/tasting_session_service.py` — `get_raw()`, `is_participant()`, `list_paginated_with_count()`, optional `existing` param
- `backend/app/api/tastings.py` — `_check_session_access_raw()`, pass pre-loaded session to update/delete

#### P2: Combined Paginated List + Count Query

Paginated endpoints issued two separate queries with the same filters — one for items, one for count. The base filter was built twice.

**Fix**: Added `list_paginated_with_count()` to each service that builds the base query once, then derives both count and paginated items from it.

**Files Modified**:
- `backend/app/domain/recipe_service.py` — `list_paginated_with_count()`
- `backend/app/domain/ingredient_service.py` — `list_paginated_with_count()`
- `backend/app/domain/tasting_session_service.py` — `list_paginated_with_count()`
- `backend/app/domain/outlet_service.py` — `list_paginated_with_count()`
- `backend/app/api/recipes.py` — Use combined method
- `backend/app/api/ingredients.py` — Use combined method
- `backend/app/api/tastings.py` — Use combined method
- `backend/app/api/outlets.py` — Use combined method

#### P2: Shared httpx Client for Storage

Each storage upload/delete created a new `httpx.AsyncClient`, establishing a fresh TCP connection per operation.

**Fix**: Module-level singleton `httpx.AsyncClient` via `get_http_client()`, reused across all `StorageService` instances. Client closed during app shutdown via `close_http_client()`.

**Files Modified**:
- `backend/app/domain/storage_service.py` — `get_http_client()`, `close_http_client()`, reuse client in upload/delete
- `backend/app/main.py` — Call `close_http_client()` during app shutdown

#### P2: Reduce Commits in Menu Fork/Update

Menu fork issued 10+ individual `session.commit()` calls — one per section, one per item batch, one per outlet link.

**Fix**: Replaced intermediate `session.commit()` with `session.flush()` to get auto-generated IDs. Single `session.commit()` at the end of the operation.

**Files Modified**:
- `backend/app/domain/menu_service.py` — `flush()` for intermediate operations, single final `commit()`

#### P2: Bounded Costing Cache

The costing cache was an unbounded `dict` that grew without limit, risking memory exhaustion in long-running processes.

**Fix**: Replaced with `cachetools.TTLCache(maxsize=256, ttl=300)` — automatic eviction at 256 entries, 5-minute TTL.

**Files Modified**:
- `backend/app/api/costing.py` — `TTLCache` replaces manual dict + timestamp logic
- `backend/pyproject.toml` — Added `cachetools>=5.3.0` dependency

---

## [0.0.22] - 2026-03-06

### Fixed

#### `/recipes/new` — Canvas Not Showing Up

When navigating to `/recipes/new` from a non-canvas tab (e.g., Overview), the `canvasTab` state retained its previous value. The canvas editor never rendered because `TabContent` dispatched to the stale tab.

**Fix**: Added `setCanvasTab('canvas')` in the `useEffect` of `recipes/new/page.tsx` to force the canvas tab active on mount.

**Files Modified**:
- `frontend/src/app/recipes/new/page.tsx` — Force canvas tab on mount

#### Client-Side Exception After Creating a Recipe

After `createRecipe` returned and `router.push` fired, the new page called `useRecipe(newId)` but there was no cache entry yet. Also, metadata was reset to defaults before navigation, causing a flash of stale data while the component was still mounted.

**Fix**:
- Seed the individual recipe cache in `useCreateRecipe.onSuccess` so `useRecipe(newId)` returns data immediately on navigation
- Removed premature state reset (`setStagedIngredients`, `setStagedRecipes`, `setMetadata(DEFAULT_METADATA)`) before `router.push` — the component unmounts during navigation anyway

**Files Modified**:
- `frontend/src/lib/hooks/useRecipes.ts` — Seed `['recipe', newRecipe.id]` cache in `onSuccess`
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Removed premature state reset before navigation

#### Existing Recipe Shows "Untitled Recipe" on Load

Metadata initialized to `DEFAULT_METADATA` (name: "Untitled Recipe"). The loading effect waited for ALL three queries (recipe + ingredients + subrecipes) before setting metadata. Recipe data loaded faster, but name stayed wrong until ingredients/subrecipes finished.

**Fix**: Added a separate eager `useEffect` that sets metadata from recipe data as soon as it's available, without waiting for ingredients/subrecipes.

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Eager metadata load from recipe data

#### Submit Button Enable/Disable Logic

The Submit/Save button had incorrect enable/disable logic: it required ingredients to exist (`hasItems`) even for metadata-only saves, and it didn't track whether there were unsaved changes on existing recipes.

**Fix**: Submit button now disabled when name is empty, when no unsaved changes exist on an existing recipe, or when user is not the owner. No longer requires ingredients/subrecipes to exist.

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Improved submit button disabled conditions

#### Tasting Session — Already-Added Recipes/Ingredients Hidden

`SessionRecipesSection` and `SessionIngredientsSection` filtered out already-added items entirely via `.filter()`. Users wanted them visible but disabled so they can see what's already been added.

**Fix**: Show all recipes/ingredients in the dropdown. Already-added ones get `disabled` attribute, grayed-out styling, and an "Added" badge. Prevent selection via `onClick` guard. Also applied the same pattern to ingredients section.

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Show already-added items as disabled with "Added" badge

#### Ingredient Tasting Endpoint Missing Ingredient Names

The `GET /{session_id}/ingredients` endpoint returned raw `IngredientTasting` models without ingredient names, forcing the frontend to cross-reference a separate ingredients list.

**Fix**: Created `IngredientTastingRead` DTO with `ingredient_name` field. Service layer now JOINs `Ingredient` table to populate names. Frontend uses `si.ingredient_name` directly instead of looking up from a separate list.

**Files Modified**:
- `backend/app/models/ingredient_tasting.py` — Added `IngredientTastingRead` DTO
- `backend/app/models/__init__.py` — Export `IngredientTastingRead`
- `backend/app/domain/ingredient_tasting_service.py` — JOIN query to include ingredient name
- `backend/app/api/ingredient_tastings.py` — Use `IngredientTastingRead` response model
- `frontend/src/types/index.ts` — Added `ingredient_name` to `IngredientTasting` type
- `frontend/src/app/tastings/[id]/page.tsx` — Use `si.ingredient_name` directly

#### Recipe Tasting Endpoint Missing Recipe Names

The `GET /{session_id}/recipes` endpoint returned raw `RecipeTasting` models without recipe names, forcing the frontend to cross-reference a separately-loaded paginated recipe list. Recipe names showed as "Recipe #ID" until the list finished loading.

**Fix**: Created `RecipeTastingRead` DTO with `recipe_name` field. Service layer now JOINs `Recipe` table to populate names. Frontend uses `sr.recipe_name` directly instead of looking up from `availableRecipes`.

**Files Modified**:
- `backend/app/models/recipe_tasting.py` — Added `RecipeTastingRead` DTO
- `backend/app/models/__init__.py` — Export `RecipeTastingRead`
- `backend/app/domain/recipe_tasting_service.py` — JOIN query to include recipe name
- `backend/app/api/recipe_tastings.py` — Use `RecipeTastingRead` response model
- `frontend/src/types/index.ts` — Added `recipe_name` to `RecipeTasting` type
- `frontend/src/app/tastings/[id]/page.tsx` — Use `sr.recipe_name` directly

### Changed

#### Tasting Session — Server-Side Search with Infinite Scrolling

Replaced client-side filtering (loading 30 recipes/ingredients upfront) with server-side search using `useInfiniteRecipes` and `useInfiniteIngredients`. Search is debounced (300ms) and results load incrementally via "Load more" button.

**Files Modified**:
- `frontend/src/app/tastings/[id]/page.tsx` — Lifted search state, debounced API calls, infinite scroll pagination
- `frontend/src/lib/hooks/useRecipes.ts` — Fixed infinite query key to `['recipes', 'infinite', params]` to avoid cache collisions
- `frontend/src/lib/hooks/useIngredients.ts` — Fixed infinite query key to `['ingredients', 'infinite', params]` to avoid cache collisions

---

## [0.0.21] - 2026-03-05

### Changed

#### Participant-Only Feedback Enforcement

Tasting note creation, editing, and deletion are now restricted to session participants only. Admins no longer bypass participant checks for feedback operations.

**Backend**:
- `tasting_notes.py` — Added `get_current_user` dependency to create, update, and delete note endpoints; only participants can add notes (403), only the original creator can edit/delete (403)
- `ingredient_tasting_notes.py` — Added participant check to create ingredient note endpoint
- `conftest.py` — Test fixtures now persist mock users in DB (required for participant lookups via `TastingUser` join)

**Frontend**:
- `tastings/[id]/r/[recipeId]/page.tsx` — Removed admin bypass from `isInvited`; removed `isAdmin` prop from `FeedbackNoteCard`; edit/delete buttons only shown for original poster
- `tastings/[id]/i/[ingredientId]/page.tsx` — Same participant-only and creator-only simplifications

**Tests**:
- `test_tastings.py` — Updated session creation to include `participant_ids`; added participant/non-participant/admin-non-participant feedback tests
- `test_ingredient_tasting_notes.py` — Added participant-only feedback tests; nonexistent session now returns 403
- `test_tasting_note_images.py` — Updated fixtures; added admin non-participant tests

#### Canvas Unit Price Auto-Conversion

Staged ingredients on the recipe canvas now store a `unitPrice` that auto-converts when the user changes units. Previously, unit cost was computed on-the-fly from suppliers each render and never adjusted for the display unit.

**Behavior**:
- When an ingredient is added → `unitPrice` initialized from `ingredient.cost_per_base_unit`
- When the user changes unit (e.g. g → kg) → `unitPrice` auto-converts via `convertUnitPrice()`
- When the user changes supplier → `unitPrice` recalculates from new supplier cost, converted to current display unit
- When suppliers load asynchronously → `unitPrice` updates to median supplier cost
- On save → `unitPrice` sent directly as `unit_price` with `base_unit` set to the display unit

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Added `unitPrice` to `StagedIngredient`; updated all creation sites, unit change handler, supplier change handler, cost display, submission logic, and `calculateCanvasCost`
- `frontend/src/lib/unitConversion.ts` — Added `convertUnitPrice()` utility (inverse of quantity conversion)
- `frontend/src/components/recipe/RecipeIngredientsList.tsx` — Unit change handler now recalculates `unit_price` via `convertUnitPrice()` and persists to backend

#### Selling Price Replaces Profit Margin

Canvas metadata `profit_margin` (percentage) replaced with `selling_price` (absolute dollar amount). Profit/loss per portion now computed as `selling_price - cost_per_portion` and displayed with color-coded badges (green for profit, red for loss).

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — `RecipeMetadata.selling_price` replaces `profit_margin`; selling price input and profit/loss display
- `frontend/src/types/index.ts` — Added `selling_price_est` to `CreateRecipeRequest`

### Fixed

#### Recipe Canvas Not Loading Existing Recipes

The canvas loading effect required the full `useRecipes()` paginated list to resolve before loading a selected recipe's ingredients. If the recipes list query was slow or failed, the canvas would appear empty even though the individual recipe data was available.

**Fix**: Added `useRecipe(selectedRecipeId)` to fetch the selected recipe directly. The loading effect no longer gates on the full recipes list — it proceeds as soon as `recipeIngredients` and `subRecipes` are available, using the single-recipe query for metadata.

**Files Modified**:
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Added `useRecipe` hook; removed `recipes` from loading gate; used `selectedRecipeData` for metadata with `recipes` list as fallback

---

## [0.0.20] - 2026-03-04

### Added

#### Server-Side Pagination

All major list endpoints now support server-side pagination with `page_number`, `page_size`, and `search` query parameters, returning a standardized `PaginatedResponse` envelope with `items`, `page_number`, `current_page_size`, `total_count`, and `total_pages`.

**Backend**:
- New `PaginatedResponse` generic model (`backend/app/models/pagination.py`) with `create()` factory method
- `IngredientListRead` slim DTO for paginated ingredient responses (excludes relationships)
- `RecipeListRead` lean DTO for paginated recipe responses (excludes heavy text fields)
- `list_paginated()` and `count()` methods added to all six services:
  - `IngredientService` — supports `search`, `category_ids`, `units`, `allergen_ids`, `is_halal` filters
  - `RecipeService` — supports `search`, `category_ids` filters with access control
  - `SupplierService` — supports `search`, `active_only` filters
  - `OutletService` — supports `search`, `is_active`, `accessible_ids` filters
  - `TastingSessionService` — supports `search` filter with batch participant loading
  - `RecipeCategoryService` — supports `search` filter
- Each service uses `_build_list_query()` pattern to share filtering logic between `list_paginated()` and `count()`
- Outlet list endpoint now performs access control filtering at the SQL level (via `accessible_ids`) instead of Python-side loop

**Paginated API Endpoints**:
- `GET /ingredients` — `page_number`, `page_size`, `search`, `category_ids`, `units`, `allergen_ids`, `is_halal`
- `GET /recipes` — `page_number`, `page_size`, `search`, `category_ids`
- `GET /suppliers` — `page_number`, `page_size`, `search`
- `GET /outlets` — `page_number`, `page_size`, `search`
- `GET /tasting-sessions` — `page_number`, `page_size`, `search`
- `GET /recipe-categories` — `page_number`, `page_size`, `search`

**Frontend**:
- New `Pagination` component (`frontend/src/components/ui/Pagination.tsx`) with prev/next navigation and "X-Y of Z" display
- New `useDebouncedValue` hook for search input debouncing
- `PaginatedResponse<T>` TypeScript type added to `types/index.ts`
- API client param interfaces: `ListParams`, `RecipeListParams`, `IngredientListParams`, `SupplierListParams`, `OutletListParams`
- All list API functions (`getRecipes`, `getIngredients`, `getSuppliers`, `getOutlets`, `getTastingSessions`, `getRecipeCategories`) updated to accept pagination params and return `PaginatedResponse<T>`
- TanStack Query hooks updated to pass pagination params as query keys
- List pages updated to use pagination controls and server-side search

**Files Created**:
- `backend/app/models/pagination.py` — `PaginatedResponse` generic model
- `frontend/src/components/ui/Pagination.tsx` — Pagination UI component
- `frontend/src/lib/hooks/useDebouncedValue.ts` — Debounced value hook

**Files Modified**:
- `backend/app/api/ingredients.py` — Paginated list endpoint with filters
- `backend/app/api/recipes.py` — Paginated list endpoint with search and category filters
- `backend/app/api/suppliers.py` — Paginated list endpoint
- `backend/app/api/outlets.py` — Paginated list endpoint with SQL-level access control
- `backend/app/api/tastings.py` — Paginated list endpoint
- `backend/app/api/recipe_categories.py` — Paginated list endpoint
- `backend/app/domain/ingredient_service.py` — `list_paginated()`, `count()`, `_build_list_query()`, accessible outlet ID caching
- `backend/app/domain/recipe_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/supplier_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/outlet_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/tasting_session_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/domain/recipe_category_service.py` — `list_paginated()`, `count()`, `_build_list_query()`
- `backend/app/models/ingredient.py` — Added `IngredientListRead` DTO
- `backend/app/models/recipe.py` — Added `RecipeListRead` DTO, indexed `owner_id` and `root_id`
- `backend/app/models/__init__.py` — Updated exports
- `backend/tests/test_ingredients.py` — Updated for paginated response shape
- `backend/tests/test_recipes.py` — Updated for paginated response shape
- `frontend/src/lib/api.ts` — Pagination param interfaces and updated list functions
- `frontend/src/lib/hooks/useRecipes.ts` — Pagination query key support
- `frontend/src/lib/hooks/useIngredients.ts` — Pagination query key support
- `frontend/src/lib/hooks/useSuppliers.ts` — Pagination query key support
- `frontend/src/lib/hooks/useOutlets.ts` — Pagination query key support
- `frontend/src/lib/hooks/useTastings.ts` — Pagination query key support
- `frontend/src/lib/hooks/useRecipeCategories.ts` — Pagination query key support
- `frontend/src/types/index.ts` — `PaginatedResponse<T>` type
- Multiple frontend pages updated for pagination UI

### Performance

#### Database Indexes & Connection Pooling

**Database Changes**:
- Added indexes on `Recipe.owner_id` and `Recipe.root_id` for faster access-control and version-tree queries
- Alembic migration `2682e67b2782_add_indexes_recipe_owner_id_root_id.py`

**Connection Pooling** (PostgreSQL):
- `pool_size=20`, `max_overflow=40`, `pool_recycle=3600`, `pool_pre_ping=True`
- SQLite skips pool configuration automatically

**Caching**:
- `IngredientService._accessible_outlet_ids_cache` — Per-request cache for outlet hierarchy lookups, avoiding repeated tree walks

**Files Modified**:
- `backend/app/database.py` — Connection pool configuration
- `backend/app/domain/ingredient_service.py` — Outlet ID caching

#### Next.js & Frontend Optimization

- Image format optimization: `formats: ["image/avif", "image/webp"]` in next.config.ts
- Package import optimization: `optimizePackageImports` for `@/lib/hooks`, `lucide-react`, `@tanstack/react-query`
- Static asset caching: `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/*`
- Compression enabled: `compress: true`
- Production source maps disabled: `productionBrowserSourceMaps: false`
- Removed 84 lines of duplicate dark mode CSS from `globals.css` (auto-dark-mode block already handled by `.dark` class)

**Files Modified**:
- `frontend/next.config.ts` — Image formats, package optimization, caching headers, compression
- `frontend/src/app/globals.css` — Removed redundant dark mode styles

**Files Created**:
- `backend/alembic/versions/2682e67b2782_add_indexes_recipe_owner_id_root_id.py`

---

## [0.0.19] - 2026-03-03

### Changed

#### Outlet-Scoped Supplier Ingredients

Supplier-ingredient links are now scoped per-outlet via a new `outlet_id` column on `supplier_ingredients`. Each supplier pricing entry belongs to a specific outlet, enabling different outlets to maintain independent supplier pricing for the same ingredient.

**Database Changes**:
- New `outlet_id` column on `supplier_ingredients` (FK to `outlets.id`, NOT NULL, indexed)
- Unique constraint updated from `(ingredient_id, supplier_id)` to `(ingredient_id, supplier_id, outlet_id)` — same supplier can serve same ingredient at different outlets with different pricing
- Alembic migration `g2h3i4j5k6l7` with backfill for existing rows

**Backend**:
- `SupplierIngredient` model includes `outlet_id` field with `Outlet` relationship
- `SupplierIngredientCreate` requires `outlet_id`; `SupplierIngredientUpdate` allows optional `outlet_id` change
- `SupplierIngredientRead` returns `outlet_id` and `outlet_name`
- Duplicate check now includes `outlet_id` in the uniqueness tuple

#### Hierarchical Outlet Access Control for Supplier Ingredients

Supplier-ingredient queries now respect the user's outlet hierarchy tree. Non-admin users only see supplier-ingredient links belonging to outlets in their tree (root → descendants).

**Backend**:
- `get_accessible_outlet_ids()` utility walks up to root then BFS down to collect all outlet IDs in the user's tree
- `get_ingredient_suppliers()`, `get_preferred_supplier()`, and `get_supplier_ingredients()` filter by accessible outlet IDs for non-admin users
- Admin users bypass filtering and see all supplier-ingredient links
- Non-admin users without an outlet see no supplier-ingredient data
- Only admins can change `outlet_id` on existing supplier-ingredient links (403 for non-admins)

**Files Created**:
- `backend/alembic/versions/g2h3i4j5k6l7_add_outlet_id_to_supplier_ingredients.py`
- `backend/tests/test_supplier_ingredient_outlet_scope.py` — 7 tests covering child-sees-parent, parent-sees-child, admin-sees-all, no-outlet isolation, cross-tree isolation, supplier endpoint filtering, and non-admin outlet change restriction

**Files Modified**:
- `backend/app/models/supplier_ingredient.py` — `outlet_id` field, updated unique constraint, `Outlet` relationship, DTOs
- `backend/app/domain/ingredient_service.py` — `get_accessible_outlet_ids()`, outlet filtering in queries
- `backend/app/domain/supplier_service.py` — Outlet filtering in `get_supplier_ingredients()`
- `backend/app/api/ingredients.py` — `get_current_user` dependency, outlet filtering params, admin-only outlet change guard
- `backend/app/api/suppliers.py` — `get_current_user` dependency, outlet filtering params
- `backend/tests/test_ingredients.py` — All supplier tests updated with `outlet_id`
- `backend/tests/test_suppliers.py` — Supplier ingredient tests updated with `outlet_id`

### Added

#### Outlet Selector in Supplier-Ingredient Forms

Frontend forms for adding supplier-ingredient links now include an outlet picker. Non-admin users have their outlet auto-selected and locked; admins can choose any outlet.

**Frontend**:
- Ingredient detail page (`/ingredients/[id]`) — outlet dropdown in add-supplier modal, outlet column in suppliers table
- Supplier detail page (`/suppliers/[id]`) — outlet dropdown in add-ingredient modal, outlet column in ingredients table
- `AddIngredientModal` — outlet picker per supplier entry
- Auth state (`store.tsx`) stores `outletId` from login response, persisted in localStorage
- Login page passes `outlet_id` to auth store

**Files Modified**:
- `frontend/src/app/ingredients/[id]/page.tsx` — Outlet selector and table column
- `frontend/src/app/suppliers/[id]/page.tsx` — Outlet selector and table column
- `frontend/src/components/ingredients/AddIngredientModal.tsx` — Outlet picker per supplier entry
- `frontend/src/lib/store.tsx` — `outletId` in auth state, login, logout, persistence
- `frontend/src/app/login/page.tsx` — Passes `outlet_id` from login response
- `frontend/src/types/index.ts` — `outlet_id` and `outlet_name` on `SupplierIngredient` type

---

## [0.0.18] - 2026-03-02

### Changed

#### Tasting Session Creator Tracking

Added `creator_id` column to tasting sessions, establishing explicit ownership of who created each session. Creators now have the same access privileges as participants.

**Database Changes**:
- New `creator_id` column on `tasting_sessions` (FK to `users.id`, nullable, indexed, SET NULL on delete)
- Legacy `attendees` JSON column dropped (replaced by `tasting_users` join table in 0.0.16)

**Backend**:
- `TastingSession` model includes `creator_id` field
- `TastingSessionRead` returns `creator_id` in API responses
- Service layer sets `creator_id` from authenticated user during session creation
- Access control updated: admins, creators, and participants can all access sessions

**Frontend**:
- Session detail page (`/tastings/[id]`) checks `creator_id` for access control
- Recipe tasting page (`/tastings/[id]/r/[recipeId]`) uses creator-based access check
- Ingredient tasting page (`/tastings/[id]/i/[ingredientId]`) uses creator-based access check
- 403 error handling displays "Access Denied" with back-navigation link

**Files Created**:
- `backend/alembic/versions/e1f2g3h4i5j6_add_creator_id_to_tasting_sessions.py`

**Files Modified**:
- `backend/app/models/tasting.py` — Added `creator_id` to model and read DTO
- `backend/app/domain/tasting_session_service.py` — Creator ID set on create
- `backend/app/api/tastings.py` — Access control includes creator check
- `backend/tests/test_tastings.py` — Tests assert `creator_id` in responses
- `frontend/src/app/tastings/[id]/page.tsx` — Creator-based access check
- `frontend/src/app/tastings/[id]/r/[recipeId]/page.tsx` — Creator-based access check
- `frontend/src/app/tastings/[id]/i/[ingredientId]/page.tsx` — Creator-based access check
- `frontend/src/types/index.ts` — Added `creator_id` to `TastingSession` type

#### Simplified Participant Management (ID-Based)

Replaced email-based `attendees` field with direct `participant_ids` (user ID array) on create/update DTOs. Removes email-to-user resolution overhead.

**Changes**:
- `TastingSessionCreate` and `TastingSessionUpdate` accept `participant_ids: List[str]` instead of `attendees: List[str]`
- Service layer creates `TastingUser` rows directly by user ID (no email lookup)
- Frontend sends user IDs from `ParticipantPicker` component directly

**Files Modified**:
- `backend/app/models/tasting.py` — Schema DTOs use `participant_ids`
- `backend/app/domain/tasting_session_service.py` — Direct ID-based participant creation
- `frontend/src/app/tastings/new/page.tsx` — Sends `participant_ids` from selected users
- `frontend/src/app/tastings/[id]/page.tsx` — Updates participants via `participant_ids`

### Added

#### Quick-Add Ingredient from Search

Added a quick-create shortcut in the RightPanel ingredient library — when a search term yields no matches, a "Add [term]" button appears to instantly create the ingredient with auto-categorization.

**Features**:
- Quick-add button appears when search has no matching ingredients
- Auto-categorizes via AI category agent during creation
- Loading overlay with spinner during ingredient creation
- Tabs and search disabled while creation is in progress
- Created ingredient uses default unit `g` and no cost (editable later)

**Files Modified**:
- `frontend/src/components/layout/RightPanel.tsx` — Quick-add flow with loading state

#### Past-Date Invitation Guard

SMS/email invitations are now skipped when the tasting session date is in the past, preventing unnecessary sends for historical sessions.

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Early return with `email_count: 0, sms_count: 0` for past sessions

#### Supplier-Ingredient Normalization (JSONB → Join Table)

Replaced the `suppliers` JSONB column on the `Ingredient` model with a proper `supplier_ingredients` join table, normalizing the supplier-ingredient relationship for better data integrity, querying, and referential constraints.

**Database Changes**:
- New `supplier_ingredients` table with FK constraints to `ingredients` and `suppliers`
- Unique constraint on `(ingredient_id, supplier_id)` prevents duplicates
- Unique constraint on `sku` for SKU-level deduplication
- Indexes on `ingredient_id` and `supplier_id` for efficient lookups
- Dropped `suppliers` JSONB column from `ingredients` table
- Dropped unused `sort_order` column from `recipe_ingredients` table

**Backend**:
- New `SupplierIngredient` model with `SupplierIngredientCreate`, `SupplierIngredientUpdate`, and `SupplierIngredientRead` DTOs
- `IngredientService` rewritten: supplier CRUD now operates on `supplier_ingredients` rows instead of JSONB array manipulation
- `SupplierService.get_supplier_ingredients()` uses JOIN query with `selectinload` instead of scanning all ingredients
- `CostingService` updated: looks up `SupplierIngredient` row by `(ingredient_id, supplier_id)` to derive unit price from `price_per_pack / pack_size`
- Removed `SupplierEntry`, `SupplierEntryCreate`, `SupplierEntryUpdate` schemas from ingredient model
- API endpoints now return `SupplierIngredientRead` DTOs with nested `supplier_name` and `ingredient_name`

**Frontend**:
- `SupplierIngredient` type replaces `IngredientSupplierEntry`, `AddIngredientSupplierRequest`, `UpdateIngredientSupplierRequest`, and `SupplierIngredientEntry`
- API client updated: supplier CRUD functions use numeric `supplierIngredientId` instead of string `supplierId`
- Ingredient detail page (`/ingredients/[id]`) updated for new supplier data shape
- Supplier detail page (`/suppliers/[id]`) updated for `SupplierIngredient` response type
- `AddIngredientModal` simplified (no longer passes suppliers on create)
- Canvas supplier selection: `StagedIngredientCard` shows supplier dropdown with per-unit cost calculation
- `RecipeIngredientRow` and `RecipeIngredientsList` updated for removed `sort_order` field
- Removed `ReorderIngredientsRequest` type and `reorderRecipeIngredients` API function

**Files Created**:
- `backend/app/models/supplier_ingredient.py` — `SupplierIngredient` model and DTOs
- `backend/alembic/versions/f1g2h3i4j5k6_refactor_supplier_ingredients.py` — Migration

**Files Modified**:
- `backend/app/models/ingredient.py` — Removed JSONB `suppliers` field and `SupplierEntry` schemas
- `backend/app/models/supplier.py` — Added `supplier_ingredients` relationship
- `backend/app/models/recipe_ingredient.py` — Removed `sort_order` field
- `backend/app/models/__init__.py` — Updated exports
- `backend/app/domain/ingredient_service.py` — Rewritten supplier CRUD
- `backend/app/domain/supplier_service.py` — JOIN-based ingredient lookup
- `backend/app/domain/costing_service.py` — Supplier-aware unit price resolution
- `backend/app/domain/recipe_service.py` — Removed sort_order references
- `backend/app/api/ingredients.py` — Updated supplier endpoints
- `backend/app/api/recipe_ingredients.py` — Removed reorder endpoint
- `backend/app/api/suppliers.py` — Updated response model
- `backend/scripts/seed_ingredients.py` — Updated for new supplier model
- `backend/tests/test_ingredients.py` — Expanded supplier CRUD tests
- `backend/tests/test_recipes.py` — Updated for removed sort_order
- `backend/tests/test_suppliers.py` — Updated for SupplierIngredient response
- `frontend/src/types/index.ts` — Consolidated supplier types
- `frontend/src/lib/api.ts` — Updated supplier API functions
- `frontend/src/lib/hooks/useIngredients.ts` — Updated hook types
- `frontend/src/lib/hooks/useRecipeIngredients.ts` — Removed reorder hook
- `frontend/src/lib/hooks/useSuppliers.ts` — Updated for SupplierIngredient
- `frontend/src/app/ingredients/[id]/page.tsx` — Updated supplier UI
- `frontend/src/app/suppliers/[id]/page.tsx` — Updated ingredient list UI
- `frontend/src/components/ingredients/AddIngredientModal.tsx` — Simplified
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Supplier dropdown + cost calc
- `frontend/src/components/recipe/RecipeIngredientRow.tsx` — Removed sort_order
- `frontend/src/components/recipe/RecipeIngredientsList.tsx` — Removed sort_order

---

## [0.0.17] - 2026-02-27

### Changed

#### Canvas Layout Redesign

Replaced game-card styled components with clean, compact list-item design across the recipe canvas for a more professional, minimal look.

**Changes**:
- RightPanel (ingredient palette) redesigned with compact list-item rows instead of large cards
- CanvasTab overhauled with streamlined, minimal UI for recipe ingredients and sub-recipes
- TopAppBar tabs switched to pill-style design for cleaner navigation
- Tabs hidden on new recipe page until recipe is saved
- Menu preview always shows substitution field for consistency

**Files Modified**:
- `frontend/src/components/layout/RightPanel.tsx` — List-item redesign
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Compact ingredient/sub-recipe UI
- `frontend/src/components/layout/CanvasLayout.tsx` — Layout adjustments
- `frontend/src/components/layout/TopAppBar.tsx` — Pill-style tabs
- `frontend/src/app/recipes/new/page.tsx` — Hide tabs on new recipe
- `frontend/src/app/menu/preview/[id]/page.tsx` — Always show substitution field

#### Supplier UI Polish

Enhanced supplier management interface with unarchive support, visual indicators, and better text handling.

**Changes**:
- Supplier unarchive/restore functionality with ArchiveRestore icon button
- `OverflowTooltip` component for truncated text with hover titles
- "Archived" badge displayed on inactive suppliers in both card and list views
- `is_active` field added to `UpdateSupplierRequest` type for reactivation
- Navigation labels visible at `xl` breakpoint (down from `2xl`) for better usability

**Files Modified**:
- `frontend/src/app/suppliers/page.tsx` — Unarchive actions and archived badges
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Archived badge in list view
- `frontend/src/components/layout/TopNav.tsx` — Nav label breakpoint change
- `frontend/src/types/index.ts` — Added `is_active` to update type

### Added

#### Menu Publish/Unpublish

Added publish and unpublish workflow for menus, enabling status management from draft to published state.

**Features**:
- `POST /menus/{id}/publish` and `POST /menus/{id}/unpublish` backend endpoints
- Service-layer `publish_menu()` and `unpublish_menu()` methods
- `usePublishMenu` and `useUnpublishMenu` frontend hooks
- Status toggle UI on menu management page with visual publish state indicator

**Files Modified**:
- `backend/app/api/menus.py` — Publish/unpublish endpoints
- `backend/app/domain/menu_service.py` — Publish/unpublish service methods
- `frontend/src/app/menu/page.tsx` — Status toggle UI
- `frontend/src/lib/api.ts` — API client methods
- `frontend/src/lib/hooks/useMenus.ts` — Mutation hooks

#### Supplier Endpoint Tests

Added comprehensive test coverage for supplier API endpoints.

**Tests**:
- 11 new tests covering deactivate, reactivate, `active_only` filtering, and 404 error cases
- Validates soft-delete and restore behavior end-to-end

**Files Created**:
- `backend/tests/test_suppliers.py` — 11 supplier endpoint tests

### Performance

#### Backend Query Optimization

Eliminated N+1 query patterns across multiple services with batch fetching and SQL-level filtering.

**Optimizations**:
- **Outlet hierarchy/cycle detection** — Replaced recursive single-row fetches with batch `SELECT IN` queries in `outlet_service.py`
- **BOM tree** — Batch-loaded sub-recipe links and recipes in `subrecipe_service.py` instead of per-node queries
- **Tasting session participants** — Single JOIN query to load all participants with user details in `tasting_session_service.py`
- **Recipe list access control** — SQL-level subquery filtering replaces Python-side loop filtering in `recipe_service.py`; removed debug print statements from recipe access control
- **Recipe access control cleanup** — Removed debug `print()` statements from `recipes.py` router

**Files Modified**:
- `backend/app/domain/outlet_service.py` — Batch hierarchy queries
- `backend/app/domain/subrecipe_service.py` — Batch BOM tree loading
- `backend/app/domain/tasting_session_service.py` — JOIN-based participant loading
- `backend/app/domain/recipe_service.py` — SQL subquery access filtering
- `backend/app/api/recipes.py` — Removed debug prints

#### Frontend Caching & Memoization

Optimized React rendering and TanStack Query cache behavior to reduce unnecessary re-renders and API calls.

**Optimizations**:
- **`RecipeIngredientRow`** — Wrapped with `React.memo` and memoized supplier options to prevent re-renders on parent state changes
- **Recipe ID stabilization** — Stabilized recipe ID references in `RecipeManagementTab` to avoid cascading re-renders
- **Scoped cache invalidation** — Cache invalidation for outlets and tasting notes scoped to specific IDs instead of broad invalidation
- **Increased stale time** — TanStack Query stale time increased from default to 5 minutes to reduce refetch frequency

**Files Modified**:
- `frontend/src/components/recipe/RecipeIngredientRow.tsx` — `React.memo` wrapper
- `frontend/src/components/recipes/RecipeManagementTab.tsx` — Stable ID refs
- `frontend/src/lib/hooks/useRecipeOutlets.ts` — Scoped invalidation
- `frontend/src/lib/hooks/useTastings.ts` — Scoped invalidation
- `frontend/src/lib/providers.tsx` — 5-minute stale time

---

## [0.0.16] - 2026-02-26

### Added

#### SMS Invitations for Tasting Sessions

Integrated Twilio SMS delivery for tasting session invitations, providing multi-channel communication alongside email.

**Features**:
- Twilio SMS integration for sending SMS invitations to tasting session participants
- Parallel email (SendGrid) and SMS (Twilio) delivery in single API call
- Graceful degradation if Twilio not configured—falls back to email-only without errors
- SMS includes session name, date, location, and invite link in plain text format
- Participant phone numbers managed through `TastingParticipant` type with optional `phone_number` field
- API response includes `email_count` and `sms_count` for delivery transparency

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Added Twilio integration
- `frontend/src/lib/hooks/useSendTastingInvitation.ts` — Updated recipient type and response schema
- `frontend/src/app/tastings/new/page.tsx` — Updated invitation caller to pass phone numbers
- `frontend/package.json` — Added `twilio` dependency

**Environment Variables**:
- `TWILIO_ACCOUNT_SID` — Twilio account identifier
- `TWILIO_AUTH_TOKEN` — Twilio authentication token
- `TWILIO_FROM_NUMBER` — Twilio phone number for sending SMS

#### Tasting Session Participant Association

Replaced email-based attendee lists with proper user-session relationships via `TastingUser` join table.

**Features**:
- `TastingUser` many-to-many join table links users to tasting sessions
- `TastingUserRead` DTO displays participant names and emails from User table (instead of email strings)
- Email-to-user resolution in service layer (`_resolve_attendees_to_users()`) with silent skipping of unregistered emails
- Access control: non-admin users can only access sessions they participate in (403 Forbidden otherwise)
- Admin users bypass participant check for unrestricted access
- Backward compatibility: `attendees` field retained on request DTOs for wire compatibility

**Database Changes**:
- New `TastingUser` model as join table
- Alembic migration creates `tasting_users` table
- Cascade delete on session deletion, SET NULL on user deletion
- Unique constraint on (session_id, user_id) prevents duplicate participation

**API Changes**:
- All tasting endpoints return `TastingSessionRead` with `participants: List[TastingUserRead]`
- Non-admin GET/PATCH/DELETE now require user participation or admin status
- Email lookup happens transparently during create/update operations

**Frontend**:
- New `ParticipantPicker` component for user selection during session creation
- Uses existing `useUsers()` hook for user lookup
- Supports search by username or email
- Displays selected user badges with removal capability

**Test Coverage**:
- 26/26 tests passing with participant resolution and access control validation
- Tests verify unregistered email skipping and admin access override

**Files Modified**:
- `backend/app/models/tasting.py` — Added `TastingUser` and `TastingUserRead`
- `backend/app/domain/tasting_session_service.py` — Service layer improvements
- `backend/app/api/tastings.py` — API router updates with access control
- `backend/tests/test_tastings.py` — Comprehensive test coverage

#### Menu Management Enhancements

Enhanced menu builder with drag-and-drop reordering and new editable metadata fields.

**Features**:
- Drag-and-drop reordering for menu sections and individual menu items
- Real-time order number updates during drag operations
- New `key_highlights` textarea field for signature items, seasonal specials, etc. (appears first)
- New `additional_info` textarea field for dietary notes, preparation tips, etc. (appears second)
- `DraggableSection` component wrapper for section-level drag handling
- `DraggableItem` component wrapper for item-level drag handling
- Visual feedback with opacity changes during drag operations
- Grip icons for clear drag handles
- Support for both create mode (no IDs) and update mode (with existing IDs)

**Components**:
- `MenuBuilder.tsx` — Main component managing drag-drop state and operations
- `DraggableSection` — Section wrapper with drag handle
- `DraggableItem` — Item wrapper with drag handle
- Proper type handling for `MenuItem` model fields

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — Full drag-and-drop implementation

---

## [0.0.15] - 2026-02-23

### Added

#### Admin User Management & Route Access Control

Implemented admin user management system with role-based access control to protect admin-only routes.

**Features**:
- Admin user model and database support
- Admin identification in user authentication
- Protected admin routes with access control checks
- Fix for infinite loop on admin pages for non-admin users

#### Hierarchical Outlet-Based Access Control

Implemented comprehensive outlet hierarchy-based access control system for recipes and tasting sessions.

**Features**:
- Hierarchical outlet-based recipe filtering
- User access restricted to outlets within their hierarchy
- Recipe access control based on user outlet assignment
- Read-only mode for users without edit permissions
- Outlet hierarchy validation for access checks

**API Enhancements**:
- Enhanced recipe endpoints with outlet-based filtering
- Tasting session endpoints with user hierarchy access control
- Outlet hierarchy tree support for permission validation

#### Allergen Management System

Complete allergen tracking and display system for ingredients and recipes.

**New Features**:
- Allergen field on `Ingredient` model for tracking allergen information
- Allergen display across recipe views (ingredients panel, recipe detail, BOM)
- Ingredient allergen data management through ingredient detail UI
- Hierarchical allergen display in recipe sub-recipes and BOM tree

**Files Created/Modified**:
- Ingredient model extended with allergen field
- Recipe/ingredient components updated to display allergens
- Allergen badges in ingredient lists and recipe views

#### Supplier Soft Delete

Implemented soft delete functionality for suppliers to maintain referential integrity.

**Features**:
- Soft delete support for supplier records
- Archived suppliers remain available for historical reference
- Deactivation logic prevents orphaning ingredient-supplier links

### Fixed

- **JWT Token Regeneration**: Fixed token refresh endpoint to properly handle JWT token regeneration
- **Tasting Notes Access**: Allow tasting notes to be accessible regardless of recipe permissions (users can view tasting history even without full recipe edit access)
- **Admin Page Infinite Loop**: Fixed infinite loop occurring on admin pages for non-admin users

---

## [0.0.14] - 2026-02-12

### Added

#### Parent Outlet Recipes Display (Plan 06)

Implemented read-only display of parent outlet recipes linked to child outlets within the outlet hierarchy.

**Features**:
- Parent outlet recipes displayed in dedicated table on outlet detail page
- Read-only view showing all recipes from parent outlet(s)
- Supports multi-level hierarchy visualization
- Non-editable display to prevent accidental modifications

**Files Modified**:
- `frontend/src/components/outlets/OutletDetail.tsx`
- `frontend/src/app/outlets/[id]/page.tsx`

---

## [0.0.13] - 2026-01-28

### Added

#### Ingredient Tasting Features

Complete standalone tasting note system for individual ingredients, separate from recipe tasting sessions.

**New Features**:
- Standalone tasting notes for ingredients with ratings and feedback
- Image support for ingredient tasting notes (upload, view, delete)
- Auto-categorization via ingredient category agent
- Display of tasting history on ingredient detail pages

**UI Enhancements**:
- Ingredient tasting notes panel in ingredient detail view
- Image upload with preview and management
- Integration with existing tasting note images infrastructure

#### Canvas & Input Enhancements

**Text-Based Ingredient Addition**:
- Add ingredients directly by typing text in canvas ingredient panel
- Alternative to drag-and-drop workflow for rapid entry
- Automatic ingredient lookup and linking

**Right Panel Collapsibility**:
- Horizontal collapsible right panel (ingredient palette)
- Improved canvas real estate for larger ingredient displays
- Persistent collapse state

**Display Improvements**:
- Show usernames instead of user IDs in recipe overview
- Display parent outlet names instead of IDs in outlet management
- Image URL denormalization in Recipe model for optimized display
- Add missing `is_halal` property to fallback Ingredient objects

**Fixes**:
- Fixed overlapping items in Canvas card view layout
- Fixed ingredient/recipe dropdown table functionality
- Fixed category cache invalidation on ingredient creation

**Files Created/Modified**:
- `frontend/src/components/ingredients/IngredientTastingPanel.tsx`
- `frontend/src/hooks/useIngredientTasting.ts`
- Updated CanvasTab, RightPanel, and ingredient detail components

---

## [0.0.12] - 2026-01-21

### Added

#### Wastage Tracking & Recipe Costing

Integrated wastage percentage tracking into recipe ingredients with full cost impact calculations.

**Features**:
- Recipe ingredients track `wastage_percentage` (0-100) field
- Wastage percentage displayed in ingredient table with inline editing
- Cost calculations automatically factor in wastage
- `adjusted_cost_per_unit` reflects final cost including wastage impact

#### Multi-Image Recipe Gallery

Complete multi-image support for recipes with main image selection and carousel display.

**New Models/Features**:
- `RecipeImage` model with `is_main` flag and `order` field
- Multiple images per recipe with sequence ordering
- Main image selection UI in recipe overview
- Image carousel display on recipe cards and detail pages
- Automatic main image fallback if not explicitly set

**Migration**: Added RecipeImage table with indexes

#### Recipe Enhancements

**R&D Workflow Flags**:
- `rnd_started` flag — Marks when R&D work begins on a recipe
- `review_ready` flag — Indicates recipe is ready for review/approval
- Toggle controls in recipe overview tab

**Recipe Description Editing**:
- In-line description editing in Overview tab
- Markdown support in descriptions
- Auto-save on blur

**Profit Margin & Selling Price**:
- Calculate and display profit margin in canvas tab
- Recommended selling price based on cost + markup
- Configurable profit margin inputs
- Cost price denormalization on recipe save

#### Outlet Management Enhancements

**Outlet Hierarchy & Cycle Detection**:
- Implement parent-child relationships between outlets
- Cycle detection prevents circular hierarchies
- Outlet hierarchy tree visualization
- Deactivation of outlets with cascade considerations

**Recipe-Outlet Management UI**:
- Assign recipes to multiple outlets
- Per-outlet activation status
- Per-outlet price overrides
- Outlet badges on recipe cards
- Detail page outlet management tab

#### UI/UX Improvements

**Grid/List View Toggle**:
- Implement across inventory pages (ingredients, recipes, suppliers)
- Persistent view preference storage
- Card view (grid) and list view options
- Optimized layouts for each view type

**AI Feedback Summary**:
- AI-powered tasting feedback summarization endpoint
- Integration in recipe overview tab
- Manual trigger button for feedback generation
- Summary display and editing

**Files Created/Modified**:
- `backend/app/models/recipe_image.py`
- `backend/app/domain/recipe_image_service.py`
- `backend/app/api/recipe_outlets.py`
- Frontend components for outlet management and grid/list toggle
- Canvas tab enhancements for profit margin and cost price

#### Fixes

- Fixed routing to new canvas page
- Fixed Supabase storage mock in tests
- Fixed type errors for recipe page in R&D
- Fixed CanvasTab submit button display issues
- Fixed RightPanel disappearance bugs
- Resolve TypeScript and ESLint errors in frontend
- Fixed recipe description display in individual recipe page

---

## [0.0.11] - 2026-01-23

### Added

#### User Authentication System (Complete Integration)

Full Supabase authentication integration with user roles and session management.

**Features**:
- Supabase Auth login/logout functionality
- JWT token management (access + refresh tokens)
- User role support (normal/admin)
- Outlet assignment per user
- AuthGuard component for route protection
- Session expiration handling with auto-refresh

**New Frontend Pages**:
- `/login` — Login page with Supabase integration
- `/register` — Registration page
- Home page redirect based on auth state

**New Backend Endpoints**:
- `POST /auth/login` — Login with email/password
- `POST /auth/register` — Register new user
- `POST /auth/refresh` — Refresh JWT token

**New Models**:
- `User` model with email, username, user_type, outlet_id reference

**Files Created**:
- `backend/app/domain/supabase_auth_service.py`
- `backend/app/domain/user_service.py`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`

#### Recipe Category Management

Complete category system for organizing and filtering recipes.

**New Models**:
- `RecipeCategory` — Recipe category definition with name, description
- `RecipeRecipeCategory` — Junction table for recipe-category many-to-many relationships

**New API Endpoints** (7 total):
- `/recipe-categories` — CRUD for recipe categories
- `/recipe-recipe-categories` — CRUD for recipe-category links
- `/recipe-recipe-categories/recipe/{recipe_id}` — Get categories for recipe
- `/recipe-recipe-categories/category/{category_id}` — Get recipes in category

**New Frontend Pages**:
- `/recipe-categories` — Category list and management
- `/recipe-categories/[id]` — Category detail with recipe management

**UI Components**:
- `RecipeCategoryCard` — Category display card
- `RecipeCategoryFilterButtons` — Filter buttons for category selection
- `AddRecipeCategoryModal` — Modal for creating/editing categories
- Recipe category badges on recipe cards

**Features**:
- Assign multiple categories to recipes
- Filter recipes by category
- Add/edit/delete recipe categories
- View recipes grouped by category

#### Tasting Note Image Management

Integrated image upload and management for tasting note entries.

**Features**:
- Multiple images per tasting note
- Drag-and-drop image upload with preview
- Base64 encoding for storage
- Supabase Storage integration for persistent storage
- Batch sync operations (add/update/delete)
- Collapsible image gallery view on tasting pages

**New Endpoint**:
- `POST /tasting-note-images/sync/{tasting_note_id}` — Atomic sync operation

**UI Component**:
- `ImageUploadPreview` — Reusable image upload component

#### Branding Updates

Updated application branding and logo references throughout the codebase.

**Changes**:
- Updated logo assets and references
- Consistent branding across pages
- Updated documentation references

**Files Modified**:
- Navigation components
- Layout files
- Documentation (README, CLAUDE.md)

#### Fixes

- Removed `any` types from auth pages
- Added `AuthApiError` interface for type safety
- Show recipe description on individual recipe R&D page
- Improved error handling in auth flows

---

## [0.0.10] - 2025-12-18

### Added

#### Tasting Notes Feature (Plan 05)

Complete R&D feedback tracking system for recipe tasting sessions.

**New Models**:
- `TastingSession` — Tasting event with name, date, location, attendees
- `TastingNote` — Per-recipe feedback with 1-5 star ratings, decision, action items
- `TastingDecision` — Enum: `approved`, `needs_work`, `rejected`
- `RecipeTastingSummary` — Aggregated tasting data for a recipe

**New Database Tables**:
- `tasting_sessions` — with indexes on date and name
- `tasting_notes` — with indexes on session_id and recipe_id, cascade delete

**New API Endpoints** (13 total):
- `/tasting-sessions` — CRUD for tasting sessions
- `/tasting-sessions/{id}/stats` — Session statistics
- `/tasting-sessions/{id}/notes` — CRUD for notes within a session
- `/recipes/{id}/tasting-notes` — Recipe's tasting history
- `/recipes/{id}/tasting-summary` — Recipe's aggregated summary

**New Frontend Pages**:
- `/tastings` — List of all tasting sessions with search
- `/tastings/new` — Create new session form
- `/tastings/[id]` — Session detail with notes, ratings, and editing

**Recipe Detail Integration**:
- Added "Tasting History" section showing recent tastings
- Displays average rating, decision badges, feedback excerpts
- Links to full tasting session

**UI Enhancements**:
- Added `destructive` variant to Badge component
- Added "Tastings" to TopNav with Wine icon
- Star rating component with 1-5 interactive stars

**Migration**: `c3d4e5f6g7h8_add_tasting_tables.py`

**Docs**: `docs/completions/plan-05-tasting-notes.md`

---

## [0.0.9] - 2025-12-17

### Fixed

#### Enum-to-VARCHAR Mismatch

The `/api/v1/ingredients` endpoint was returning 500 errors due to a mismatch between Python Enum types and database VARCHAR storage.

**Root Cause**: The Alembic migration created `category` and `source` as VARCHAR columns, but the SQLModel used Python Enums without explicit `sa_column`. SQLModel interpreted these as native PostgreSQL ENUMs using member **names** (FMH, MANUAL) instead of **values** (fmh, manual), causing `LookupError` on read.

**Fix**: Changed `Ingredient` model to use explicit `sa_column=Column(String(...))` for enum-like fields, ensuring VARCHAR storage.

```python
# Before (broken)
source: IngredientSource = Field(default=IngredientSource.MANUAL)

# After (fixed)
source: str = Field(
    default="manual",
    sa_column=Column(String(20), nullable=False, default="manual")
)
```

**Files Modified**: `backend/app/models/ingredient.py`

#### CORS Origins Update

Added Vercel deployment domain to allowed CORS origins:

```
https://prepper-one.vercel.app
```

**Docs**: `docs/completions/enum-varchar-fix.md`

---

## [0.0.8] - 2025-12-17

### Added

#### Frontend Multi-Page Expansion (Plan 03)

Expanded the frontend from a single recipe canvas to a multi-page application with dedicated views for ingredients, recipes, R&D, and finance.

**New Routes**:
- `/ingredients` — Ingredients Library with search, grouping, and filtering
- `/recipes` — Recipes Gallery with status filtering and search
- `/recipes/[id]` — Individual Recipe detail page with costing and instructions
- `/rnd` — R&D Workspace for experimental recipes and ingredient exploration
- `/finance` — Finance Reporting placeholder (awaiting Atlas integration)

**New UI Components**:
- `TopNav` — Global navigation bar with active state highlighting
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` — Composable card components
- `MasonryGrid` — Pinterest-style responsive grid (using react-masonry-css)
- `GroupSection` — Section with title and count badge for grouped content
- `PageHeader` — Page title, description, and action buttons
- `SearchInput` — Search input with clear button

**New Domain Components**:
- `IngredientCard` — Ingredient display card with hover actions
- `RecipeCard` — Recipe display card with status badge and cost

**Layout Changes**:
- Root layout now includes `TopNav` for global navigation
- `TopAppBar` simplified (logo moved to TopNav)
- Responsive design: mobile-friendly layouts for all new pages

**Library**: Added `react-masonry-css` for masonry grid layout

**Docs**: `docs/completions/plan-03-frontend-pages.md`

---

## [0.0.7] - 2025-12-17

### Added

#### Recipe Extensions (Plan 02)

Extended the `Recipe` model to support sub-recipe linking (BOM hierarchy), authorship tracking, and outlet/brand attribution.

**1. Sub-Recipes (Recipe-to-Recipe Linking)**

New `recipe_recipes` junction table enables Bill of Materials hierarchy where recipes can include other recipes as components (e.g., "Eggs Benedict" includes "Hollandaise Sauce").

**New Model**: `RecipeRecipe`
- `parent_recipe_id` / `child_recipe_id` — Recipe linking
- `quantity` + `unit` — Supports `portion`, `batch`, `g`, `ml`
- `position` — Display order
- Check constraint prevents self-references

**New API Endpoints**:
- `GET /recipes/{id}/sub-recipes` — List sub-recipes
- `POST /recipes/{id}/sub-recipes` — Add sub-recipe (with cycle detection)
- `PUT /recipes/{id}/sub-recipes/{link_id}` — Update quantity/unit
- `DELETE /recipes/{id}/sub-recipes/{link_id}` — Remove sub-recipe
- `POST /recipes/{id}/sub-recipes/reorder` — Reorder sub-recipes
- `GET /recipes/{id}/used-in` — Reverse lookup (what recipes use this?)
- `GET /recipes/{id}/bom-tree` — Full BOM hierarchy tree

**Costing**: `CostingService` now recursively calculates sub-recipe costs with cycle detection.

**2. Authorship Tracking**

**New Recipe Columns**:
- `created_by` (VARCHAR 100) — Who created the recipe
- `updated_by` (VARCHAR 100) — Who last modified it

**3. Outlet/Brand Attribution**

New `outlets` and `recipe_outlets` tables for multi-brand operations.

**New Model**: `Outlet`
- `name`, `code` — Brand/location identification
- `outlet_type` — `"brand"` or `"location"`
- `parent_outlet_id` — Hierarchical structure support

**New Model**: `RecipeOutlet` (junction)
- `recipe_id` / `outlet_id` — Many-to-many linking
- `is_active` — Per-outlet activation
- `price_override` — Outlet-specific pricing

**New API Endpoints**:
- `POST /outlets` — Create outlet
- `GET /outlets` — List outlets
- `GET /outlets/{id}` — Get outlet
- `PATCH /outlets/{id}` — Update outlet
- `DELETE /outlets/{id}` — Deactivate outlet
- `GET /outlets/{id}/recipes` — Recipes for outlet
- `GET /outlets/{id}/hierarchy` — Outlet tree
- `GET /recipes/{id}/outlets` — Outlets for recipe
- `POST /recipes/{id}/outlets` — Assign to outlet
- `PATCH /recipes/{id}/outlets/{outlet_id}` — Update (price override)
- `DELETE /recipes/{id}/outlets/{outlet_id}` — Remove from outlet

**Migration**: `b2c3d4e5f6g7_add_recipe_extensions.py`

**Files Created**:
- `backend/app/models/recipe_recipe.py`
- `backend/app/models/outlet.py`
- `backend/app/domain/subrecipe_service.py`
- `backend/app/domain/outlet_service.py`
- `backend/app/api/sub_recipes.py`
- `backend/app/api/outlets.py`

---

## [0.0.6] - 2025-12-17

### Added

#### Ingredient Data Model Enhancements (Plan 01)

Extended the `Ingredient` model to support multi-supplier pricing, canonical ingredient linking, and food categorization.

**New Database Columns**:
- `suppliers` (JSONB) — Array of supplier entries with pricing, currency, SKU
- `master_ingredient_id` (FK) — Self-referential link to canonical/master ingredient
- `category` (VARCHAR) — Food category enum (proteins, vegetables, dairy, etc.)
- `source` (VARCHAR) — Origin tracking: `"fmh"` or `"manual"`

**New API Endpoints**:
- `GET /ingredients/categories` — List all food categories
- `GET /ingredients/{id}/variants` — Get variants linked to a master ingredient
- `POST /ingredients/{id}/suppliers` — Add supplier entry
- `PATCH /ingredients/{id}/suppliers/{supplier_id}` — Update supplier
- `DELETE /ingredients/{id}/suppliers/{supplier_id}` — Remove supplier
- `GET /ingredients/{id}/suppliers/preferred` — Get preferred supplier

**New Query Filters**:
- `GET /ingredients?category=proteins` — Filter by food category
- `GET /ingredients?source=fmh` — Filter by source
- `GET /ingredients?master_only=true` — Only top-level ingredients

**Migration**: `a1b2c3d4e5f6_add_ingredient_enhancements.py`

**Docs**: `docs/completions/plan-01-ingredient-enhancements.md`

---

## [0.0.5] - 2025-12-03

### Added

#### AI-Powered Instructions Parsing

Integrated Vercel AI SDK with OpenAI GPT-5.1 to transform freeform recipe instructions into structured steps.

**Stack**: Vercel AI SDK, `@ai-sdk/openai`, Zod schema validation

**Features**:
- Natural language → structured JSON with `order`, `text`, `timer_seconds`, `temperature_c`
- Automatic duration extraction (e.g., "5 minutes" → 300 seconds)
- Automatic temperature conversion (e.g., "350°F" → 177°C)
- Loading state with animated spinner

**Files**:
- `frontend/src/app/api/parse-instructions/route.ts` — Next.js API route
- `frontend/.env.example` — Added `OPENAI_API_KEY` placeholder

**Docs**: `docs/completions/ai-instructions-parsing.md`

#### UX Improvements

**Recipe Delete** — Hover-reveal trash icon with click-twice-to-confirm pattern
- Appears on hover, first click arms (turns red), second click confirms
- Auto-resets after 2 seconds if not confirmed

**Double-Click to Create Ingredient** — Double-click empty space in ingredients panel to open new ingredient form
- Reduces friction for rapid ingredient entry
- Updated hint: "Drag to add to recipe • Double-click to create new"

**Files**: `LeftPanel.tsx`, `RightPanel.tsx`

### Fixed

- **CORS**: Added `https://www.reciperep.com` and `https://reciperep.com` to Fly.io `CORS_ORIGINS`
- **API Path**: Frontend `NEXT_PUBLIC_API_URL` now correctly includes `/api/v1` suffix
- **422 Error**: Fixed `updateStructuredInstructions` payload — was wrapping in extra `{ instructions_structured: ... }` layer

**Docs**: `docs/completions/frontend-api-fix.md`

---

## [0.0.4] - 2025-12-02

### Added

#### Backend Deployment (Fly.io)

**App**: `reciperepo` deployed to Ebb & Flow Group organization

**URL**: https://reciperepo.fly.dev

**Files**: `Dockerfile`, `fly.toml`

**Config**: Singapore region, shared-cpu-1x, 1GB RAM, auto-stop enabled

**Secrets**: `DATABASE_URL` (Supabase), `CORS_ORIGINS`

**Docs**: `docs/completions/backend-deployment.md`

---

## [0.0.3] - 2024-11-27

### Added

#### Database Migration (Alembic → Supabase)

**Tables Created**: `ingredients`, `recipes`, `recipe_ingredients`

**Indexes**: `ix_ingredients_name`, `ix_recipes_name`, `ix_recipe_ingredients_recipe_id`, `ix_recipe_ingredients_ingredient_id`

**Migration**: `db480a186284_initial_tables.py`

### Fixed

- `Recipe.instructions_structured` JSON type changed from `sqlite.JSON` to `sqlalchemy.JSON` for PostgreSQL compatibility

**Docs**: `docs/completions/database-migration.md`

---

## [0.0.2] - 2024-11-27

### Added

#### Frontend (Next.js 15 + TypeScript + Tailwind)

**Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS 4, TanStack Query, dnd-kit, Sonner

**Three-Column Layout**
- `TopAppBar` — inline-editable recipe name, yield, status dropdown, cost display
- `LeftPanel` — recipe list with search, create button, selection state
- `RecipeCanvas` — ingredient drop zone, instructions workspace
- `RightPanel` — draggable ingredient palette with inline create form

**Recipe Workspace**
- Drag-and-drop ingredients from palette to recipe
- Sortable ingredient rows with quantity/unit editing and line costs
- Cost summary (batch total + per-portion) from costing API
- Instructions with Freeform/Steps tab toggle
- Structured steps with timer, temperature, drag reorder

**Data Layer**
- Typed API client (`lib/api.ts`) covering all 17 backend endpoints
- 15+ TanStack Query hooks with automatic cache invalidation
- App state context for selected recipe and UI preferences

**UX Polish**
- Debounced autosave (no save buttons)
- Loading skeletons and contextual empty states
- Toast notifications via Sonner
- Dark mode support

**Docs**: `docs/completions/frontend-implementation.md`

---

## [0.0.1] - 2024-11-27

### Added

#### Backend Foundation (FastAPI + SQLModel)

**Infrastructure**: FastAPI, PostgreSQL (Supabase), Alembic migrations, pydantic-settings

**Models**: `Ingredient`, `Recipe`, `RecipeIngredient`

**Domain Services**: IngredientService, RecipeService, InstructionsService, CostingService

**API Endpoints (17 total)**
- `/api/v1/ingredients` — CRUD + deactivate
- `/api/v1/recipes` — CRUD + status + soft-delete
- `/api/v1/recipes/{id}/ingredients` — add, update, remove, reorder
- `/api/v1/recipes/{id}/instructions` — raw, parse, structured
- `/api/v1/recipes/{id}/costing` — calculate, recompute

**Utilities**: Unit conversion (mass, volume, count)

**Testing**: Pytest with SQLite fixtures

**Docs**: `docs/completions/backend-implementation.md`

---

*Backend Blueprint: `docs/plans/backend-blueprint.md` | Alignment: ~95%*
*Frontend Blueprint: `docs/plans/frontend-blueprint.md` | Alignment: ~95%*
