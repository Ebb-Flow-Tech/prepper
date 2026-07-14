# Enum to VARCHAR Fix

**Date**: 2025-12-17
**Issue**: 500 Internal Server Error on `/api/v1/ingredients`

---

## Problem

After deploying Plan 01 (Ingredient Enhancements), the ingredients API endpoint started returning 500 errors with:

```
LookupError: 'manual' is not among the defined enum values.
Enum name: ingredientsource. Possible values: FMH, MANUAL
```

The frontend showed CORS errors because the 500 error occurred before CORS headers were added.

---

## Root Cause

**Mismatch between Python Enum and database storage:**

1. **Migration** (`a1b2c3d4e5f6_add_ingredient_enhancements.py`) created VARCHAR columns:
   ```python
   op.add_column('ingredients', sa.Column('source', sa.String(20), server_default='manual'))
   op.add_column('ingredients', sa.Column('category', sa.String(50)))
   ```

2. **Python model** used Enum types:
   ```python
   class IngredientSource(str, Enum):
       FMH = "fmh"
       MANUAL = "manual"

   source: IngredientSource = Field(default=IngredientSource.MANUAL)
   ```

3. **SQLModel behavior**: When using a Python Enum without explicit `sa_column`, SQLModel interprets it as a native PostgreSQL ENUM type, using enum **member names** (FMH, MANUAL) not **values** (fmh, manual).

4. **On read**: Database returns `'manual'` (lowercase string), but SQLAlchemy tries to match it against enum names `FMH, MANUAL` → fails.

---

## Solution

Changed the `Ingredient` model to use explicit `sa_column=Column(String)` for enum-like fields, storing them as VARCHAR instead of native ENUM:

### Before (broken)
```python
class IngredientBase(SQLModel):
    category: FoodCategory | None = Field(default=None)
    source: IngredientSource = Field(default=IngredientSource.MANUAL)
```

### After (fixed)
```python
class IngredientBase(SQLModel):
    # NOTE: category and source are defined on Ingredient table class with sa_column
    # to force VARCHAR storage instead of native PostgreSQL ENUM

class Ingredient(IngredientBase, table=True):
    # Food category - stored as VARCHAR to avoid native ENUM issues
    category: str | None = Field(default=None, sa_column=Column(String(50), nullable=True))

    # Source tracking - stored as VARCHAR to avoid native ENUM issues
    source: str = Field(
        default="manual", sa_column=Column(String(20), nullable=False, default="manual")
    )
```

Also updated `IngredientCreate` and `IngredientUpdate` schemas to use `str` instead of Enum types.

---

## Files Modified

- `backend/app/models/ingredient.py`
  - Added `String` import from sqlalchemy
  - Moved `category` and `source` fields from `IngredientBase` to `Ingredient`
  - Changed field types from Enum to `str`
  - Added explicit `sa_column=Column(String(...))`
  - Updated `IngredientCreate` and `IngredientUpdate` schemas

---

## CORS Update

Also updated `CORS_ORIGINS` secret on Fly.io to include the Vercel deployment:

```bash
fly secrets set CORS_ORIGINS='["https://www.reciperep.com","https://reciperep.com","https://prepper-one.vercel.app","http://localhost:3000"]'
```

---

## Lesson Learned

When using Python Enums with SQLModel/SQLAlchemy:

1. **Native ENUM** (default): SQLAlchemy creates a PostgreSQL ENUM type using member **names**
2. **VARCHAR storage**: Use `sa_column=Column(String(...))` to store enum **values** as strings

If the migration uses VARCHAR but the model uses a Python Enum without `sa_column`, there will be a mismatch causing LookupError on read.

**Best practice**: Either use native PostgreSQL ENUMs consistently (in both migration and model), or use VARCHAR consistently with explicit `sa_column`.
