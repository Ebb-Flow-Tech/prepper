# Plan 01: Ingredient Data Model Enhancements

**Completed**: 2024-12-17
**Plan Reference**: `docs/plans/plan-01-ingredient-enhancements.md`

---

## Summary

Extended the `Ingredient` model to support multi-supplier pricing, master ingredient linking (canonical references), and food categorization. This lays the groundwork for FMH integration, supplier-aware costing, and organized ingredient browsing.

---

## Changes Made

### 1. Database Schema

**Migration**: `alembic/versions/a1b2c3d4e5f6_add_ingredient_enhancements.py`

Added 4 new columns to `ingredients` table:

| Column | Type | Description |
|--------|------|-------------|
| `suppliers` | JSON | Array of supplier entries with pricing (JSONB in PostgreSQL) |
| `master_ingredient_id` | INTEGER (FK) | Self-referential FK to parent ingredient for variants |
| `category` | VARCHAR(50) | Food category enum value |
| `source` | VARCHAR(20) | Origin tracking: `"fmh"` or `"manual"` (default: `"manual"`) |

**Indexes added**:
- `ix_ingredients_master_ingredient_id` on `master_ingredient_id`

**Foreign keys added**:
- `fk_ingredients_master_ingredient` → `ingredients.id`

---

### 2. Backend Model Changes

**File**: `backend/app/models/ingredient.py`

#### New Enums

```python
class FoodCategory(str, Enum):
    PROTEINS = "proteins"
    VEGETABLES = "vegetables"
    FRUITS = "fruits"
    DAIRY = "dairy"
    GRAINS = "grains"
    SPICES = "spices"
    OILS_FATS = "oils_fats"
    SAUCES_CONDIMENTS = "sauces_condiments"
    BEVERAGES = "beverages"
    OTHER = "other"

class IngredientSource(str, Enum):
    FMH = "fmh"      # Synced from FoodMarketHub
    MANUAL = "manual" # Manually entered
```

#### New Schemas

- `SupplierEntry` — Schema for supplier JSONB entries
- `SupplierEntryCreate` — Schema for adding suppliers
- `SupplierEntryUpdate` — Schema for updating suppliers

#### Supplier Entry Structure

```json
{
  "supplier_id": "fmh-123",
  "supplier_name": "ABC Foods",
  "sku": "TOM-001",
  "pack_size": 5.0,
  "pack_unit": "kg",
  "price_per_pack": 12.50,
  "currency": "SGD",
  "is_preferred": true,
  "source": "fmh",
  "last_updated": "2024-12-01",
  "last_synced": "2024-12-01"
}
```

#### Self-Referential Relationship

```python
master_ingredient: Optional["Ingredient"] = Relationship(
    back_populates="variants",
    sa_relationship_kwargs={"remote_side": "Ingredient.id"},
)
variants: list["Ingredient"] = Relationship(back_populates="master_ingredient")
```

---

### 3. Service Layer Changes

**File**: `backend/app/domain/ingredient_service.py`

#### Updated Methods

| Method | Change |
|--------|--------|
| `list_ingredients()` | Added filters: `category`, `source`, `master_only` |

#### New Methods

| Method | Description |
|--------|-------------|
| `get_variants(master_id)` | Get all variant ingredients linked to a master |
| `add_supplier(id, data)` | Add a supplier entry to ingredient |
| `update_supplier(id, supplier_id, data)` | Update a supplier entry |
| `remove_supplier(id, supplier_id)` | Remove a supplier entry |
| `get_preferred_supplier(id)` | Get preferred (or first) supplier |

---

### 4. API Endpoint Changes

**File**: `backend/app/api/ingredients.py`

#### Updated Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /ingredients` | Added query params: `category`, `source`, `master_only` |

#### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingredients/categories` | GET | List all food category values |
| `/ingredients/{id}/variants` | GET | Get variants of a master ingredient |
| `/ingredients/{id}/suppliers` | POST | Add a supplier entry |
| `/ingredients/{id}/suppliers/{supplier_id}` | PATCH | Update a supplier entry |
| `/ingredients/{id}/suppliers/{supplier_id}` | DELETE | Remove a supplier entry |
| `/ingredients/{id}/suppliers/preferred` | GET | Get preferred supplier |

---

### 5. Model Exports

**File**: `backend/app/models/__init__.py`

Added exports:
- `FoodCategory`
- `IngredientSource`
- `SupplierEntry`
- `SupplierEntryCreate`
- `SupplierEntryUpdate`

---

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `backend/app/models/ingredient.py` | Modified | Added enums, fields, schemas, relationships |
| `backend/app/models/__init__.py` | Modified | Added new exports |
| `backend/app/domain/ingredient_service.py` | Modified | Added filtering + supplier management |
| `backend/app/api/ingredients.py` | Modified | Added new endpoints + query filters |
| `backend/alembic/versions/a1b2c3d4e5f6_add_ingredient_enhancements.py` | **New** | Migration file |

---

## Testing

All existing tests pass:

```bash
pytest tests/test_ingredients.py tests/test_recipes.py tests/test_costing.py -v
# 8 passed
```

---

## Usage Examples

### Create ingredient with category and source

```bash
curl -X POST http://localhost:8000/api/v1/ingredients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cherry Tomatoes",
    "base_unit": "kg",
    "cost_per_base_unit": 3.50,
    "category": "vegetables",
    "source": "manual"
  }'
```

### Filter by category

```bash
curl "http://localhost:8000/api/v1/ingredients?category=proteins"
```

### Add supplier to ingredient

```bash
curl -X POST http://localhost:8000/api/v1/ingredients/1/suppliers \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "fmh-12345",
    "supplier_name": "ABC Foods",
    "pack_size": 5.0,
    "pack_unit": "kg",
    "price_per_pack": 15.00,
    "currency": "SGD",
    "is_preferred": true,
    "source": "fmh"
  }'
```

### Link variant to master ingredient

```bash
curl -X PATCH http://localhost:8000/api/v1/ingredients/2 \
  -H "Content-Type: application/json" \
  -d '{"master_ingredient_id": 1}'
```

---

## Design Decisions

1. **JSONB for suppliers** — Flexible schema allows varying supplier data without separate tables. Easy to add fields later.

2. **Self-referential FK** — Enables master→variant hierarchy without a separate junction table. Simple queries.

3. **Enum for categories** — Type-safe, limited set of values. Can migrate to separate table if hierarchical categories needed later.

4. **Source tracking** — Distinguishes FMH-synced vs manually-entered ingredients. One-way sync only (manual entries won't sync back to FMH).

5. **Multi-currency support** — Each supplier entry has its own `currency` field. Conversion logic deferred to costing service.

---

## Next Steps

- [ ] Update frontend to display/edit new fields
- [ ] Add category filter to ingredients panel
- [ ] Build supplier management UI
- [ ] Integrate with FMH when API is available (Plan 04)
