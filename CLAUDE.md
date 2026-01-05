# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prepper is a **kitchen-first recipe workspace** for chefs and operators. It treats recipes as living objects on a single "recipe canvas" with drag-and-drop ingredients, freeform-to-structured instructions, and automatic costing. Key principles: clarity, immediacy, reversibility—no auth, no save buttons, just autosave.

## Common Commands

### Backend (FastAPI)

```bash
cd backend

# Setup
python -m venv venv && source venv/bin/activate
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
│   ├── recipe.py                # Recipe, RecipeStatus, Instructions
│   ├── recipe_ingredient.py     # RecipeIngredient (ingredient links)
│   ├── recipe_recipe.py         # RecipeRecipe (sub-recipe/BOM hierarchy)
│   ├── outlet.py                # Outlet, RecipeOutlet (multi-brand support)
│   ├── tasting.py               # TastingSession, TastingNote
│   ├── supplier.py              # Supplier
│   └── costing.py               # CostingResult, CostBreakdownItem
├── domain/              # Business logic services
│   ├── ingredient_service.py    # Ingredient CRUD + variants
│   ├── recipe_service.py        # Recipe CRUD + status
│   ├── instructions_service.py  # Freeform → structured parsing
│   ├── costing_service.py       # Unit conversion + cost calculations
│   ├── subrecipe_service.py     # Sub-recipe hierarchy + cycle detection
│   ├── outlet_service.py        # Multi-brand outlet management
│   ├── tasting_service.py       # Tasting sessions and notes
│   └── supplier_service.py      # Supplier management
├── api/                 # FastAPI routers (one per resource)
│   ├── recipes.py               # Recipe CRUD
│   ├── recipe_ingredients.py    # Recipe ingredient links
│   ├── ingredients.py           # Ingredient CRUD + suppliers
│   ├── instructions.py          # Recipe instructions
│   ├── costing.py               # Recipe costing
│   ├── sub_recipes.py           # Sub-recipe hierarchy
│   ├── outlets.py               # Outlets + recipe-outlet links
│   ├── tastings.py              # Tasting sessions + notes
│   └── suppliers.py             # Supplier CRUD
└── utils/               # Unit conversion helpers
```

**Key patterns:**
- Services receive SQLModel `Session` and return domain objects
- Routers depend on services via function calls (no DI framework)
- Tests use SQLite in-memory via `conftest.py` fixtures

### Frontend (`frontend/src/`)

```
app/                     # Next.js App Router pages
├── recipes/             # Recipe list and detail pages
├── ingredients/         # Ingredient list and detail pages
├── suppliers/           # Supplier management
├── tastings/            # Tasting sessions (list, detail, new)
├── finance/             # Finance/analytics
└── rnd/                 # R&D workspace

lib/
├── api.ts               # Typed fetch wrapper for 40+ endpoints
├── providers.tsx        # QueryClientProvider + AppProvider composition
├── store.tsx            # React Context for selectedRecipeId, instructionsTab
├── types/index.ts       # TypeScript interfaces for all entities
└── hooks/               # TanStack Query hooks with cache invalidation
    ├── useRecipes.ts
    ├── useIngredients.ts
    ├── useRecipeIngredients.ts
    ├── useCosting.ts
    ├── useInstructions.ts
    ├── useSuppliers.ts
    └── useTastings.ts

components/
├── layout/              # AppShell, TopAppBar, TopNav, LeftPanel, RightPanel, RecipeCanvas
├── recipe/              # RecipeIngredientsList, RecipeIngredientRow, Instructions, InstructionsSteps
├── recipes/             # RecipeCard
├── ingredients/         # IngredientCard
└── ui/                  # Button, Input, Textarea, Select, Badge, Card, Skeleton, SearchInput, PageHeader, GroupSection, MasonryGrid
```

**Key patterns:**
- All data flows through TanStack Query hooks—no local state for server data
- Drag-and-drop via `dnd-kit` (wrapped in AppShell's DndContext)
- Debounced autosave on all editable fields (no save buttons)
- `useAppState()` for global UI state (selected recipe, active tab)

### API Structure

All endpoints under `/api/v1`:

**Core Resources:**
- `/recipes` — CRUD + status + soft-delete
- `/ingredients` — CRUD + deactivate + categories + variants
- `/suppliers` — CRUD

**Recipe Sub-resources:**
- `/recipes/{id}/ingredients` — add, update, remove, reorder
- `/recipes/{id}/sub-recipes` — sub-recipe hierarchy (BOM) with cycle detection
- `/recipes/{id}/instructions` — raw, parse (LLM), structured
- `/recipes/{id}/costing` — calculate, recompute
- `/recipes/{id}/outlets` — multi-brand outlet assignments
- `/recipes/{id}/tasting-notes` — tasting history + summary

**Ingredient Sub-resources:**
- `/ingredients/{id}/suppliers` — add, update, remove supplier entries
- `/ingredients/{id}/variants` — get ingredient variants

**Tasting & Outlets:**
- `/tasting-sessions` — CRUD + stats
- `/tasting-sessions/{id}/notes` — tasting notes per session
- `/outlets` — CRUD for multi-brand/location support

## Environment Variables

**Backend** (`.env`):
- `DATABASE_URL` — PostgreSQL connection (defaults to SQLite for local dev)
- `CORS_ORIGINS` — JSON array of allowed origins

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL` — Backend URL (default: `http://localhost:8000/api/v1`)
