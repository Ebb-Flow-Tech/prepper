# Plan 01: Ingredient Data Model Enhancements

**Status**: Draft
**Priority**: High (Foundation for other features)
**Dependencies**: None

---

## Overview

Extend the `Ingredient` model to support supplier pricing, master ingredient mapping, and food categorization. This lays the groundwork for supplier-aware costing, procurement integration, and organized ingredient browsing.

---

## 1. Suppliers + Prices (JSONB)

### Goal
Track multiple suppliers per ingredient with their specific pricing, pack sizes, and SKUs.

### Data Model

```python
# In models/ingredient.py

class Ingredient(SQLModel, table=True):
    # ... existing fields ...

    # NEW: Supplier pricing data
    suppliers: dict | None = Field(
        default=None,
        sa_column=Column(JSON)
    )
    # Structure:
    # {
    #   "suppliers": [
    #     {
    #       "supplier_id": "fmh-123",        # External ID (FMH) or internal UUID
    #       "supplier_name": "ABC Foods",
    #       "sku": "TOM-001",
    #       "pack_size": 5.0,
    #       "pack_unit": "kg",
    #       "price_per_pack": 12.50,
    #       "currency": "SGD",               # Multi-currency supported
    #       "is_preferred": true,
    #       "source": "fmh",                 # "fmh" | "manual" - tracks origin
    #       "last_updated": "2024-12-01",
    #       "last_synced": "2024-12-01"      # Only for FMH-sourced entries
    #     }
    #   ]
    # }

    # NEW: Ingredient-level source tracking
    source: str = Field(default="manual")  # "fmh" | "manual"
```

### API Changes

| Endpoint | Change |
|----------|--------|
| `POST /ingredients` | Accept `suppliers` in body |
| `PUT /ingredients/{id}` | Update `suppliers` |
| `GET /ingredients/{id}` | Return `suppliers` |
| `POST /ingredients/{id}/suppliers` | Add a supplier entry |
| `DELETE /ingredients/{id}/suppliers/{supplier_id}` | Remove supplier |

### Costing Impact
- `CostingService` should use `is_preferred` supplier's price
- Fall back to first supplier if no preferred set
- Future: Smart selection based on order quantity or availability

---

## 2. Master Ingredient (Canonical Reference)

### Goal
Link supplier-specific or variant ingredients to a canonical "master" ingredient for standardization and reporting.

### Data Model

```python
class Ingredient(SQLModel, table=True):
    # ... existing fields ...

    # NEW: Self-referential FK to master ingredient
    master_ingredient_id: int | None = Field(
        default=None,
        foreign_key="ingredient.id"
    )

    # Relationship
    master_ingredient: "Ingredient" = Relationship(
        sa_relationship_kwargs={"remote_side": "Ingredient.id"}
    )
    variants: list["Ingredient"] = Relationship(back_populates="master_ingredient")
```

### Use Cases
- "Cherry Tomatoes (FMH)" → master: "Tomatoes"
- "Tomatoes - Roma (ABC Foods)" → master: "Tomatoes"
- Enables aggregation in reports: "How much do we spend on Tomatoes across all variants?"

### API Changes

| Endpoint | Change |
|----------|--------|
| `POST /ingredients` | Accept `master_ingredient_id` |
| `PUT /ingredients/{id}` | Update `master_ingredient_id` |
| `GET /ingredients` | Add `?master_only=true` filter |
| `GET /ingredients/{id}/variants` | List all variants of a master |

---

## 3. Food Category

### Goal
Categorize ingredients for filtering, grouping, and kitchen organization.

### Data Model

**Option A: Simple enum**
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

class Ingredient(SQLModel, table=True):
    # ... existing fields ...
    category: FoodCategory | None = Field(default=None)
```

**Option B: Separate table (more flexible)**
```python
class FoodCategory(SQLModel, table=True):
    id: int = Field(primary_key=True)
    name: str = Field(unique=True)
    parent_id: int | None = Field(foreign_key="foodcategory.id")  # Hierarchical
    icon: str | None = None  # For UI
```

### Recommendation
Start with **Option A** (enum) for simplicity. Migrate to Option B if hierarchical categories become necessary.

### API Changes

| Endpoint | Change |
|----------|--------|
| `GET /ingredients` | Add `?category=proteins` filter |
| `GET /categories` | List all categories (if using Option B) |

---

## Migration Strategy

1. Add columns with `ALTER TABLE` (nullable initially)
2. Backfill existing ingredients with defaults
3. Update API to handle new fields
4. Update frontend components

### Alembic Migration

```python
def upgrade():
    op.add_column('ingredient', sa.Column('suppliers', sa.JSON(), nullable=True))
    op.add_column('ingredient', sa.Column('master_ingredient_id', sa.Integer(), nullable=True))
    op.add_column('ingredient', sa.Column('category', sa.String(50), nullable=True))
    op.create_foreign_key(
        'fk_ingredient_master',
        'ingredient', 'ingredient',
        ['master_ingredient_id'], ['id']
    )
```

---

## Resolved Questions

1. **Supplier data source**: ✅ Both FMH sync AND manual entry supported. Each ingredient/supplier entry tagged with `source: "fmh" | "manual"`. **One-way sync only** — manually added ingredients will NOT sync back to FMH.
2. **Currency handling**: ✅ Multi-currency supported. Each supplier entry has its own `currency` field.

## Open Questions

1. **Price history**: Track historical prices or just current?
2. **Category hierarchy**: Need sub-categories (e.g., Proteins → Beef → Ground Beef)?
3. **Currency conversion**: For costing, should we convert to a base currency (SGD) or display in original currency?

---

## Acceptance Criteria

- [ ] Ingredient can have multiple suppliers with pricing
- [ ] Ingredient can link to a master ingredient
- [ ] Ingredient has a food category
- [ ] Costing uses preferred supplier's price
- [ ] API filters work for category and master-only queries
