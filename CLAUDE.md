# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prepper is a **kitchen-first recipe workspace** for chefs and operators. It treats recipes as living objects on a single "recipe canvas" with drag-and-drop ingredients, freeform-to-structured instructions, and automatic costing with wastage tracking. Key principles: clarity, immediacy, reversibility—no save buttons, just autosave. Features mock authentication (frontend-only) with user roles (normal/admin) for recipe ownership and permissions.

**Recipe Versioning**: Recipes support forking with full version history tracking. Each recipe has a `version` number and `root_id` pointing to its parent, enabling tree-based version lineage visualization.

**Multi-Outlet Support**: Recipes can be assigned to multiple outlets (brands/locations) with per-outlet pricing overrides. Outlets support hierarchical parent-child relationships with cycle detection.

**Wastage & Costing**: Recipe ingredients track wastage percentage (0-100), which is factored into ingredient unit prices and final cost breakdowns.

## Common Commands

### Backend (FastAPI)

```bash
cd backend

# Setup
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env

# Run server
uvicorn app.main:app --reload

# Tests
pytest                          # Run all tests
pytest tests/test_recipes.py    # Single test file
pytest -k "test_create"         # By name pattern

# Linting
ruff check .
ruff format .
mypy app/
```

### Frontend (Next.js 15)

```bash
cd frontend

npm install
npm run dev     # Dev server at localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```

**Requires backend running on localhost:8000**

## Architecture

### Backend (`backend/`)

```
app/
├── main.py              # FastAPI factory with lifespan, CORS, router mounting
├── config.py            # pydantic-settings (env-driven)
├── database.py          # SQLModel engine + session management
├── models/              # SQLModel entities
│   ├── ingredient.py            # Ingredient, SupplierEntry
│   ├── recipe.py                # Recipe (+ version, root_id, description, summary_feedback, rnd_started, review_ready)
│   ├── recipe_ingredient.py     # RecipeIngredient (+ wastage_percentage, unit_price, base_unit, supplier_id)
│   ├── recipe_recipe.py         # RecipeRecipe (sub-recipe/BOM hierarchy)
│   ├── recipe_image.py          # RecipeImage (multi-image support with is_main, order)
│   ├── outlet.py                # Outlet (with parent_outlet_id hierarchy), RecipeOutlet (+ price_override)
│   ├── category.py              # Category (ingredient categorization, soft-delete)
│   ├── tasting.py               # TastingSession, TastingNote
│   ├── recipe_tasting.py        # RecipeTasting (session-recipe many-to-many)
│   ├── supplier.py              # Supplier (name, address, phone, email)
│   └── costing.py               # CostingResult (+ adjusted_cost_per_unit), CostBreakdownItem
├── domain/              # Business logic services
│   ├── ingredient_service.py    # Ingredient CRUD + variants + categorization
│   ├── recipe_service.py        # Recipe CRUD + status + fork + version tree
│   ├── instructions_service.py  # Freeform → structured parsing
│   ├── costing_service.py       # Unit conversion + cost calculations (with wastage)
│   ├── subrecipe_service.py     # Sub-recipe hierarchy + cycle detection
│   ├── outlet_service.py        # Outlet CRUD + hierarchy + cycle detection + recipe links
│   ├── recipe_image_service.py  # Recipe image management + ordering
│   ├── tasting_session_service.py   # Tasting session CRUD + stats
│   ├── tasting_note_service.py      # Tasting notes + recipe history
│   ├── recipe_tasting_service.py    # Session-recipe relationships
│   ├── supplier_service.py      # Supplier CRUD + supplier-ingredient links
│   ├── storage_service.py       # Supabase Storage for recipe images
│   └── category_service.py      # Category CRUD + soft-delete
├── api/                 # FastAPI routers (one per resource)
│   ├── recipes.py               # Recipe CRUD + fork + versions + image management
│   ├── recipe_ingredients.py    # Recipe ingredient links + wastage/pricing
│   ├── ingredients.py           # Ingredient CRUD + suppliers + variants + categorization
│   ├── instructions.py          # Recipe instructions (raw, parse, structured)
│   ├── costing.py               # Recipe costing (calculate, recompute with wastage)
│   ├── sub_recipes.py           # Sub-recipe hierarchy + BOM tree
│   ├── outlets.py               # Outlets CRUD + hierarchy + cycle detection
│   ├── recipe_outlets.py        # Recipe-outlet links (per-recipe detail)
│   ├── tastings.py              # Tasting sessions CRUD + stats
│   ├── tasting_notes.py         # Tasting notes CRUD (nested under sessions)
│   ├── tasting_history.py       # Recipe tasting history + summary
│   ├── recipe_tastings.py       # Session-recipe relationships
│   ├── suppliers.py             # Supplier CRUD + ingredient links
│   ├── agents.py                # Agent endpoints (feedback summarization, etc.)
│   └── categories.py            # Category CRUD
├── agents/              # AI-powered features
│   ├── base_agent.py            # Base agent framework
│   ├── category_agent.py        # Ingredient categorization
│   └── feedback_summary_agent.py # Tasting feedback summarization
└── utils/               # Unit conversion helpers
```

**Key patterns:**
- Services receive SQLModel `Session` and return domain objects
- Routers depend on services via function calls (no DI framework)
- Tests use SQLite in-memory via `conftest.py` fixtures

### Frontend (`frontend/src/`)

```
app/                     # Next.js 15 App Router pages
├── outlets/             # Outlet list and detail pages (NEW)
├── recipes/             # Recipe list and detail pages
├── ingredients/         # Ingredient list and detail pages
├── suppliers/           # Supplier list and detail pages
├── tastings/            # Tasting sessions (list, detail, new, per-recipe notes)
├── finance/             # Finance/analytics
├── rnd/                 # R&D workspace
├── login/               # Login page (mock auth)
├── register/            # Registration page (mock auth)
└── api/                 # Route handlers
    └── generate-image/  # DALL-E 3 image generation API route

lib/
├── api.ts               # Typed fetch wrapper (40+ endpoints)
├── providers.tsx        # QueryClientProvider + AppProvider + AuthGuard composition
├── store.tsx            # React Context (selectedRecipeId, canvasTab, auth state)
├── types/index.ts       # TypeScript interfaces for all entities
├── utils.ts             # Utility functions (cn for classnames)
├── mock-users.json      # Mock user data for frontend-only auth
└── hooks/               # TanStack Query hooks with cache invalidation
    ├── useRecipes.ts            # useRecipeVersions, useGenerateRecipeImage, etc.
    ├── useIngredients.ts
    ├── useRecipeIngredients.ts
    ├── useCosting.ts
    ├── useInstructions.ts
    ├── useSuppliers.ts
    ├── useTastings.ts
    ├── useSubRecipes.ts
    ├── useOutlets.ts            # useOutlets, useOutlet, useCreateOutlet, useUpdateOutlet (NEW)
    └── useRecipeOutlets.ts      # useRecipeOutlets, useOutletRecipes, etc. (NEW)

components/
├── layout/              # AppShell, TopAppBar, TopNav, LeftPanel, RightPanel, RecipeCanvas
│   └── tabs/            # 12+ canvas tabs including OutletsTab, OverviewTab, CanvasTab, VersionsTab, etc.
├── recipe/              # RecipeIngredientsList, RecipeIngredientRow, Instructions, SubRecipesList
├── recipes/             # RecipeCard
├── outlets/             # OutletsTab, AddOutletModal, EditableSelect (NEW)
├── ingredients/         # IngredientCard
├── AuthGuard.tsx        # Route protection for authenticated pages
└── ui/                  # Button, Input, Textarea, Select, Badge, Card, Skeleton, SearchInput, PageHeader, EditableCell, EditableSelect
```

**Key patterns:**
- All data flows through TanStack Query hooks—no local state for server data
- Drag-and-drop via `dnd-kit` (wrapped in AppShell's DndContext)
- Debounced autosave on all editable fields (no save buttons)
- `useAppState()` for global UI state (selected recipe, active tab)
- Canvas tabs: `canvas | overview | ingredients | costs | instructions | tasting | outlets | versions`
- Version tree visualization via `@xyflow/react` (ReactFlow)
- Inline editable cells with `EditableCell` component
- Modal dialogs for complex forms (suppliers, outlets, etc.)

### API Structure

All endpoints under `/api/v1`:

**Core Resources:**
- `/recipes` — CRUD + status + soft-delete + fork
- `/ingredients` — CRUD + deactivate + categories + variants
- `/suppliers` — CRUD + contact info (address, phone, email)

**Recipe Sub-resources:**
- `/recipes/{id}/fork` — create editable copy with ingredients & instructions (sets version + root_id, excludes image)
- `/recipes/{id}/image` — upload recipe image (base64 → Supabase Storage)
- `/recipes/{id}/versions` — get all recipes in version tree (with user_id filtering for visibility)
- `/recipes/{id}/ingredients` — add, update, remove, reorder
- `/recipes/{id}/sub-recipes` — sub-recipe hierarchy (BOM) with cycle detection
- `/recipes/{id}/used-in` — reverse lookup: recipes that use this as sub-recipe
- `/recipes/{id}/bom-tree` — full Bill of Materials tree (nested)
- `/recipes/{id}/instructions/raw` — store raw instructions text
- `/recipes/{id}/instructions/parse` — parse raw to structured (LLM)
- `/recipes/{id}/instructions/structured` — update structured instructions
- `/recipes/{id}/costing` — calculate cost breakdown
- `/recipes/{id}/costing/recompute` — recompute and persist cost
- `/recipes/{id}/outlets` — multi-brand outlet assignments
- `/recipes/{id}/tasting-notes` — tasting history for recipe
- `/recipes/{id}/tasting-summary` — aggregated tasting data for recipe

**Ingredient Sub-resources:**
- `/ingredients/categories` — list all food categories
- `/ingredients/{id}/suppliers` — add, update, remove supplier entries
- `/ingredients/{id}/suppliers/preferred` — get preferred supplier
- `/ingredients/{id}/variants` — get ingredient variants

**Supplier Sub-resources:**
- `/suppliers/{id}/ingredients` — get ingredients linked to a supplier

**Tasting Sessions:**
- `/tasting-sessions` — CRUD + stats
- `/tasting-sessions/{id}/stats` — get session statistics
- `/tasting-sessions/{id}/notes` — full CRUD for tasting notes
- `/tasting-sessions/{id}/recipes` — session-recipe relationships (add/remove)

**Outlets:**
- `/outlets` — CRUD for multi-brand/location support
- `/outlets/{id}` — get/update single outlet
- `/outlets/{id}/recipes` — get recipes assigned to outlet
- `/outlets/{id}/hierarchy` — get outlet hierarchy tree

**Recipe-Outlet Links** (nested under recipes):
- `/recipes/{id}/outlets` — get outlets for recipe
- `/recipes/{id}/outlets` (POST) — add recipe to outlet
- `/recipes/{id}/outlets/{outlet_id}` (PATCH) — update outlet link (price_override, activation)
- `/recipes/{id}/outlets/{outlet_id}` (DELETE) — remove recipe from outlet

**Agents:**
- `/agents/summarize-feedback/{recipe_id}` — AI-powered tasting feedback summary

**Categories:**
- `/ingredients/categories` — list all food categories

## Environment Variables

**Backend** (`.env`):
- `DATABASE_URL` — PostgreSQL connection (defaults to SQLite for local dev)
- `CORS_ORIGINS` — JSON array of allowed origins
- `SUPABASE_URL` — Supabase project URL (optional, for image storage)
- `SUPABASE_KEY` — Supabase anon key (optional, for image storage)
- `SUPABASE_BUCKET` — Storage bucket name (default: `recipe-images`)
- `ANTHROPIC_API_KEY` — Anthropic API key (optional, for AI agents)

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL` — Backend URL (default: `http://localhost:8000/api/v1`)
- `OPENAI_API_KEY` — OpenAI API key (optional, for DALL-E 3 image generation)

## Key Features (Recent Additions)

**Wastage Tracking** (Jan 20)
- Recipe ingredients now track `wastage_percentage` (0-100)
- Wastage is factored into ingredient unit prices and cost breakdowns
- `adjusted_cost_per_unit` field on costing results

**Multi-Outlet Management** (Jan 22)
- Outlets support hierarchical parent-child relationships
- Cycle detection prevents circular hierarchies
- Per-outlet recipe activation and price overrides
- Dedicated `/outlets` page with detail views

**AI-Powered Agents** (Jan 20+)
- `category_agent.py` — Ingredient categorization
- `feedback_summary_agent.py` — Tasting feedback summarization
- Extensible base agent framework for future AI features

**Multi-Image Support** (Jan 16)
- `RecipeImage` model for multiple recipe images
- `is_main` flag for primary image selection
- `order` field for carousel sequencing

**R&D Workflow Enhancements** (Jan 16-20)
- `review_ready` flag for recipe review state
- `rnd_started` flag for R&D session initiation
- AI-generated `summary_feedback` on recipes
