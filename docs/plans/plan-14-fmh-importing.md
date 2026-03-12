## FMH Data Seeding Script

### Overview

Scripts live in `backend/scripts/`. Run with:

```bash
cd backend

# Seed FMH data
python -m scripts.seed_fmh

# Wipe all FMH-seeded data (with confirmation prompt)
python -m scripts.reset_fmh

# Wipe without prompt
python -m scripts.reset_fmh --yes
```

The seed script reads three Excel files from `backend/exports/` and seeds the database in dependency order using `openpyxl` + `sqlmodel.Session` + the app engine.

> **Before running**: apply migration `c4d5e6f7g8h9` which:
> - Creates the `outlet_supplier_ingredient` join table
> - Removes `outlet_id` from `supplier_ingredients`
> - Makes `outlets.code` nullable

---

### Source files

| Variable | Path |
|---|---|
| `SUPPLIERS_FILE` | `exports/Suppliers.xlsx` — sheet `Suppliers` |
| `PRICINGS_FILE` | `exports/SponsoredSupplierPricings.xlsx` — sheet `Sponsoredsupplierproducts` |
| `PRODUCTS_FILE` | `exports/ProductList_modified.xlsx` (note: `_modified` variant) |

---

### Step 1 — Seed suppliers from `Suppliers.xlsx`

Columns: `Supplier name`, `Phone number`, `Email Address`, `Shipping company name`, `Shipping address`

For each row, upsert one `Supplier` record (skip if name already exists):

```
name                  = row["Supplier name"]
phone_number          = row["Phone number"]        # None if empty
email                 = row["Email Address"]        # None if empty
shipping_company_name = row["Shipping company name"] # None if empty string
address               = row["Shipping address"]     # None if empty
is_active             = True
code                  = None  # filled in Step 2
```

Build in-memory lookup: `supplier_by_name: dict[str, Supplier]`.

---

### Step 2 — Enrich supplier codes from `SponsoredSupplierPricings.xlsx`

Column names (verbatim):
- `Supplier`
- `Product code (Do not edit this field, this is for your reference)`

For each row:
1. Extract the code prefix: split the product code on `-` and take the first segment.
   - e.g. `GLNA-BEV-WINE(RED)-000002` → `GLNA`
2. Build a mapping: `supplier_name → code_prefix` (first encountered per supplier wins).
3. For each entry, look up the supplier in `supplier_by_name` and set `supplier.code = prefix`, then commit.

> Log a warning and skip if the supplier name has no match in Step 1.

After this step, build a second lookup: `supplier_by_code: dict[str, Supplier]` (keyed by code prefix, only for suppliers that have a code).

---

### Step 3 — Seed outlets from `ProductList_modified.xlsx` (`Branch` column)

Column: `Branch`

The `Branch` column may contain comma-separated values (a product can belong to multiple branches). Collect all unique branch strings across all rows.

For each unique branch, upsert one `Outlet` record (skip if name already exists):

```
name             = branch_string  # e.g. "(DRAGON CHAMBER) CIRCULAR DRAGON PTE LTD"
code             = None           # nullable since migration c4d5e6f7g8h9
outlet_type      = "brand"
parent_outlet_id = None
is_active        = True
```

Build lookup: `outlet_by_branch: dict[str, Outlet]`.

---

### Step 4 — Seed categories from `ProductList_modified.xlsx` (`Tags` column)

Column: `Tags`

Collect unique `Tags` values. For each, upsert one `Category` record (skip if name already exists):

```
name = row["Tags"]
```

Build lookup: `category_by_tag: dict[str, Category]`.

---

### Step 5 — Seed ingredients from `ProductList_modified.xlsx`

Columns: `Product code`, `Product name`, `Tags`, `Price`

Deduplicated by `Product code` — if the same product code appears across multiple branch rows, create the ingredient only once.

For each unique product code, upsert one `Ingredient` (skip if a record with the same name already exists):

```
name               = row["Product name"]
base_unit          = parse_pack_from_name(name)[1]   # see below
cost_per_base_unit = price / pack_size                # price from row["Price"]
category_id        = category_by_tag[row["Tags"]].id  # None if tag not in map
source             = "fmh"
is_active          = True
```

**`parse_pack_from_name(name)`**: extracts a quantity+unit token from the product name using a regex. Returns `(pack_size: float, base_unit: str)`.
- `"Chicken Breast 500g"` → `(500.0, "g")`
- `"Fresh Milk 1L"` → `(1.0, "l")`
- `"Eggs 12 pcs"` → `(12.0, "pcs")`
- Falls back to `(1.0, "pcs")` when no match. Units are normalised to `kg | g | l | ml | pcs`.

Build lookup: `ingredient_by_product_code: dict[str, Ingredient]` keyed on `row["Product code"]`.

---

### Step 6 — Seed supplier–ingredient links from `ProductList_modified.xlsx`

Columns: `Product code`, `Product name`, `Branch`, `Price`

The data model for outlet-scoped pricing is now normalised across two tables:

- **`supplier_ingredients`** — one row per product SKU (supplier + ingredient + pricing)
- **`outlet_supplier_ingredient`** — one row per (supplier_ingredient, outlet) pair

For each row:
1. Extract the supplier code prefix from `Product code` (first segment before `-`).
   - e.g. `DRFL-BEV-LIQUEUR-000003` → `DRFL`
2. Look up `supplier = supplier_by_code.get(prefix)`. If not found, log a warning and skip.
3. Look up `ingredient = ingredient_by_product_code.get(product_code)`. If not found, skip.
4. Split `row["Branch"]` on `,` to get a list of branches.
5. Create or reuse a single `SupplierIngredient` per SKU:

```
supplier_id    = supplier.id
ingredient_id  = ingredient.id
sku            = product_code              # e.g. DRFL-BEV-LIQUEUR-000003
pack_size      = parse_pack_from_name(name)[0]
pack_unit      = parse_pack_from_name(name)[1]
price_per_pack = float(row["Price"])
currency       = "SGD"
source         = "fmh"
```

6. For each branch, create one `OutletSupplierIngredient` (skip if the pair already exists):

```
supplier_ingredient_id = si.id
outlet_id              = outlet_by_branch[branch].id
```

> `session.flush()` after creating the `SupplierIngredient` so its ID is available before creating outlet links.

---

### Reset script (`reset_fmh.py`)

Deletes all FMH-seeded data in reverse dependency order:

1. `outlet_supplier_ingredient` — all rows (CASCADE will also fire on SI deletion, but explicit delete is safer)
2. `supplier_ingredients` where `source = 'fmh'`
3. `ingredients` where `source = 'fmh'`
4. `categories` — all rows (NULL out `category_id` on remaining ingredients first)
5. `suppliers` — all rows
6. `outlets` — all rows

Accepts `--yes` / `-y` flag to skip the interactive confirmation prompt.

---

### Error handling

- Empty/blank rows: skip silently.
- Unmatched supplier name (Step 2): `WARNING: supplier '{name}' not found, skipping`
- Unmatched supplier code (Step 6): `WARNING: no supplier with code '{prefix}' for product '{sku}', skipping link`
- DB constraint violations on individual rows: catch, print warning with row identifier, rollback that row, and continue — do not abort the entire run.
