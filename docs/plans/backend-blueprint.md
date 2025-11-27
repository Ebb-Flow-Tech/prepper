Below is a **clean, no-nonsense base blueprint** for the MVP you described.

---

# Recipe Builder – MVP Blueprint (FastAPI + SQLModel)

---

## A. DB MODELS / TABLES (SQLModel)

### 1. `Ingredient`

**Purpose:** Canonical ingredient reference + baseline unit cost

**Fields**

* `id` (PK)
* `name` (str, unique)
* `base_unit` (str)

  * e.g. `g`, `kg`, `ml`, `l`, `pcs`
* `cost_per_base_unit` (float | nullable)
* `is_active` (bool, default true)
* `created_at`, `updated_at`

**Notes**

* Cost is *indicative / stale by design*
* No suppliers, inventory, or history

---

### 2. `Recipe`

**Purpose:** The core artifact kitchen + finance cares about

**Fields**

* `id` (PK)
* `name` (str)
* `instructions_raw` (text)
* `instructions_structured` (JSONB)
* `yield_quantity` (float)
* `yield_unit` (str)

  * e.g. `portion`, `kg`, `tray`
* `cost_price` (float | nullable)

  * cached convenience field
* `selling_price_est` (float | nullable)
* `status` (enum: `draft`, `active`, `archived`)
* `is_prep_recipe` (bool, default false)
* `created_at`, `updated_at`
* `created_by` (optional FK/user ref later)

**Notes**

* `instructions_structured` is derived → safe to recompute anytime
* `cost_price` is also derived → cache only

---

### 3. `RecipeIngredient` (Join Table)

**Purpose:** Quantitative link between recipe and ingredients

**Fields**

* `id` (PK)
* `recipe_id` (FK → Recipe)
* `ingredient_id` (FK → Ingredient)
* `quantity` (float)
* `unit` (str)

  * must be convertible to ingredient.base_unit
* `sort_order` (int)
* `created_at`

**Notes**

* This table is **critical**
* All costing and scaling flows through here

---

## B. DOMAIN OPERATIONS LAYER (Business Logic)

(*Pure Python services / functions, no FastAPI concerns here*)

---

### 1. Ingredient Operations

* `create_ingredient(name, base_unit, cost_per_unit)`
* `list_ingredients(active_only=True)`
* `update_ingredient_cost(ingredient_id, new_cost)`
* `deactivate_ingredient(ingredient_id)`

**Rules**

* No cascading logic
* Ingredient cost is baseline only

---

### 2. Recipe Lifecycle Operations

* `create_recipe(name, yield_quantity, yield_unit)`
* `update_recipe_metadata(recipe_id, fields)`
* `set_recipe_status(recipe_id, status)`
* `soft_delete_recipe(recipe_id)`

---

### 3. Recipe Ingredient Management

* `add_ingredient_to_recipe(recipe_id, ingredient_id, quantity, unit)`
* `update_recipe_ingredient(recipe_ingredient_id, quantity, unit)`
* `remove_ingredient_from_recipe(recipe_ingredient_id)`
* `reorder_recipe_ingredients(recipe_id, ordered_ids[])`

**Rules**

* No ingredient duplication per recipe
* Units must be convertible (fail fast)

---

### 4. Instructions Processing

* `store_raw_instructions(recipe_id, text)`
* `parse_instructions_with_llm(raw_text) → structured_json`
* `update_structured_instructions(recipe_id, structured_json)`

**Flow**

1. Save raw text
2. LLM formats → JSON steps
3. User can manually tweak structured output

---

### 5. Costing Engine

* `calculate_recipe_cost(recipe_id)`

**Logic**

1. Fetch `recipe_ingredients`
2. Join with `ingredients`
3. Convert quantity → base_unit
4. Multiply by `cost_per_base_unit`
5. Aggregate:

   * total batch cost
   * cost per portion (using yield)
6. Return structured result

Optional:

* `persist_cost_snapshot(recipe_id, costing_json, cost_price)`

---

## C. API ROUTES LAYER (FastAPI)

(*Thin HTTP layer that delegates to domain operations*)

---

### 1. Ingredient Routes

* `POST /ingredients`
* `GET /ingredients`
* `PATCH /ingredients/{id}`
* `PATCH /ingredients/{id}/deactivate`

---

### 2. Recipe Core Routes

* `POST /recipes`
* `GET /recipes`
* `GET /recipes/{id}`
* `PATCH /recipes/{id}`
* `PATCH /recipes/{id}/status`
* `DELETE /recipes/{id}` *(soft)*

---

### 3. Recipe Ingredients Routes

* `POST /recipes/{id}/ingredients`
* `PATCH /recipes/{id}/ingredients/{ri_id}`
* `DELETE /recipes/{id}/ingredients/{ri_id}`
* `POST /recipes/{id}/ingredients/reorder`

---

### 4. Instructions Routes

* `POST /recipes/{id}/instructions/raw`
* `POST /recipes/{id}/instructions/parse`
* `PATCH /recipes/{id}/instructions/structured`

---

### 5. Costing Routes

* `GET /recipes/{id}/costing`
* `POST /recipes/{id}/costing/recompute`

(Returns breakdown JSON + cost per portion)

---

## Architectural Principles (don’t ignore these)

* SQLModel = schema + validation only
* **All logic lives in domain functions**
* API routes should be almost boring
* JSONB fields are *derived state*, never authoritative
* No background workers, no queues, no events (yet)

---

## What this gives you immediately

* Kitchen-friendly recipe creation
* Structured, readable instructions
* Deterministic costing
* Schema that won’t need rewriting in 6 months
* POS-ready foundation without building POS now
