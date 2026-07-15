"""FMH (Food Market Hub) import service.

Implements a two-phase approach: all file parsing and in-memory mapping
completes before any DB writes occur. If mapping fails, nothing is written.
"""

from __future__ import annotations

import re

from openpyxl.workbook import Workbook
from sqlalchemy import func
from sqlmodel import Session, SQLModel, col, select

from app.models.category import Category
from app.models.ingredient import Ingredient
from app.models.outlet_supplier_ingredient import OutletSupplierIngredient
from app.models.passport import PassportUnit
from app.models.supplier import Supplier
from app.models.supplier_ingredient import SupplierIngredient

PRODUCT_CODE_COL = "Product code (Do not edit this field, this is for your reference)"

# Passport owns structure. An import may only LINK to units Passport already knows;
# entities hold no stock, so only brands and outlets are linkable.
LINKABLE_UNIT_TYPES = ("brand", "outlet")
UNIT_STATUS_ACTIVE = "active"

_UNIT_MAP: dict[str, str] = {
    "g": "g", "gm": "g", "gms": "g", "gr": "g", "gram": "g", "grams": "g",
    "kg": "kg", "kgs": "kg", "kilo": "kg",
    "ml": "ml", "mls": "ml",
    "l": "l", "lt": "l", "ltr": "l", "litre": "l", "liter": "l",
    "pcs": "pcs", "pc": "pcs", "pce": "pcs", "piece": "pcs", "pieces": "pcs",
    "unit": "pcs", "units": "pcs",
}


class FMHImportResult(SQLModel):
    """Counts of what an import wrote. No `outlets_created`: Passport is the only place a
    brand or outlet can be born, so a branch name it does not know is a warning, not a row."""

    suppliers_created: int = 0
    suppliers_updated: int = 0
    categories_created: int = 0
    ingredients_created: int = 0
    ingredients_updated: int = 0
    supplier_ingredients_created: int = 0
    supplier_ingredients_updated: int = 0
    outlet_supplier_ingredients_created: int = 0
    warnings: list[str] = []


def _read_sheet(wb: Workbook, sheet_name: str | None = None) -> list[dict]:
    """Load a worksheet into a list of dicts keyed by header row."""
    ws = wb[sheet_name] if sheet_name else wb.active
    if ws is None:
        return []
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


def _parse_pack_from_note(note: str, fallback_name: str) -> tuple[float, str]:
    """Extract pack size and base unit from a packaging note string.

    E.g. "500GM / PKT" → (500.0, "g")
         "1KG / PKT"   → (1000.0, "kg") ... actually (1.0, "kg")
         "1L / BTL"    → (1.0, "l")

    Falls back to _parse_pack_from_name(fallback_name) if no match found.
    """
    pattern = r"(\d+(?:\.\d+)?)\s*(g|gm|gms|gr|gram|grams|kg|kgs|ml|mls|l|lt|ltr|pcs?|pc|pce|pieces?|units?)\b"
    match = re.search(pattern, note, re.IGNORECASE)
    if match:
        raw_unit = match.group(2).lower()
        return float(match.group(1)), _UNIT_MAP.get(raw_unit, "pcs")
    return _parse_pack_from_name(fallback_name)


def _parse_pack_from_name(name: str) -> tuple[float, str]:
    """Extract pack size and base unit from a product name string.

    E.g. "Chicken Breast 500g"  → (500.0, "g")
         "Fresh Milk 1L"        → (1.0, "l")
         "Eggs 12 pcs"          → (12.0, "pcs")

    Falls back to (1.0, "pcs") if no match found.
    """
    pattern = r"(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs?|pc|units?|oz|lbs?|lb)\b"
    match = re.search(pattern, name, re.IGNORECASE)
    if match:
        raw_unit = match.group(2).lower()
        return float(match.group(1)), _UNIT_MAP.get(raw_unit, "pcs")
    return 1.0, "pcs"


def _resolve_units_by_name(
    session: Session, names: set[str], result: FMHImportResult
) -> dict[str, PassportUnit]:
    """Map ``lower(branch name) -> PassportUnit`` for the branches an FMH sheet mentions.

    The sheet names a branch in free text; Passport holds the real unit. We therefore MATCH
    rather than create — a branch Passport does not know (or that is archived) yields a
    warning and its links are skipped, because Prepper may not invent structure.
    """
    if not names:
        return {}

    lowered = [n.lower() for n in names]
    units = session.exec(
        select(PassportUnit).where(
            func.lower(PassportUnit.name).in_(lowered),
            PassportUnit.status == UNIT_STATUS_ACTIVE,
            col(PassportUnit.type).in_(LINKABLE_UNIT_TYPES),
        )
    ).all()

    resolved: dict[str, PassportUnit] = {}
    for unit in units:
        resolved.setdefault(unit.name.lower(), unit)

    for name in sorted(names):
        if name.lower() not in resolved:
            result.warnings.append(
                f"Branch '{name}' matches no active Passport unit — links skipped"
            )
    return resolved


# ---------------------------------------------------------------------------
# Public import functions
# ---------------------------------------------------------------------------


def import_suppliers(
    session: Session,
    suppliers_wb: Workbook,
    pricings_wb: Workbook,
) -> FMHImportResult:
    """Import suppliers and enrich with product codes from pricings workbook.

    Phase 1 (map): reads both workbooks into memory — no DB writes.
    Phase 2 (upsert): writes to DB only after mapping is complete.
    """
    result = FMHImportResult()

    # ------------------------------------------------------------------
    # Phase 1 — Map
    # ------------------------------------------------------------------

    # Step 1: Read suppliers sheet
    supplier_rows = _read_sheet(suppliers_wb, "Suppliers")
    mapped: dict[str, dict] = {}
    for row in supplier_rows:
        name = str(row.get("Supplier name") or "").strip()
        if not name:
            continue
        mapped[name] = {
            "name": name,
            "phone_number": str(row.get("Phone number") or "").strip() or None,
            "email": str(row.get("Email Address") or "").strip() or None,
            "shipping_company_name": str(row.get("Shipping company name") or "").strip() or None,
            "address": str(row.get("Shipping address") or "").strip() or None,
            "code": None,
        }

    # Step 2: Merge codes from pricings sheet
    pricing_rows = _read_sheet(pricings_wb, "Sponsoredsupplierproducts")
    for row in pricing_rows:
        product_code = str(row.get(PRODUCT_CODE_COL) or "").strip()
        supplier_name = str(row.get("Supplier") or "").strip()
        if not product_code or not supplier_name:
            continue
        prefix = product_code.split("-")[0]
        if supplier_name in mapped:
            if mapped[supplier_name]["code"] is None:
                mapped[supplier_name]["code"] = prefix
        else:
            result.warnings.append(
                f"Supplier '{supplier_name}' in pricings not found in suppliers sheet — skipped"
            )

    # ------------------------------------------------------------------
    # Phase 2 — Upsert (1 bulk SELECT + add_all for new suppliers)
    # ------------------------------------------------------------------

    existing_suppliers = session.exec(
        select(Supplier).where(col(Supplier.name).in_(list(mapped.keys())))
    ).all()
    existing_by_name: dict[str, Supplier] = {s.name: s for s in existing_suppliers}

    new_suppliers: list[Supplier] = []
    for shape in mapped.values():
        existing = existing_by_name.get(shape["name"])
        if existing is None:
            new_suppliers.append(Supplier(
                name=shape["name"],
                phone_number=shape["phone_number"],
                email=shape["email"],
                shipping_company_name=shape["shipping_company_name"],
                address=shape["address"],
                code=shape["code"],
                is_active=True,
                source="fmh",
            ))
        else:
            if shape["code"] is not None and existing.code != shape["code"]:
                existing.code = shape["code"]
                session.add(existing)
                result.suppliers_updated += 1

    if new_suppliers:
        session.add_all(new_suppliers)
        result.suppliers_created = len(new_suppliers)

    session.commit()
    return result


def import_ingredients(
    session: Session,
    products_wb: Workbook,
) -> FMHImportResult:
    """Import categories, ingredients, and supplier-ingredient links (scoped to Passport units).

    Phase 0 (guard): ensures suppliers with codes exist.
    Phase 1 (map): reads product workbook into memory — no DB writes.
    Phase 2 (upsert): writes to DB only after mapping is complete.

    Branch names are RESOLVED against the Passport projection, never created: Passport owns
    brands and outlets.

    Raises:
        ValueError: if no suppliers with codes are found in the DB.
    """
    result = FMHImportResult()

    # ------------------------------------------------------------------
    # Phase 0 — Guard: supplier codes must exist
    # ------------------------------------------------------------------

    suppliers = session.exec(
        select(Supplier).where(Supplier.code.is_not(None))  # type: ignore[attr-defined]
    ).all()
    if not suppliers:
        raise ValueError(
            "No suppliers with codes found. Import suppliers first."
        )
    supplier_by_code: dict[str, Supplier] = {s.code: s for s in suppliers if s.code}

    # ------------------------------------------------------------------
    # Phase 1 — Map (single pass over product_rows)
    # ------------------------------------------------------------------

    product_rows = _read_sheet(products_wb)

    branch_names: set[str] = set()
    category_names: set[str] = set()
    ingredient_shapes: dict[str, dict] = {}
    si_shapes: dict[str, dict] = {}

    for row in product_rows:
        # Collect branch names (from all rows, no product_code requirement)
        branch_raw = str(row.get("Branch") or "").strip()
        branches = [b.strip() for b in branch_raw.split(",") if b.strip()]
        branch_names.update(branches)

        # Collect category names (from all rows)
        tag = str(row.get("Tags") or "").strip()
        if tag:
            category_names.add(tag)

        product_code = str(row.get("Product code") or "").strip()
        if not product_code:
            continue

        name = str(row.get("Product name") or "").strip()

        # Map ingredient — first occurrence wins, requires non-empty name
        if product_code not in ingredient_shapes and name:
            pack_size, base_unit = _parse_pack_from_name(name)
            try:
                price_raw = row.get("Price")
                price = float(price_raw) if price_raw not in (None, "") else None
                cost = (price / pack_size) if price and pack_size else price
            except (TypeError, ValueError, ZeroDivisionError):
                cost = None
            ingredient_shapes[product_code] = {
                "name": name,
                "base_unit": base_unit,
                "cost_per_base_unit": cost,
                "tag": tag,
                "source": "fmh",
                "pack_size": pack_size,  # cached to avoid re-running regex in SI loop
            }

        # Map supplier-ingredient link — last occurrence wins
        prefix = product_code.split("-")[0]
        if prefix not in supplier_by_code:
            result.warnings.append(
                f"No supplier with code '{prefix}' for product '{product_code}' — skipped"
            )
            continue
        try:
            price_raw = row.get("Price")
            price_per_pack = float(price_raw) if price_raw not in (None, "") else 0.0
        except (TypeError, ValueError):
            price_per_pack = 0.0
        # Reuse cached pack_size/base_unit; fall back to parsing name if ingredient was skipped
        if product_code in ingredient_shapes:
            pack_size = ingredient_shapes[product_code]["pack_size"]
            base_unit = ingredient_shapes[product_code]["base_unit"]
        else:
            pack_size, base_unit = _parse_pack_from_name(name)
        si_shapes[product_code] = {
            "supplier_code_prefix": prefix,
            "sku": product_code,
            "pack_size": pack_size,
            "pack_unit": base_unit,
            "price_per_pack": price_per_pack,
            "currency": "SGD",
            "source": "fmh",
            "branches": branches,
        }

    # ------------------------------------------------------------------
    # Phase 2 — Upsert (batch inserts: 1 flush per entity type)
    # ------------------------------------------------------------------

    # 5. Resolve branches to Passport units — match only, never create
    unit_by_name = _resolve_units_by_name(session, branch_names, result)

    # 6. Upsert categories — bulk pre-load, then add_all + single flush
    category_by_tag: dict[str, Category] = {}
    if category_names:
        existing_cats = session.exec(
            select(Category).where(col(Category.name).in_(category_names))
        ).all()
        category_by_tag = {c.name: c for c in existing_cats}
    new_cats: list[tuple[str, Category]] = [
        (tag, Category(name=tag, source="fmh"))
        for tag in category_names
        if tag not in category_by_tag
    ]
    if new_cats:
        session.add_all([c for _, c in new_cats])
        session.flush()
        for tag, cat in new_cats:
            category_by_tag[tag] = cat
        result.categories_created = len(new_cats)

    # 7. Upsert ingredients — bulk pre-load, then add_all + single flush
    # Resolution priority: SKU (via existing SupplierIngredient) > name > create new.
    # SKU-first handles FMH renames: if a product_code already has a SupplierIngredient
    # we follow it to the linked Ingredient and update its name instead of creating a duplicate.

    # Pre-load existing SupplierIngredients (needed for SKU-first resolution in Step 7
    # and reused in Step 8 to skip redundant DB reads).
    si_by_sku: dict[str, SupplierIngredient] = {}
    ing_by_sku: dict[str, Ingredient] = {}  # ingredient currently linked to each existing SI
    if si_shapes:
        existing_sis = session.exec(
            select(SupplierIngredient).where(col(SupplierIngredient.sku).in_(list(si_shapes.keys())))
        ).all()
        si_by_sku = {si.sku: si for si in existing_sis}
        si_ing_ids = [si.ingredient_id for si in existing_sis if si.ingredient_id is not None]
        if si_ing_ids:
            ings_for_sis = session.exec(
                select(Ingredient).where(col(Ingredient.id).in_(si_ing_ids))
            ).all()
            ing_by_id = {i.id: i for i in ings_for_sis}
            ing_by_sku = {
                si.sku: ing_by_id[si.ingredient_id]
                for si in existing_sis
                if si.ingredient_id in ing_by_id
            }

    ingredient_by_product_code: dict[str, Ingredient] = {}
    existing_ing_by_name: dict[str, Ingredient] = {}
    if ingredient_shapes:
        ingredient_names = [s["name"] for s in ingredient_shapes.values()]
        existing_ings = session.exec(
            select(Ingredient).where(col(Ingredient.name).in_(ingredient_names))
        ).all()
        existing_ing_by_name = {i.name: i for i in existing_ings}

    def _update_ing_fields(ing: Ingredient, shape: dict, category_id: int | None) -> None:
        ing.name = shape["name"]
        ing.base_unit = shape["base_unit"]
        if shape["cost_per_base_unit"] is not None:
            ing.cost_per_base_unit = shape["cost_per_base_unit"]
        if category_id is not None:
            ing.category_id = category_id
        session.add(ing)

    new_ings_by_name: dict[str, Ingredient] = {}
    for product_code, shape in ingredient_shapes.items():
        name = shape["name"]
        category_id = category_by_tag[shape["tag"]].id if shape["tag"] in category_by_tag else None
        if product_code in ing_by_sku:
            # SKU-first: existing SI → existing Ingredient (handles renames)
            ing = ing_by_sku[product_code]
            _update_ing_fields(ing, shape, category_id)
            result.ingredients_updated += 1
            ingredient_by_product_code[product_code] = ing
        elif name in existing_ing_by_name:
            # Name fallback: new SKU pointing to an already-known ingredient
            ing = existing_ing_by_name[name]
            _update_ing_fields(ing, shape, category_id)
            result.ingredients_updated += 1
            ingredient_by_product_code[product_code] = ing
        elif name not in new_ings_by_name:
            new_ings_by_name[name] = Ingredient(
                name=name,
                base_unit=shape["base_unit"],
                cost_per_base_unit=shape["cost_per_base_unit"],
                category_id=category_id,
                source=shape["source"],
                is_active=True,
            )
    if new_ings_by_name:
        session.add_all(list(new_ings_by_name.values()))
        session.flush()
        result.ingredients_created = len(new_ings_by_name)
    # Map product_codes to newly created ingredients
    for product_code, shape in ingredient_shapes.items():
        if shape["name"] in new_ings_by_name:
            ingredient_by_product_code[product_code] = new_ings_by_name[shape["name"]]

    # 8. Upsert SupplierIngredients — si_by_sku already pre-loaded above

    new_sis: list[tuple[str, SupplierIngredient]] = []
    for product_code, shape in si_shapes.items():
        if product_code in si_by_sku:
            si = si_by_sku[product_code]
            si.pack_size = shape["pack_size"]
            si.pack_unit = shape["pack_unit"]
            si.price_per_pack = shape["price_per_pack"]
            session.add(si)
            result.supplier_ingredients_updated += 1
            continue
        supplier = supplier_by_code.get(shape["supplier_code_prefix"])
        ingredient = ingredient_by_product_code.get(product_code)
        if supplier is None or ingredient is None:
            continue
        new_sis.append((product_code, SupplierIngredient(
            supplier_id=supplier.id,
            ingredient_id=ingredient.id,
            sku=product_code,
            pack_size=shape["pack_size"],
            pack_unit=shape["pack_unit"],
            price_per_pack=shape["price_per_pack"],
            currency=shape["currency"],
            source=shape["source"],
        )))
    if new_sis:
        session.add_all([si for _, si in new_sis])
        session.flush()
        for product_code, si in new_sis:
            si_by_sku[product_code] = si
        result.supplier_ingredients_created = len(new_sis)

    # Upsert OutletSupplierIngredients — bulk pre-load, add_all, no per-row flush
    all_si_ids = [si.id for si in si_by_sku.values() if si.id is not None]
    existing_osi_keys: set[tuple[int, str]] = set()
    if all_si_ids:
        existing_osis = session.exec(
            select(OutletSupplierIngredient).where(
                col(OutletSupplierIngredient.supplier_ingredient_id).in_(all_si_ids)
            )
        ).all()
        existing_osi_keys = {(o.supplier_ingredient_id, o.unit_id) for o in existing_osis}

    new_osis: list[OutletSupplierIngredient] = []
    for product_code, shape in si_shapes.items():
        si = si_by_sku.get(product_code)
        if si is None or si.id is None:
            continue
        for branch in shape["branches"]:
            unit = unit_by_name.get(branch.lower())
            if unit is None:
                continue
            key = (si.id, unit.id)
            if key in existing_osi_keys:
                continue
            new_osis.append(OutletSupplierIngredient(
                supplier_ingredient_id=si.id,
                unit_id=unit.id,
                organization_id=unit.organization_id,
            ))
            existing_osi_keys.add(key)
    if new_osis:
        session.add_all(new_osis)
    result.outlet_supplier_ingredients_created = len(new_osis)

    session.commit()
    return result


def import_buy_catalogue(session: Session, wb: Workbook) -> FMHImportResult:
    """Import categories, suppliers, ingredients, and supplier-ingredient links from an
    EXPORT_BUY_CATALOGUE Excel sheet, scoped to the Passport units the sheet's branches name.

    Phase 1 (map): reads workbook into memory — no DB writes.
    Phase 2 (upsert): bulk writes per entity type, single commit at the end.

    Branches are RESOLVED against the Passport projection, never created: Passport owns brands
    and outlets.
    """
    result = FMHImportResult()

    # ------------------------------------------------------------------
    # Phase 1 — Map (single pass, no DB writes)
    # ------------------------------------------------------------------

    rows = _read_sheet(wb, "EXPORT_BUY_CATALOGUE")

    branch_names: set[str] = set()
    category_keys: dict[str, str] = {}      # lower → title-cased
    supplier_shapes: dict[str, dict] = {}   # lower(name) → {name, code}
    ingredient_shapes: dict[str, dict] = {} # sku → {name, base_unit, cost_per_base_unit, category_lower, pack_size}
    si_shapes: dict[str, dict] = {}         # sku → {supplier_lower, pack_size, pack_unit, price_per_pack, currency, branch_name}

    for row in rows:
        sku = str(row.get("Sku") or "").strip()
        if not sku:
            continue

        branch_name = str(row.get("Branch Name") or "").strip()
        if branch_name:
            branch_names.add(branch_name)

        cat_raw = str(row.get("Category Name") or "").strip()
        if cat_raw:
            cat_lower = cat_raw.lower()
            if cat_lower not in category_keys:
                category_keys[cat_lower] = cat_raw.title()

        supplier_name = str(row.get("Supplier Name") or "").strip()
        if supplier_name:
            sup_lower = supplier_name.lower()
            supplier_shapes[sup_lower] = {
                "name": supplier_name,
                "code": sku.split("-")[0],
            }

        product_name = str(row.get("Product Name") or "").strip()
        if sku not in ingredient_shapes and product_name:
            pack_note = str(row.get("Packaging Note") or "").strip()
            pack_size, base_unit = _parse_pack_from_note(pack_note, product_name)
            try:
                price_raw = row.get("Price")
                price = float(price_raw) if price_raw not in (None, "") else None
                cost = (price / pack_size) if price and pack_size else price
            except (TypeError, ValueError, ZeroDivisionError):
                cost = None
            ingredient_shapes[sku] = {
                "name": product_name,
                "base_unit": base_unit,
                "cost_per_base_unit": cost,
                "category_lower": cat_raw.lower() if cat_raw else "",
                "pack_size": pack_size,
            }

        try:
            price_raw = row.get("Price")
            price_per_pack = float(price_raw) if price_raw not in (None, "") else 0.0
        except (TypeError, ValueError):
            price_per_pack = 0.0

        uom = str(row.get("Uom") or "").strip() or "pcs"
        si_shapes[sku] = {
            "supplier_lower": supplier_name.lower() if supplier_name else "",
            "pack_size": ingredient_shapes.get(sku, {}).get("pack_size", 1.0),
            "pack_unit": uom,
            "price_per_pack": price_per_pack,
            "currency": str(row.get("Currency") or "SGD").strip(),
            "branch_name": branch_name,
        }

    # ------------------------------------------------------------------
    # Phase 2 — Upsert (1 bulk SELECT + add_all per entity type, 1 commit)
    # ------------------------------------------------------------------

    # 1. Branches — resolve to Passport units, match only, never create
    unit_by_lower = _resolve_units_by_name(session, branch_names, result)

    # 2. Categories — filter by lower(name) IN (...)
    category_by_lower: dict[str, Category] = {}
    if category_keys:
        existing_cats = session.exec(
            select(Category).where(func.lower(Category.name).in_(list(category_keys.keys())))
        ).all()
        category_by_lower = {c.name.lower(): c for c in existing_cats}
        new_cats = [
            Category(name=category_keys[lower], source="fmh")
            for lower in category_keys
            if lower not in category_by_lower
        ]
        if new_cats:
            session.add_all(new_cats)
            session.flush()
            for c in new_cats:
                category_by_lower[c.name.lower()] = c
            result.categories_created = len(new_cats)

    # 3. Suppliers — filter by lower(name) IN (...)
    supplier_by_lower: dict[str, Supplier] = {}
    if supplier_shapes:
        existing_sups = session.exec(
            select(Supplier).where(func.lower(Supplier.name).in_(list(supplier_shapes.keys())))
        ).all()
        supplier_by_lower = {s.name.lower(): s for s in existing_sups}
        new_sups = [
            Supplier(
                name=v["name"],
                code=v["code"],
                is_active=True,
                source="fmh",
            )
            for lower, v in supplier_shapes.items()
            if lower not in supplier_by_lower
        ]
        if new_sups:
            session.add_all(new_sups)
            session.flush()
            for s in new_sups:
                supplier_by_lower[s.name.lower()] = s
            result.suppliers_created = len(new_sups)

    # 4. Ingredients (SKU-first upsert)
    si_by_sku: dict[str, SupplierIngredient] = {}
    ing_by_sku: dict[str, Ingredient] = {}
    if si_shapes:
        existing_sis = session.exec(
            select(SupplierIngredient).where(col(SupplierIngredient.sku).in_(list(si_shapes.keys())))
        ).all()
        si_by_sku = {si.sku: si for si in existing_sis}
        si_ing_ids = [si.ingredient_id for si in existing_sis if si.ingredient_id is not None]
        if si_ing_ids:
            ings_for_sis = session.exec(
                select(Ingredient).where(col(Ingredient.id).in_(si_ing_ids))
            ).all()
            ing_by_id = {i.id: i for i in ings_for_sis}
            ing_by_sku = {
                si.sku: ing_by_id[si.ingredient_id]
                for si in existing_sis
                if si.ingredient_id in ing_by_id
            }

    ingredient_by_sku: dict[str, Ingredient] = {}
    existing_ing_by_name: dict[str, Ingredient] = {}
    if ingredient_shapes:
        ing_names = [s["name"] for s in ingredient_shapes.values()]
        existing_ings = session.exec(
            select(Ingredient).where(col(Ingredient.name).in_(ing_names))
        ).all()
        existing_ing_by_name = {i.name: i for i in existing_ings}

    def _update_buy_ing_fields(ing: Ingredient, shape: dict, category_id: int | None) -> None:
        ing.name = shape["name"]
        ing.base_unit = shape["base_unit"]
        if shape["cost_per_base_unit"] is not None:
            ing.cost_per_base_unit = shape["cost_per_base_unit"]
        if category_id is not None:
            ing.category_id = category_id
        session.add(ing)

    new_ings_by_name: dict[str, Ingredient] = {}
    for sku, shape in ingredient_shapes.items():
        name = shape["name"]
        cat_lower = shape["category_lower"]
        cat_obj = category_by_lower.get(cat_lower)
        category_id = cat_obj.id if cat_obj else None
        if sku in ing_by_sku:
            ing = ing_by_sku[sku]
            _update_buy_ing_fields(ing, shape, category_id)
            result.ingredients_updated += 1
            ingredient_by_sku[sku] = ing
        elif name in existing_ing_by_name:
            ing = existing_ing_by_name[name]
            _update_buy_ing_fields(ing, shape, category_id)
            result.ingredients_updated += 1
            ingredient_by_sku[sku] = ing
        elif name not in new_ings_by_name:
            new_ings_by_name[name] = Ingredient(
                name=name,
                base_unit=shape["base_unit"],
                cost_per_base_unit=shape["cost_per_base_unit"],
                category_id=category_id,
                source="fmh",
                is_active=True,
            )
    if new_ings_by_name:
        session.add_all(list(new_ings_by_name.values()))
        session.flush()
        result.ingredients_created = len(new_ings_by_name)
    for sku, shape in ingredient_shapes.items():
        if shape["name"] in new_ings_by_name:
            ingredient_by_sku[sku] = new_ings_by_name[shape["name"]]

    # 5. SupplierIngredients (SKU upsert)
    new_sis_buy: list[tuple[str, SupplierIngredient]] = []
    for sku, shape in si_shapes.items():
        if sku in si_by_sku:
            si = si_by_sku[sku]
            si.pack_size = shape["pack_size"]
            si.pack_unit = shape["pack_unit"]
            si.price_per_pack = shape["price_per_pack"]
            session.add(si)
            result.supplier_ingredients_updated += 1
            continue
        supplier = supplier_by_lower.get(shape["supplier_lower"])
        ingredient = ingredient_by_sku.get(sku)
        if supplier is None or ingredient is None:
            continue
        new_sis_buy.append((sku, SupplierIngredient(
            supplier_id=supplier.id,
            ingredient_id=ingredient.id,
            sku=sku,
            pack_size=shape["pack_size"],
            pack_unit=shape["pack_unit"],
            price_per_pack=shape["price_per_pack"],
            currency=shape["currency"],
            source="fmh",
        )))
    if new_sis_buy:
        session.add_all([si for _, si in new_sis_buy])
        session.flush()
        for sku, si in new_sis_buy:
            si_by_sku[sku] = si
        result.supplier_ingredients_created = len(new_sis_buy)

    # 6. OutletSupplierIngredient links
    all_si_ids_buy = [si.id for si in si_by_sku.values() if si.id is not None]
    existing_osi_keys_buy: set[tuple[int, str]] = set()
    if all_si_ids_buy:
        existing_osis_buy = session.exec(
            select(OutletSupplierIngredient).where(
                col(OutletSupplierIngredient.supplier_ingredient_id).in_(all_si_ids_buy)
            )
        ).all()
        existing_osi_keys_buy = {(o.supplier_ingredient_id, o.unit_id) for o in existing_osis_buy}

    new_osis_buy: list[OutletSupplierIngredient] = []
    for sku, shape in si_shapes.items():
        si = si_by_sku.get(sku)
        if si is None or si.id is None:
            continue
        branch_name = shape["branch_name"]
        if not branch_name:
            continue
        unit = unit_by_lower.get(branch_name.lower())
        if unit is None:
            continue
        key = (si.id, unit.id)
        if key in existing_osi_keys_buy:
            continue
        new_osis_buy.append(OutletSupplierIngredient(
            supplier_ingredient_id=si.id,
            unit_id=unit.id,
            organization_id=unit.organization_id,
        ))
        existing_osi_keys_buy.add(key)
    if new_osis_buy:
        session.add_all(new_osis_buy)
    result.outlet_supplier_ingredients_created = len(new_osis_buy)

    session.commit()
    return result
