# Backend Blueprint (Prepper)

Last updated: 2026-01-02

## Purpose
- FastAPI + SQLModel backend providing recipes, ingredients, instructions, and costing endpoints to support the single “recipe canvas” experience.
- Prioritizes immediacy (simple CRUD), reversibility (soft deletes/status), and derived data separation (instructions_structured, cost_price cached).

## Stack & Runtime
- FastAPI app (`app/main.py`) with CORS, lifespan creating tables.
- SQLModel over SQLite by default (`DATABASE_URL` configurable for Postgres), sync Session per request.
- Settings via pydantic-settings (`app/config.py`): `database_url`, `api_v1_prefix` (`/api/v1`), `cors_origins`, `debug`, `app_name`.
- Alembic scaffold present; schema currently created at startup.
- Testing: pytest + FastAPI TestClient; in-memory SQLite fixture with StaticPool (`tests/conftest.py`).

## Data Model (app/models)
- `Ingredient`: id, name, base_unit, cost_per_base_unit (nullable), is_active, timestamps. Create/Update schemas.
- `Recipe`: id, name, yield_quantity/unit, is_prep_recipe, instructions_raw, instructions_structured (JSON), cost_price (cached), selling_price_est, status (draft/active/archived), timestamps. Create/Update/Status schemas.
- `RecipeIngredient`: links recipe ↔ ingredient with quantity, unit, sort_order, unit_price (nullable), base_unit (nullable), supplier_id (nullable), timestamps. Create/Update/Reorder schemas include unit_price, base_unit, supplier_id fields.
- `Supplier`: id, name, sku (nullable), timestamps. Create/Update schemas.
- Costing response models: `CostBreakdownItem`, `CostingResult` (per-portion, batch, missing_costs list).

## Services (app/domain)
- `IngredientService`: CRUD + deactivate (soft delete) with updated_at stamping; list active_only filter.
- `RecipeService`: recipe lifecycle (create/list/get/update metadata, set status, soft delete) and ingredient management (list ordered, add with duplicate guard + incremental sort_order, update quantity/unit, delete, reorder by provided id list).
- `InstructionsService`: store raw text; placeholder LLM parser (line-based) to structured; update structured; combined parse-and-store flow.
- `CostingService`: calculate breakdown (converts qty → base unit via `convert_to_base_unit` using recipe ingredient's base_unit, multiplies by recipe ingredient's unit_price). Supports recursive sub-recipe costing with cycle detection. Returns missing_costs if any cost is null; cost_per_portion = total/yield. `persist_cost_snapshot` caches cost_per_portion to recipe.cost_price.
- `SupplierService`: CRUD operations for suppliers (create, list, get, update, delete) with updated_at stamping on updates.

## API Routes (app/api, prefixed with /api/v1)
- Ingredients (`ingredients.py`): POST create, GET list (active_only query), GET by id, PATCH update, PATCH /deactivate.
- Recipes (`recipes.py`): POST create, GET list (status filter), GET by id, PATCH metadata, PATCH /status, DELETE soft-delete (sets archived).
- Recipe Ingredients (`recipe_ingredients.py`): GET list for recipe, POST add (409 on duplicate) with optional unit_price/base_unit/supplier_id, PATCH update qty/unit/unit_price/base_unit/supplier_id, DELETE remove (204), POST /reorder with ordered_ids.
- Instructions (`instructions.py`): POST /instructions/raw (store text), POST /instructions/parse (parse existing raw via placeholder LLM and save structured), PATCH /instructions/structured (manual update).
- Costing (`costing.py`): GET /costing (calculate on the fly), POST /costing/recompute (calculate + persist cost_price).
- Suppliers (`suppliers.py`): POST create, GET list, GET by id, PATCH update, DELETE remove (204).
- Shared dependency `get_session` in `app/api/deps.py` yields SQLModel Session.

## Utilities
- `app/utils/unit_conversion.py`: conversion maps for mass (g, kg, mg, oz, lb), volume (ml, l, cl, dl, tsp, tbsp, cup, fl_oz), count (pcs, dozen); detects category and converts to ingredient base unit; returns None for incompatible units, otherwise falls back to original quantity if unknown.

## App Composition
- `create_app` mounts routers, adds CORS, health endpoint `/health`, uses lifespan to `create_db_and_tables`.
- Engine built in `app/database.py` with sqlite check_same_thread override; `create_db_and_tables` uses SQLModel metadata.

## Testing
- Fixtures swap `get_session` to in-memory DB. Coverage: recipe creation/status/delete, ingredient CRUD/deactivate, costing (with conversion) and costing calculations.

## Extensibility Notes
- When adding fields: update SQLModel schemas + corresponding Create/Update models and service setters; adjust tests.
- For real LLM parsing: replace `parse_instructions_with_llm` to call provider and update structured schema shape; ensure frontend contract aligns.
- If moving to Postgres/migrations: update `database_url`, run Alembic migrations instead of startup create_all.
