# Changelog

All notable changes to this project will be documented in this file.

---

## [0.0.1] - 2024-11-27

### Added

#### Backend Foundation (FastAPI + SQLModel)

**Core Infrastructure**
- FastAPI application with lifespan management
- PostgreSQL database support (Supabase) with Alembic migrations
- pydantic-settings configuration via environment variables
- CORS middleware for frontend integration

**Models**
- `Ingredient`  canonical ingredient reference with base unit costs
- `Recipe`  core recipe with raw/structured instructions, yield, status
- `RecipeIngredient`  join table linking recipes to ingredients with quantities

**Domain Layer**
- `IngredientService`  CRUD operations, soft-delete via deactivation
- `RecipeService`  lifecycle management, ingredient management, reordering
- `InstructionsService`  raw/structured instructions with LLM parsing placeholder
- `CostingService`  cost calculation engine with unit conversion

**API Endpoints (17 total)**
- `/api/v1/ingredients`  create, list, get, update, deactivate
- `/api/v1/recipes`  create, list, get, update, status, soft-delete
- `/api/v1/recipes/{id}/ingredients`  add, update, remove, reorder
- `/api/v1/recipes/{id}/instructions`  raw, parse, structured
- `/api/v1/recipes/{id}/costing`  calculate, recompute

**Utilities**
- Unit conversion support (mass: g/kg/oz/lb, volume: ml/l/cup/tbsp, count: pcs/dozen)

**Testing**
- Pytest scaffolding with in-memory SQLite fixtures
- Tests for ingredients, recipes, and costing calculations

**Documentation**
- `docs/completions/backend-implementation.md`  full implementation reference

---

*Blueprint: `docs/plans/backend-blueprint.md` | Alignment: ~95%*
