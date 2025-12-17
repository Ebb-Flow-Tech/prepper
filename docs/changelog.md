# Changelog

All notable changes to this project will be documented in this file.

---

## Version History

- **0.0.6** (2025-12-17) - Ingredient Data Model Enhancements: Multi-Supplier Pricing, Master Ingredient Linking, Food Categories & Source Tracking
- **0.0.5** (2025-12-03) - AI-Powered Instructions Parsing: Vercel AI SDK + GPT-5.1 for Freeform→Structured Conversion, UX Improvements & CORS Fixes
- **0.0.4** (2025-12-02) - Backend Deployment: Fly.io Production Setup with Supabase PostgreSQL
- **0.0.3** (2024-11-27) - Database Migration: Alembic Initial Tables to Supabase + PostgreSQL JSON Compatibility Fix
- **0.0.2** (2024-11-27) - Frontend Implementation: Next.js 15 Recipe Canvas with Drag-and-Drop, Autosave & TanStack Query
- **0.0.1** (2024-11-27) - Backend Foundation: FastAPI + SQLModel with 17 API Endpoints, Domain Services & Unit Conversion

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
