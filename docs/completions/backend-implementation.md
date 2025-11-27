# Backend Implementation Summary

**Completed:** 2024-11-27
**Blueprint:** `docs/plans/backend-blueprint.md`
**Alignment:** ~95%

---

## Stack

- **Framework:** FastAPI
- **ORM:** SQLModel (Pydantic + SQLAlchemy)
- **Database:** PostgreSQL (Supabase)
- **Migrations:** Alembic
- **Driver:** psycopg2-binary

---

## Database Setup

**Provider:** Supabase (PostgreSQL)

### Configuration

The database URL is read from environment variables. Alembic also reads from the same source.

```bash
# .env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### Initial Migration

```bash
cd backend
cp .env.example .env
# Edit .env with Supabase credentials

pip install -e ".[dev]"
alembic revision --autogenerate -m "Initial tables"
alembic upgrade head
```

### Notes

- `database.py` auto-detects SQLite vs PostgreSQL for connection args
- `alembic/env.py` reads `DATABASE_URL` from environment (not alembic.ini)
- SQLite still works for local testing if needed

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app factory, lifespan events
│   ├── config.py            # pydantic-settings configuration
│   ├── database.py          # SQLModel engine & session management
│   │
│   ├── models/              # SQLModel tables + DTOs
│   │   ├── ingredient.py    # Ingredient, IngredientCreate, IngredientUpdate
│   │   ├── recipe.py        # Recipe, RecipeCreate, RecipeUpdate, RecipeStatus
│   │   ├── recipe_ingredient.py  # RecipeIngredient + variants
│   │   └── costing.py       # CostBreakdownItem, CostingResult
│   │
│   ├── domain/              # Business logic layer
│   │   ├── ingredient_service.py
│   │   ├── recipe_service.py
│   │   ├── instructions_service.py
│   │   └── costing_service.py
│   │
│   ├── api/                 # FastAPI routes (thin HTTP layer)
│   │   ├── deps.py          # Dependency injection
│   │   ├── ingredients.py
│   │   ├── recipes.py
│   │   ├── recipe_ingredients.py
│   │   ├── instructions.py
│   │   └── costing.py
│   │
│   └── utils/
│       └── unit_conversion.py  # g↔kg, ml↔l conversions
│
├── tests/
│   ├── conftest.py          # Pytest fixtures
│   ├── test_ingredients.py
│   ├── test_recipes.py
│   └── test_costing.py
│
├── alembic/                 # Database migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│
├── pyproject.toml
├── alembic.ini
├── .env.example
└── README.md
```

---

## Models Implemented

### Ingredient
| Field | Type | Notes |
|-------|------|-------|
| id | int (PK) | Auto-generated |
| name | str | Indexed |
| base_unit | str | e.g. g, kg, ml, l, pcs |
| cost_per_base_unit | float? | Nullable, indicative cost |
| is_active | bool | Default: true |
| created_at | datetime | Auto-set |
| updated_at | datetime | Auto-updated |

### Recipe
| Field | Type | Notes |
|-------|------|-------|
| id | int (PK) | Auto-generated |
| name | str | Indexed |
| instructions_raw | str? | Raw text input |
| instructions_structured | JSON? | Derived from LLM parsing |
| yield_quantity | float | Default: 1.0 |
| yield_unit | str | Default: "portion" |
| cost_price | float? | Cached calculation |
| selling_price_est | float? | User-entered |
| status | enum | draft, active, archived |
| is_prep_recipe | bool | Default: false |
| created_at | datetime | Auto-set |
| updated_at | datetime | Auto-updated |

### RecipeIngredient
| Field | Type | Notes |
|-------|------|-------|
| id | int (PK) | Auto-generated |
| recipe_id | int (FK) | → recipes.id |
| ingredient_id | int (FK) | → ingredients.id |
| quantity | float | Required |
| unit | str | Must convert to base_unit |
| sort_order | int | For ordering |
| created_at | datetime | Auto-set |

---

## API Endpoints

### Ingredients (`/api/v1/ingredients`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create ingredient |
| GET | `/` | List ingredients (active_only param) |
| GET | `/{id}` | Get ingredient by ID |
| PATCH | `/{id}` | Update ingredient |
| PATCH | `/{id}/deactivate` | Soft-delete ingredient |

### Recipes (`/api/v1/recipes`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create recipe |
| GET | `/` | List recipes (status filter) |
| GET | `/{id}` | Get recipe by ID |
| PATCH | `/{id}` | Update recipe metadata |
| PATCH | `/{id}/status` | Update recipe status |
| DELETE | `/{id}` | Soft-delete (archive) |

### Recipe Ingredients (`/api/v1/recipes/{id}/ingredients`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List recipe ingredients |
| POST | `/` | Add ingredient to recipe |
| PATCH | `/{ri_id}` | Update quantity/unit |
| DELETE | `/{ri_id}` | Remove ingredient |
| POST | `/reorder` | Reorder ingredients |

### Instructions (`/api/v1/recipes/{id}/instructions`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/raw` | Store raw instructions |
| POST | `/parse` | Parse with LLM → structured |
| PATCH | `/structured` | Manual structured update |

### Costing (`/api/v1/recipes/{id}/costing`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Calculate cost breakdown |
| POST | `/recompute` | Recalculate & persist |

---

## Domain Operations

### IngredientService
- `create_ingredient(data)` → Ingredient
- `list_ingredients(active_only)` → list[Ingredient]
- `get_ingredient(id)` → Ingredient?
- `update_ingredient(id, data)` → Ingredient?
- `update_ingredient_cost(id, cost)` → Ingredient?
- `deactivate_ingredient(id)` → Ingredient?

### RecipeService
- `create_recipe(data)` → Recipe
- `list_recipes(status?)` → list[Recipe]
- `get_recipe(id)` → Recipe?
- `update_recipe_metadata(id, data)` → Recipe?
- `set_recipe_status(id, status)` → Recipe?
- `soft_delete_recipe(id)` → Recipe?
- `get_recipe_ingredients(recipe_id)` → list[RecipeIngredient]
- `add_ingredient_to_recipe(recipe_id, data)` → RecipeIngredient?
- `update_recipe_ingredient(ri_id, data)` → RecipeIngredient?
- `remove_ingredient_from_recipe(ri_id)` → bool
- `reorder_recipe_ingredients(recipe_id, ordered_ids)` → list[RecipeIngredient]

### InstructionsService
- `store_raw_instructions(recipe_id, text)` → Recipe?
- `parse_instructions_with_llm(raw_text)` → dict (placeholder)
- `update_structured_instructions(recipe_id, structured)` → Recipe?
- `parse_and_store_instructions(recipe_id, raw_text)` → Recipe?

### CostingService
- `calculate_recipe_cost(recipe_id)` → CostingResult?
- `persist_cost_snapshot(recipe_id)` → Recipe?

---

## Unit Conversion Support

Mass: `g`, `kg`, `mg`, `oz`, `lb`
Volume: `ml`, `l`, `cl`, `dl`, `tsp`, `tbsp`, `cup`, `fl_oz`
Count: `pcs`, `dozen`

---

## Known Gaps (Intentional)

1. **Ingredient.name not unique** — Index only, no unique constraint
2. **Unit validation deferred** — Validated at costing, not on ingredient add
3. **created_by field** — Deferred for later user system

---

## Running the Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
```

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health

---

## Tests

```bash
cd backend
pytest
```

Test coverage includes:
- Ingredient CRUD operations
- Recipe lifecycle
- Costing calculations with unit conversion
