#!/usr/bin/env python3
"""Seed script for FMH (Food Market Hub) data.

Reads three Excel exports and seeds: suppliers, outlets, categories,
ingredients, and supplier-ingredient links.

Run with: python -m scripts.seed_fmh
"""

import re
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import openpyxl
from sqlmodel import Session, select

from app.database import engine
from app.models.category import Category
from app.models.ingredient import Ingredient
from app.models.outlet import Outlet, OutletType
from app.models.outlet_supplier_ingredient import OutletSupplierIngredient
from app.models.supplier import Supplier
from app.models.supplier_ingredient import SupplierIngredient

EXPORTS_DIR = Path(__file__).parent.parent / "exports"
SUPPLIERS_FILE = EXPORTS_DIR / "Suppliers.xlsx"
PRICINGS_FILE = EXPORTS_DIR / "SponsoredSupplierPricings.xlsx"
PRODUCTS_FILE = EXPORTS_DIR / "ProductList_modified.xlsx"


def read_sheet(path: Path, sheet_name: str | None = None) -> list[dict]:
    """Load a worksheet into a list of dicts keyed by header row."""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet_name] if sheet_name else wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    result = []
    for row in rows[1:]:
        if all(v is None for v in row):
            continue
        result.append({headers[i]: row[i] for i in range(len(headers))})
    return result


def derive_outlet_code(branch: str, used_codes: set[str]) -> str:
    """Derive a short outlet code from a branch string.

    Extracts text inside leading (...), takes initials of each word.
    Appends a numeric suffix on collision.
    """
    match = re.match(r"^\(([^)]+)\)", branch.strip())
    if match:
        inner = match.group(1)
    else:
        inner = branch.strip()

    words = inner.split()
    initials = "".join(w[0].upper() for w in words if w)
    code = (initials or "X")[:18]  # leave room for numeric suffix

    if code not in used_codes:
        return code

    suffix = 2
    while f"{code}{suffix}" in used_codes:
        suffix += 1
    return f"{code}{suffix}"


_UNIT_MAP: dict[str, str] = {
    "kg": "kg",
    "g": "g",
    "l": "l",
    "ml": "ml",
    "pcs": "pcs",
    "pc": "pcs",
}


def parse_pack_from_name(name: str) -> tuple[float, str]:
    """Extract pack size and base unit from a product name string.

    E.g. "Chicken Breast 500g"  → (500.0, "g")
         "Fresh Milk 1L"        → (1.0, "l")
         "Eggs 12 pcs"          → (12.0, "pcs")

    Falls back to (1.0, "pcs") if no match found.
    Anything not in (kg, g, l, ml, pcs) is normalised to "pcs".
    """
    pattern = r"(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs?|pc|units?|oz|lbs?|lb)\b"
    match = re.search(pattern, name, re.IGNORECASE)
    if match:
        raw_unit = match.group(2).lower()
        return float(match.group(1)), _UNIT_MAP.get(raw_unit, "pcs")
    return 1.0, "pcs"


# ---------------------------------------------------------------------------
# Step 1 — Seed suppliers
# ---------------------------------------------------------------------------

def seed_suppliers(session: Session) -> dict[str, Supplier]:
    rows = read_sheet(SUPPLIERS_FILE)
    supplier_by_name: dict[str, Supplier] = {}

    for row in rows:
        name = str(row.get("Supplier name") or "").strip()
        if not name:
            continue

        existing = session.exec(select(Supplier).where(Supplier.name == name)).first()
        if existing:
            supplier_by_name[name] = existing
            continue

        shipping = str(row.get("Shipping company name") or "").strip() or None
        supplier = Supplier(
            name=name,
            phone_number=str(row.get("Phone number") or "").strip() or None,
            email=str(row.get("Email Address") or "").strip() or None,
            shipping_company_name=shipping,
            address=str(row.get("Shipping address") or "").strip() or None,
            is_active=True,
            code=None,
        )
        session.add(supplier)
        session.flush()
        supplier_by_name[name] = supplier

    session.commit()
    print(f"Step 1: {len(supplier_by_name)} suppliers seeded/found.")
    return supplier_by_name


# ---------------------------------------------------------------------------
# Step 2 — Enrich supplier codes from pricings
# ---------------------------------------------------------------------------

PRODUCT_CODE_COL = "Product code (Do not edit this field, this is for your reference)"
SUPPLIER_COL = "Supplier"


def enrich_supplier_codes(
    session: Session, supplier_by_name: dict[str, Supplier]
) -> dict[str, Supplier]:
    rows = read_sheet(PRICINGS_FILE)
    name_to_code: dict[str, str] = {}

    for row in rows:
        product_code = str(row.get(PRODUCT_CODE_COL) or "").strip()
        supplier_name = str(row.get(SUPPLIER_COL) or "").strip()
        if not product_code or not supplier_name:
            continue
        if supplier_name in name_to_code:
            continue
        prefix = product_code.split("-")[0]
        name_to_code[supplier_name] = prefix

    enriched = 0
    for name, prefix in name_to_code.items():
        supplier = supplier_by_name.get(name)
        if supplier is None:
            print(f"WARNING: supplier '{name}' not found, skipping")
            continue
        supplier.code = prefix
        session.add(supplier)
        enriched += 1

    session.commit()

    # Re-fetch to get updated objects
    supplier_by_code: dict[str, Supplier] = {}
    for supplier in supplier_by_name.values():
        session.refresh(supplier)
        if supplier.code:
            supplier_by_code[supplier.code] = supplier

    print(f"Step 2: {enriched} supplier codes enriched.")
    return supplier_by_code


# ---------------------------------------------------------------------------
# Step 3 — Seed outlets
# ---------------------------------------------------------------------------

def seed_outlets(session: Session, product_rows: list[dict]) -> dict[str, Outlet]:
    branches: list[str] = []
    seen: set[str] = set()
    for row in product_rows:
        branch_raw = str(row.get("Branch") or "").strip()
        for branch in (b.strip() for b in branch_raw.split(",") if b.strip()):
            if branch not in seen:
                branches.append(branch)
                seen.add(branch)

    outlet_by_branch: dict[str, Outlet] = {}

    for branch in branches:
        existing = session.exec(select(Outlet).where(Outlet.name == branch)).first()
        if existing:
            outlet_by_branch[branch] = existing
            continue

        outlet = Outlet(
            name=branch,
            code=None,
            outlet_type=OutletType.BRAND,
            parent_outlet_id=None,
            is_active=True,
        )
        session.add(outlet)
        session.flush()
        outlet_by_branch[branch] = outlet

    session.commit()
    print(f"Step 3: {len(outlet_by_branch)} outlets seeded/found.")
    return outlet_by_branch


# ---------------------------------------------------------------------------
# Step 4 — Seed categories
# ---------------------------------------------------------------------------

def seed_categories(session: Session, product_rows: list[dict]) -> dict[str, Category]:
    tags = []
    seen = set()
    for row in product_rows:
        tag = str(row.get("Tags") or "").strip()
        if tag and tag not in seen:
            tags.append(tag)
            seen.add(tag)

    category_by_tag: dict[str, Category] = {}
    for tag in tags:
        existing = session.exec(select(Category).where(Category.name == tag)).first()
        if existing:
            category_by_tag[tag] = existing
            continue

        cat = Category(name=tag)
        session.add(cat)
        session.flush()
        category_by_tag[tag] = cat

    session.commit()
    print(f"Step 4: {len(category_by_tag)} categories seeded/found.")
    return category_by_tag


# ---------------------------------------------------------------------------
# Step 5 — Seed ingredients (deduplicated by product code)
# ---------------------------------------------------------------------------

def seed_ingredients(
    session: Session,
    product_rows: list[dict],
    category_by_tag: dict[str, Category],
) -> dict[str, Ingredient]:
    seen_codes: dict[str, Ingredient] = {}

    for row in product_rows:
        product_code = str(row.get("Product code") or "").strip()
        if not product_code or product_code in seen_codes:
            continue

        name = str(row.get("Product name") or "").strip()
        pack_size, base_unit = parse_pack_from_name(name)

        tag = str(row.get("Tags") or "").strip()
        category_id = category_by_tag[tag].id if tag in category_by_tag else None

        try:
            price_raw = row.get("Price")
            price = float(price_raw) if price_raw not in (None, "") else None
            cost = price / pack_size if price and pack_size else price
        except (TypeError, ValueError, ZeroDivisionError):
            cost = None

        existing = session.exec(
            select(Ingredient).where(Ingredient.name == name)
        ).first()
        if existing:
            seen_codes[product_code] = existing
            continue

        try:
            ingredient = Ingredient(
                name=name,
                base_unit=base_unit,
                cost_per_base_unit=cost,
                category_id=category_id,
                source="fmh",
                is_active=True,
            )
            session.add(ingredient)
            session.flush()
            seen_codes[product_code] = ingredient
        except Exception as exc:
            print(f"WARNING: could not create ingredient '{name}' ({product_code}): {exc}")
            session.rollback()

    session.commit()
    print(f"Step 5: {len(seen_codes)} ingredients seeded/found.")
    return seen_codes


# ---------------------------------------------------------------------------
# Step 6 — Seed supplier-ingredient links
# ---------------------------------------------------------------------------

def seed_supplier_ingredient_links(
    session: Session,
    product_rows: list[dict],
    supplier_by_code: dict[str, Supplier],
    ingredient_by_product_code: dict[str, Ingredient],
    outlet_by_branch: dict[str, Outlet],
) -> None:
    si_created = 0
    osi_created = 0
    skipped = 0

    for row in product_rows:
        product_code = str(row.get("Product code") or "").strip()
        branch_raw = str(row.get("Branch") or "").strip()
        branches = [b.strip() for b in branch_raw.split(",") if b.strip()]

        if not product_code or not branches:
            continue

        prefix = product_code.split("-")[0]
        supplier = supplier_by_code.get(prefix)
        if supplier is None:
            print(
                f"WARNING: no supplier with code '{prefix}' for product "
                f"'{product_code}', skipping link"
            )
            skipped += len(branches)
            continue

        ingredient = ingredient_by_product_code.get(product_code)
        if ingredient is None:
            skipped += len(branches)
            continue

        name = str(row.get("Product name") or "").strip()
        pack_size, pack_unit = parse_pack_from_name(name)

        try:
            price_raw = row.get("Price")
            price_per_pack = float(price_raw) if price_raw not in (None, "") else 0.0
        except (TypeError, ValueError):
            price_per_pack = 0.0

        # Create or reuse a single SupplierIngredient per product_code (sku)
        si = session.exec(
            select(SupplierIngredient).where(SupplierIngredient.sku == product_code)
        ).first()

        if si is None:
            try:
                si = SupplierIngredient(
                    supplier_id=supplier.id,
                    ingredient_id=ingredient.id,
                    sku=product_code,
                    pack_size=pack_size,
                    pack_unit=pack_unit,
                    price_per_pack=price_per_pack,
                    currency="SGD",
                    source="fmh",
                )
                session.add(si)
                session.flush()
                si_created += 1
            except Exception as exc:
                print(f"WARNING: could not create supplier_ingredient for '{product_code}': {exc}")
                session.rollback()
                skipped += len(branches)
                continue

        # Create an OutletSupplierIngredient for each branch
        for branch in branches:
            outlet = outlet_by_branch.get(branch)
            if outlet is None:
                skipped += 1
                continue

            existing_osi = session.exec(
                select(OutletSupplierIngredient).where(
                    OutletSupplierIngredient.supplier_ingredient_id == si.id,
                    OutletSupplierIngredient.outlet_id == outlet.id,
                )
            ).first()
            if existing_osi:
                continue

            try:
                osi = OutletSupplierIngredient(
                    supplier_ingredient_id=si.id,
                    outlet_id=outlet.id,
                )
                session.add(osi)
                session.flush()
                osi_created += 1
            except Exception as exc:
                print(f"WARNING: could not create outlet link for '{product_code}' @ '{branch}': {exc}")
                session.rollback()
                skipped += 1

    session.commit()
    print(
        f"Step 6: {si_created} supplier-ingredients created, "
        f"{osi_created} outlet links created, {skipped} skipped."
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("Loading product rows...")
    product_rows = read_sheet(PRODUCTS_FILE)
    print(f"  {len(product_rows)} product rows loaded.")

    with Session(engine) as session:
        supplier_by_name = seed_suppliers(session)
        supplier_by_code = enrich_supplier_codes(session, supplier_by_name)
        outlet_by_branch = seed_outlets(session, product_rows)
        category_by_tag = seed_categories(session, product_rows)
        ingredient_by_product_code = seed_ingredients(session, product_rows, category_by_tag)
        seed_supplier_ingredient_links(
            session,
            product_rows,
            supplier_by_code,
            ingredient_by_product_code,
            outlet_by_branch,
        )

    print("\nDone.")


if __name__ == "__main__":
    main()
