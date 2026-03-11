## FMH Data Seeding Script

### Overview

Create `backend/scripts/seed_fmh.py`. Run with:
```bash
cd backend
python -m scripts.seed_fmh
```

The script reads three Excel files from `backend/exports/` and seeds the database in dependency order. Use `openpyxl` to read the files and `sqlmodel.Session` + the app engine (same pattern as other seed scripts).

> **Before running**: apply the migration to add `shipping_company_name` (VARCHAR, nullable) and `code` (VARCHAR(20), nullable) to the `suppliers` table.

---

### Source files

| Variable | Path |
|---|---|
| `SUPPLIERS_FILE` | `exports/Suppliers.xlsx` — sheet `Suppliers` |
| `PRICINGS_FILE` | `exports/SponsoredSupplierPricings.xlsx` — sheet `Sponsoredsupplierproducts` |
| `PRODUCTS_FILE` | `exports/ProductList.xlsx` — sheet `Products` |

---

### Step 1 — Seed suppliers from `Suppliers.xlsx`

Columns: `Supplier name`, `Phone number`, `Email Address`, `Shipping company name`, `Shipping address`

For each row, insert one `Supplier` record:

```
name                 = row["Supplier name"]
phone_number         = row["Phone number"]
email                = row["Email Address"]
shipping_company_name = row["Shipping company name"]  # may be empty string → store as None
address              = row["Shipping address"]
is_active            = True
code                 = None  # filled in Step 2
```

After inserting, build an in-memory lookup: `supplier_by_name: dict[str, Supplier]`.

---

### Step 2 — Enrich supplier codes from `SponsoredSupplierPricings.xlsx`

Column names (verbatim from file):
- `Supplier`
- `Product code (Do not edit this field, this is for your reference)`

For each row:
1. Extract the code prefix: split the product code on `-` and take the first segment.
   - e.g. `GLNA-BEV-WINE(RED)-000002` → `GLNA`
2. Build a mapping: `supplier_name → code_prefix` (one prefix per supplier; take the first encountered).
3. For each entry in the mapping, look up the supplier in `supplier_by_name` and set `supplier.code = prefix`, then commit.

> Log a warning and skip if the supplier name has no match in Step 1.

After this step, build a second lookup: `supplier_by_code: dict[str, Supplier]`.

---

### Step 3 — Seed outlets from `ProductList.xlsx` (`Branch` column)

Column: `Branch`

Collect unique `Branch` values. For each unique branch, insert one `Outlet` record:

```
name             = row["Branch"]           # e.g. "(DRAGON CHAMBER) CIRCULAR DRAGON PTE LTD"
code             = derive_outlet_code(name) # see below — required, max 20 chars, must be unique
outlet_type      = "brand"
parent_outlet_id = None
is_active        = True
```

**`derive_outlet_code(name)`**: extract the text inside the leading parentheses and abbreviate it to initials (first letter of each word, uppercased). Example:
- `(DRAGON CHAMBER) CIRCULAR DRAGON PTE LTD` → `DC`
- `(CAN CARLITOS) CAN CARLITOS PTE LTD` → `CC`

If two branches produce the same initials, append a numeric suffix (`CC2`, `CC3`, …) to ensure uniqueness.

After inserting, build lookup: `outlet_by_branch: dict[str, Outlet]`.

---

### Step 4 — Seed categories from `ProductList.xlsx` (`Tags` column)

Column: `Tags`

Collect unique `Tags` values. For each, insert one `Category` record:

```
name = row["Tags"]
```

After inserting, build lookup: `category_by_tag: dict[str, Category]`.

---

### Step 5 — Seed ingredients from `ProductList.xlsx`

Columns: `Product name`, `UOM`, `Tags`, `Price`, `Min. order`

For each row, insert one `Ingredient` record:

```
name                = row["Product name"]
base_unit           = parse_base_unit(row["UOM"])   # strip display label — see below
cost_per_base_unit  = float(row["Price"]) / float(row["Min. order"])
category_id         = category_by_tag[row["Tags"]].id
source              = "fmh"
```

**`parse_base_unit(uom)`**: the UOM format is `TOKEN (Display Label)` — keep only the token before the space.
- `BOTTLE (Bottle)` → `BOTTLE`
- `TIN (Tin)` → `TIN`

Skip columns: `Description` (no such field on `Ingredient`), `Category`, `Packaging`, `Branch`.
Do **not** store `Min. order` or `Price` directly on the ingredient.

After inserting, build lookup: `ingredient_by_product_code: dict[str, Ingredient]` keyed on `row["Product code"]`.

---

### Step 6 — Seed supplier–ingredient links from `ProductList.xlsx`

Columns: `Product code`, `Branch`, `Min. order`, `Packaging`, `Price`

For each row:
1. Extract the supplier code prefix from `Product code` (first segment before `-`).
   - e.g. `DRFL-BEV-LIQUEUR-000003` → `DRFL`
2. Look up `supplier = supplier_by_code.get(prefix)`. If not found, log a warning and skip.
3. Look up `ingredient = ingredient_by_product_code[row["Product code"]]`.
4. Look up `outlet = outlet_by_branch[row["Branch"]]`.
5. Insert one `SupplierIngredient` record:

```
supplier_id    = supplier.id
ingredient_id  = ingredient.id
outlet_id      = outlet.id
sku            = row["Product code"]          # full code, e.g. DRFL-BEV-LIQUEUR-000003
pack_size      = float(row["Min. order"])
pack_unit      = row["Packaging"]             # e.g. BOTTLE, TIN
price_per_pack = float(row["Price"])
currency       = "SGD"
source         = "fmh"
```

---

### Error handling

- Unmatched supplier name (Step 2): `print(f"WARNING: supplier '{name}' not found, skipping code assignment")`
- Unmatched supplier code (Step 6): `print(f"WARNING: no supplier with code '{prefix}' for product '{sku}', skipping supplier link")`
- All other rows that cannot be inserted (e.g. DB constraint violation) should be caught, logged with the row identifier, and skipped — do not abort the entire run.
