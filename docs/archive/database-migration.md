# Database Migration Summary

**Completed:** 2024-11-27
**Revision:** `db480a186284`
**Target:** Supabase PostgreSQL

---

## Overview

Applied initial Alembic migration to create all SQLModel tables in the Supabase production database.

---

## Tables Created

### `ingredients`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| name | VARCHAR | INDEX |
| base_unit | VARCHAR | NOT NULL |
| cost_per_base_unit | FLOAT | NULLABLE |
| is_active | BOOLEAN | NOT NULL |
| created_at | DATETIME | NOT NULL |
| updated_at | DATETIME | NOT NULL |

### `recipes`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| name | VARCHAR | INDEX |
| yield_quantity | FLOAT | NOT NULL |
| yield_unit | VARCHAR | NOT NULL |
| is_prep_recipe | BOOLEAN | NOT NULL |
| instructions_raw | VARCHAR | NULLABLE |
| instructions_structured | JSON | NULLABLE |
| cost_price | FLOAT | NULLABLE |
| selling_price_est | FLOAT | NULLABLE |
| status | ENUM | NOT NULL (draft/active/archived) |
| created_at | DATETIME | NOT NULL |
| updated_at | DATETIME | NOT NULL |

### `recipe_ingredients`
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY |
| recipe_id | INTEGER | FOREIGN KEY → recipes.id, INDEX |
| ingredient_id | INTEGER | FOREIGN KEY → ingredients.id, INDEX |
| quantity | FLOAT | NOT NULL |
| unit | VARCHAR | NOT NULL |
| sort_order | INTEGER | NOT NULL |
| created_at | DATETIME | NOT NULL |

---

## Indexes

- `ix_ingredients_name` — `ingredients.name`
- `ix_recipes_name` — `recipes.name`
- `ix_recipe_ingredients_recipe_id` — `recipe_ingredients.recipe_id`
- `ix_recipe_ingredients_ingredient_id` — `recipe_ingredients.ingredient_id`

---

## Bug Fix Applied

**Issue:** `Recipe.instructions_structured` used `sqlalchemy.dialects.sqlite.JSON`, which is SQLite-specific.

**Fix:** Changed to `sqlalchemy.JSON` (dialect-agnostic) in both:
- `app/models/recipe.py` — source model
- `alembic/versions/db480a186284_initial_tables.py` — migration file

This ensures JSON fields work correctly across:
- **PostgreSQL (Supabase)** → native `JSONB`
- **SQLite (local dev/tests)** → text-based JSON

---

## Commands Used

```bash
cd backend
source venv/bin/activate

# Create versions directory (was missing)
mkdir -p alembic/versions

# Generate migration
alembic revision --autogenerate -m "initial_tables"

# Apply to Supabase
alembic upgrade head

# Verify
alembic current
# → db480a186284 (head)
```

---

## File Changes

| File | Change |
|------|--------|
| `app/models/recipe.py` | `sqlite.JSON` → `sqlalchemy.JSON` |
| `alembic/versions/db480a186284_initial_tables.py` | Created (with JSON fix) |
| `alembic/versions/` | Directory created |

---

## Verification

Migration status confirmed at head revision. Database ready for application use.
