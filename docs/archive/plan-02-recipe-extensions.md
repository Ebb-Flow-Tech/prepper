# Plan 02: Recipe Extensions

**Status**: Draft
**Priority**: High
**Dependencies**: None (can run parallel to Plan 01)

---

## Overview

Extend the `Recipe` model to support sub-recipe linking (BOM hierarchy), authorship tracking, and outlet/brand attribution. This enables recipe composition, traceability, and multi-brand operations.

---

## 1. Sub-Recipes (Recipe-to-Recipe Linking)

### Goal
Allow recipes to include other recipes as components, creating a Bill of Materials (BOM) hierarchy. Example: "Eggs Benedict" includes "Hollandaise Sauce" as a sub-recipe.

### Data Model

```python
# New junction table: recipe_recipes.py

class RecipeRecipe(SQLModel, table=True):
    """Links a parent recipe to a child (sub-recipe) component."""

    __tablename__ = "recipe_recipes"

    id: int = Field(primary_key=True)
    parent_recipe_id: int = Field(foreign_key="recipe.id", index=True)
    child_recipe_id: int = Field(foreign_key="recipe.id", index=True)

    # How much of the sub-recipe is used
    quantity: float = Field(default=1.0)
    unit: str = Field(default="portion")  # "portion", "batch", "g", "ml"

    # Display order in parent recipe
    position: int = Field(default=0)

    # Relationships
    parent_recipe: "Recipe" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[RecipeRecipe.parent_recipe_id]"}
    )
    child_recipe: "Recipe" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[RecipeRecipe.child_recipe_id]"}
    )

    class Config:
        # Prevent circular references
        __table_args__ = (
            CheckConstraint('parent_recipe_id != child_recipe_id', name='no_self_reference'),
        )
```

### Costing Impact

The `CostingService` must recursively calculate costs:

```python
def calculate_recipe_cost(recipe_id: int) -> CostBreakdown:
    recipe = get_recipe(recipe_id)

    # 1. Direct ingredient costs
    ingredient_cost = sum(ri.quantity * ri.ingredient.unit_cost for ri in recipe.ingredients)

    # 2. Sub-recipe costs (recursive)
    subrecipe_cost = 0
    for rr in recipe.sub_recipes:
        child_cost = calculate_recipe_cost(rr.child_recipe_id)
        # Scale by quantity used
        if rr.unit == "portion":
            subrecipe_cost += child_cost.cost_per_portion * rr.quantity
        elif rr.unit == "batch":
            subrecipe_cost += child_cost.total_batch_cost * rr.quantity
        # ... handle other units

    return CostBreakdown(
        ingredient_cost=ingredient_cost,
        subrecipe_cost=subrecipe_cost,
        total=ingredient_cost + subrecipe_cost
    )
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/recipes/{id}/sub-recipes` | GET | List sub-recipes of a recipe |
| `/recipes/{id}/sub-recipes` | POST | Add a sub-recipe link |
| `/recipes/{id}/sub-recipes/{link_id}` | PUT | Update quantity/unit |
| `/recipes/{id}/sub-recipes/{link_id}` | DELETE | Remove sub-recipe link |
| `/recipes/{id}/sub-recipes/reorder` | POST | Reorder sub-recipes |
| `/recipes/{id}/used-in` | GET | List recipes that use this as a sub-recipe |

### Circular Reference Prevention

Must prevent: A → B → C → A

```python
def can_add_subrecipe(parent_id: int, child_id: int) -> bool:
    """Check if adding child as sub-recipe would create a cycle."""
    if parent_id == child_id:
        return False

    # BFS to check if parent is reachable from child
    visited = set()
    queue = [child_id]

    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)

        # Get all sub-recipes of current
        sub_recipes = get_sub_recipe_ids(current)
        if parent_id in sub_recipes:
            return False  # Cycle detected
        queue.extend(sub_recipes)

    return True
```

---

## 2. Authorship Tracking

### Goal
Track who created and last modified each recipe for accountability and filtering.

### Data Model

```python
class Recipe(SQLModel, table=True):
    # ... existing fields ...

    # NEW: Authorship
    created_by: str | None = Field(default=None, max_length=100)
    updated_by: str | None = Field(default=None, max_length=100)

    # Timestamps (may already exist)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### Notes
- Using simple strings for now (no auth system)
- Could be email, name, or staff ID
- Future: Link to `User` table when auth is added

### API Changes

| Endpoint | Change |
|----------|--------|
| `POST /recipes` | Accept `created_by` |
| `PUT /recipes/{id}` | Accept `updated_by`, auto-update `updated_at` |
| `GET /recipes` | Add `?created_by=John` filter |

---

## 3. Outlet/Brand Attribution

### Goal
Associate recipes with specific outlets (brands/locations) for multi-brand operations.

### Data Model

**New table: Outlet**

```python
class Outlet(SQLModel, table=True):
    """Represents a brand or location."""

    id: int = Field(primary_key=True)
    name: str = Field(max_length=100, unique=True)
    code: str = Field(max_length=20, unique=True)  # Short code: "CS", "TBH"

    # Type distinction
    outlet_type: str = Field(default="brand")  # "brand" | "location"

    # Optional: Parent outlet for franchises
    parent_outlet_id: int | None = Field(foreign_key="outlet.id", default=None)

    # Metadata
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

**Recipe-Outlet Link (Many-to-Many)**

```python
class RecipeOutlet(SQLModel, table=True):
    """Links recipes to outlets (a recipe can be used at multiple outlets)."""

    __tablename__ = "recipe_outlets"

    recipe_id: int = Field(foreign_key="recipe.id", primary_key=True)
    outlet_id: int = Field(foreign_key="outlet.id", primary_key=True)

    # Optional: Outlet-specific overrides
    is_active: bool = Field(default=True)  # Can deactivate for specific outlet
    price_override: float | None = None    # Outlet-specific selling price
```

### API Endpoints

**Outlets**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/outlets` | GET | List all outlets |
| `/outlets` | POST | Create outlet |
| `/outlets/{id}` | GET | Get outlet details |
| `/outlets/{id}` | PUT | Update outlet |
| `/outlets/{id}/recipes` | GET | List recipes for outlet |

**Recipe-Outlet**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/recipes/{id}/outlets` | GET | List outlets using this recipe |
| `/recipes/{id}/outlets` | POST | Add recipe to outlet |
| `/recipes/{id}/outlets/{outlet_id}` | DELETE | Remove from outlet |
| `/recipes` | GET | Add `?outlet_id=1` filter |

---

## Migration Strategy

### Phase 1: Sub-recipes
1. Create `recipe_recipes` table
2. Add API endpoints
3. Update costing service
4. Frontend: Add sub-recipe management UI

### Phase 2: Authorship
1. Add columns to `recipe` table
2. Update all create/update endpoints

### Phase 3: Outlets
1. Create `outlet` and `recipe_outlets` tables
2. Seed initial outlets
3. Add API endpoints
4. Backfill existing recipes to default outlet

---

## Resolved Questions

1. **Outlet seeding**: ✅ Will be done manually via Supabase by the team. No need to build a seeding UI.
2. **Authorship source**: ✅ Manual entry for now (no auth system).

## Open Questions

1. **Sub-recipe units**: What units make sense? Just "portion" and "batch", or allow weight/volume too?
2. **Recipe sharing**: Can a recipe exist without any outlet (global template)?

---

## Acceptance Criteria

- [ ] Recipe can include other recipes as sub-components
- [ ] Circular sub-recipe references are prevented
- [ ] Costing correctly sums ingredient + sub-recipe costs
- [ ] Recipes have created_by/updated_by fields
- [ ] Outlets can be created and managed
- [ ] Recipes can be assigned to multiple outlets
- [ ] Recipes can be filtered by outlet
