"""Ingredient domain operations."""

from datetime import datetime

from sqlmodel import Session, col, select

from app.domain.org_scope import org_scope
from app.models import (
    FoodCategory,
    Ingredient,
    IngredientCreate,
    IngredientListRead,
    IngredientSource,
    IngredientUpdate,
    PassportUnit,
    SupplierIngredient,
    SupplierIngredientCreate,
    SupplierIngredientRead,
    SupplierIngredientUpdate,
)
from app.models.supplier import Supplier
from app.passport import access

UNIT_NOT_FOUND = "Unit not found"
# Re-homing a link is org-admin-only (see `update_ingredient_supplier`). Distinct from "not found"
# because the caller CAN see this link — they are being denied the move, not the row.
NOT_ORG_ADMIN_FOR_MOVE = "Only an organisation admin can move a link to a different unit"
SKU_ALREADY_EXISTS = "SKU already exists"


class IngredientService:
    """Service for ingredient CRUD operations."""

    def __init__(self, session: Session, organization_id: str):
        """``organization_id`` is required and has no default — see `CategoryService.__init__`."""
        self.session = session
        self.organization_id = organization_id
        self._accessible_unit_ids_cache: dict[str, set[str]] = {}

    def _get_accessible_unit_ids(self, subject: str) -> set[str]:
        """Every Passport unit the user may see, cached for the life of the request.

        Prepper no longer walks a local outlet hierarchy: Passport owns structure, so the
        brand->outlet expansion happens once, in ``access.accessible_unit_ids``.
        """
        if subject not in self._accessible_unit_ids_cache:
            self._accessible_unit_ids_cache[subject] = access.accessible_unit_ids(
                self.session, subject
            )
        return self._accessible_unit_ids_cache[subject]

    def _unit_names(self, unit_ids: set[str]) -> dict[str, str]:
        """``{unit_id: name}`` for the given units, in one query.

        Unit names live in the Passport projection, not on a local join row, so they are
        batch-loaded here rather than lazily traversed per link (N+1).
        """
        if not unit_ids:
            return {}
        rows = self.session.exec(
            select(PassportUnit.id, PassportUnit.name).where(
                col(PassportUnit.id).in_(unit_ids)
            )
        ).all()
        return {unit_id: name for unit_id, name in rows}

    def create_ingredient(self, data: IngredientCreate) -> Ingredient:
        """Create a new ingredient, stamped with the acting org.

        The org comes from the acting org context, never from the request body — the Create
        schemas deliberately have no such field. A tenant id a client can assert is not a
        tenant id, for the same reason `owner_id` and `users.email` are not.
        """
        ingredient = Ingredient.model_validate(data)
        ingredient.organization_id = self.organization_id
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def list_ingredients(
        self,
        active_only: bool = True,
        category: FoodCategory | None = None,
        source: IngredientSource | None = None,
        master_only: bool = False,
    ) -> list[Ingredient]:
        """List this org's ingredients with optional filters.

        Args:
            active_only: If True, only return active ingredients
            category: Filter by food category
            source: Filter by source (fmh or manual)
            master_only: If True, only return ingredients without a master (top-level)
        """
        statement = select(Ingredient).where(org_scope(Ingredient, self.organization_id))

        if active_only:
            statement = statement.where(Ingredient.is_active == True)

        if category is not None:
            statement = statement.where(Ingredient.category == category)

        if source is not None:
            statement = statement.where(Ingredient.source == source)

        if master_only:
            statement = statement.where(Ingredient.master_ingredient_id == None)

        return list(self.session.exec(statement).all())

    def _build_list_query(self, active_only=True, category=None, source=None, master_only=False, search=None,
                          category_ids=None, units=None, allergen_ids=None, is_halal=None):
        statement = select(Ingredient).where(org_scope(Ingredient, self.organization_id))
        if active_only:
            statement = statement.where(Ingredient.is_active == True)
        if category is not None:
            statement = statement.where(Ingredient.category == category)
        if source is not None:
            statement = statement.where(Ingredient.source == source)
        if master_only:
            statement = statement.where(Ingredient.master_ingredient_id == None)
        if search:
            from sqlalchemy import or_

            from app.models.category import Category
            from app.models.supplier import Supplier
            from app.models.supplier_ingredient import SupplierIngredient as SI

            for token in search.split():
                term = f"%{token}%"
                cat_subq = (
                    select(Ingredient.id)
                    .join(Category, Ingredient.category_id == Category.id)
                    .where(Category.name.ilike(term))
                ).scalar_subquery()
                sup_subq = (
                    select(SI.ingredient_id)
                    .join(Supplier, SI.supplier_id == Supplier.id)
                    .where(Supplier.name.ilike(term))
                ).scalar_subquery()
                statement = statement.where(
                    or_(
                        Ingredient.name.ilike(term),
                        Ingredient.id.in_(cat_subq),
                        Ingredient.id.in_(sup_subq),
                    )
                )
        if category_ids:
            statement = statement.where(Ingredient.category_id.in_(category_ids))
        if units:
            statement = statement.where(Ingredient.base_unit.in_(units))
        if is_halal is not None:
            statement = statement.where(Ingredient.is_halal.in_(is_halal))
        if allergen_ids:
            from app.models.ingredient_allergen import IngredientAllergen
            allergen_subquery = select(IngredientAllergen.ingredient_id).where(
                IngredientAllergen.allergen_id.in_(allergen_ids)
            ).distinct()
            statement = statement.where(Ingredient.id.in_(allergen_subquery))
        return statement

    def _apply_sort(self, statement, sort_by: str | None):
        """Apply ORDER BY to a statement based on sort_by value."""
        if sort_by == "name_desc":
            return statement.order_by(Ingredient.name.desc())
        if sort_by == "price_asc":
            return statement.order_by(Ingredient.cost_per_base_unit.asc().nulls_last())
        if sort_by == "price_desc":
            return statement.order_by(Ingredient.cost_per_base_unit.desc().nulls_last())
        # default: name_asc
        return statement.order_by(Ingredient.name.asc())

    def _bulk_load_supplier_names(self, ingredient_ids: list[int]) -> dict[int, list[str]]:
        """Return {ingredient_id: [supplier_name, ...]} with preferred supplier first."""
        if not ingredient_ids:
            return {}
        from collections import defaultdict
        supplier_rows = self.session.exec(
            select(SupplierIngredient.ingredient_id, Supplier.name, SupplierIngredient.is_preferred)
            .join(Supplier, SupplierIngredient.supplier_id == Supplier.id)
            .where(SupplierIngredient.ingredient_id.in_(ingredient_ids))
        ).all()
        sup_map: dict[int, list[tuple[str, bool]]] = defaultdict(list)
        for ing_id, name, is_preferred in supplier_rows:
            if name:
                sup_map[ing_id].append((name, is_preferred))
        return {
            ing_id: [n for n, _ in sorted(entries, key=lambda x: (not x[1], x[0]))]
            for ing_id, entries in sup_map.items()
        }

    def list_paginated(self, offset: int, limit: int, active_only=True, category=None, source=None, master_only=False, search=None,
                        category_ids=None, units=None, allergen_ids=None, is_halal=None, sort_by=None) -> list[IngredientListRead]:
        statement = self._build_list_query(active_only=active_only, category=category, source=source, master_only=master_only, search=search,
                                           category_ids=category_ids, units=units, allergen_ids=allergen_ids, is_halal=is_halal)
        statement = self._apply_sort(statement, sort_by).offset(offset).limit(limit)
        rows = list(self.session.exec(statement).all())
        sup_map = self._bulk_load_supplier_names([r.id for r in rows])
        result = []
        for r in rows:
            item = IngredientListRead.model_validate(r)
            item.supplier_names = sup_map.get(r.id, [])
            result.append(item)
        return result

    def count(self, active_only=True, category=None, source=None, master_only=False, search=None,
              category_ids=None, units=None, allergen_ids=None, is_halal=None, sort_by=None) -> int:
        from sqlalchemy import func
        statement = self._build_list_query(active_only=active_only, category=category, source=source, master_only=master_only, search=search,
                                           category_ids=category_ids, units=units, allergen_ids=allergen_ids, is_halal=is_halal)
        count_stmt = select(func.count()).select_from(statement.subquery())
        return self.session.exec(count_stmt).one()

    def list_paginated_with_count(self, offset: int, limit: int, active_only=True, category=None, source=None, master_only=False, search=None,
                                   category_ids=None, units=None, allergen_ids=None, is_halal=None, sort_by=None) -> tuple[list[IngredientListRead], int]:
        """Return paginated items and total count, reusing the same base filter."""
        from sqlalchemy import func
        base = self._build_list_query(active_only=active_only, category=category, source=source, master_only=master_only, search=search,
                                       category_ids=category_ids, units=units, allergen_ids=allergen_ids, is_halal=is_halal)
        total = self.session.exec(select(func.count()).select_from(base.subquery())).one()
        rows = list(self.session.exec(self._apply_sort(base, sort_by).offset(offset).limit(limit)).all())
        sup_map = self._bulk_load_supplier_names([r.id for r in rows])
        result = []
        for r in rows:
            item = IngredientListRead.model_validate(r)
            item.supplier_names = sup_map.get(r.id, [])
            result.append(item)
        return result, total

    def get_ingredient(self, ingredient_id: int) -> Ingredient | None:
        """Get an ingredient by ID, within this org.

        The update and soft-delete paths resolve through here, so the predicate guards the writes
        as well as the read — a `session.get()` would hand back another org's row on a guessed
        integer, and cost data is the most sensitive thing in the catalogue.
        """
        return self.session.exec(
            select(Ingredient).where(
                Ingredient.id == ingredient_id,
                org_scope(Ingredient, self.organization_id),
            )
        ).first()

    def get_variants(self, master_ingredient_id: int) -> list[Ingredient]:
        """Get all variant ingredients linked to a master ingredient, within this org."""
        statement = select(Ingredient).where(
            Ingredient.master_ingredient_id == master_ingredient_id,
            Ingredient.is_active == True,
            org_scope(Ingredient, self.organization_id),
        )
        return list(self.session.exec(statement).all())

    def update_ingredient(
        self, ingredient_id: int, data: IngredientUpdate
    ) -> Ingredient | None:
        """Update an ingredient's fields."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ingredient, key, value)

        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def update_ingredient_cost(
        self, ingredient_id: int, new_cost: float
    ) -> Ingredient | None:
        """Update an ingredient's cost per base unit."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        ingredient.cost_per_base_unit = new_cost
        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    def deactivate_ingredient(self, ingredient_id: int) -> Ingredient | None:
        """Soft-delete an ingredient by setting is_active to False."""
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        ingredient.is_active = False
        ingredient.updated_at = datetime.utcnow()
        self.session.add(ingredient)
        self.session.commit()
        self.session.refresh(ingredient)
        return ingredient

    # -------------------------------------------------------------------------
    # Supplier Management (via supplier_ingredients table)
    # -------------------------------------------------------------------------

    def _build_supplier_ingredient_read(
        self,
        si: SupplierIngredient,
        unit_names: dict[str, str],
        accessible_unit_ids: set[str] | None = None,
    ) -> SupplierIngredientRead:
        """Build a SupplierIngredientRead DTO from a SupplierIngredient row.

        If accessible_unit_ids is provided, the unit shown is the first link whose unit_id
        is in that set (non-admin scoping).
        """
        supplier_name = si.supplier.name if si.supplier else None
        ingredient_name = si.ingredient.name if si.ingredient else None

        # Derive unit_id and unit_name from the unit links.
        # When scoped to accessible units, pick the first matching link.
        unit_id = None
        unit_name = None
        if si.outlet_links:
            links = (
                [lnk for lnk in si.outlet_links if lnk.unit_id in accessible_unit_ids]
                if accessible_unit_ids is not None
                else si.outlet_links
            )
            if links:
                unit_id = links[0].unit_id
                unit_name = unit_names.get(unit_id)

        return SupplierIngredientRead(
            id=si.id,
            ingredient_id=si.ingredient_id,
            supplier_id=si.supplier_id,
            unit_id=unit_id,
            sku=si.sku,
            pack_size=si.pack_size,
            pack_unit=si.pack_unit,
            price_per_pack=si.price_per_pack,
            currency=si.currency,
            source=si.source,
            is_preferred=si.is_preferred,
            created_at=si.created_at,
            updated_at=si.updated_at,
            supplier_name=supplier_name,
            ingredient_name=ingredient_name,
            unit_name=unit_name,
        )

    def _build_reads(
        self,
        rows: list[SupplierIngredient],
        accessible_unit_ids: set[str] | None = None,
    ) -> list[SupplierIngredientRead]:
        """Build DTOs for several rows, resolving every referenced unit name in one query."""
        linked_unit_ids = {lnk.unit_id for si in rows for lnk in si.outlet_links}
        unit_names = self._unit_names(linked_unit_ids)
        return [
            self._build_supplier_ingredient_read(si, unit_names, accessible_unit_ids)
            for si in rows
        ]

    def _load_si_with_relations(self, si_id: int) -> SupplierIngredient | None:
        """Reload a SupplierIngredient with its supplier, ingredient and unit links loaded."""
        from sqlalchemy.orm import selectinload

        stmt = (
            select(SupplierIngredient)
            .where(SupplierIngredient.id == si_id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet_links),
            )
        )
        return self.session.exec(stmt).first()

    def get_ingredient_suppliers(
        self, ingredient_id: int, subject: str
    ) -> list[SupplierIngredientRead] | None:
        """Get all supplier links for an ingredient, scoped to what the user may see.

        Returns None if the ingredient does not exist, an empty list if it has no suppliers
        the user may see. Org admins see every link; everyone else sees only links attached
        to a unit in ``access.accessible_unit_ids`` — no local hierarchy walk, Passport's
        brand->outlet structure decides.
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        from sqlalchemy.orm import selectinload

        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        statement = (
            select(SupplierIngredient)
            .where(SupplierIngredient.ingredient_id == ingredient_id)
            .options(
                selectinload(SupplierIngredient.supplier),
                selectinload(SupplierIngredient.ingredient),
                selectinload(SupplierIngredient.outlet_links),
            )
        )

        # No org-admin bypass. `accessible_unit_ids` ALREADY covers an org admin: the Passport
        # ladder gives them Manager at every brand of their org, including brands created after
        # them (verified). The bypass therefore widened nothing for their own org — it only skipped
        # the filter for OTHER orgs, because `is_org_admin` without an `organization_id` means
        # "admin of ANY of your orgs". `access.org_role` documents that form as the live bug.
        accessible = self._get_accessible_unit_ids(subject)
        if not accessible:
            return []
        # Keep only links attached to at least one unit the user may see
        statement = statement.where(
            col(SupplierIngredient.id).in_(
                select(OutletSupplierIngredient.supplier_ingredient_id).where(
                    col(OutletSupplierIngredient.unit_id).in_(accessible)
                )
            )
        )

        rows = list(self.session.exec(statement).all())
        return self._build_reads(rows, accessible_unit_ids=accessible)

    def add_ingredient_supplier(
        self, ingredient_id: int, data: SupplierIngredientCreate, subject: str
    ) -> SupplierIngredientRead | None | str:
        """Add a supplier link to an ingredient, optionally scoped to a Passport unit.

        ``subject`` is REQUIRED: ``data.unit_id`` is client-supplied, and without a check the
        caller could attach supplier pricing to any brand's unit — including one whose links they
        cannot read, since :meth:`get_ingredient_suppliers` IS scoped. Reads were scoped and writes
        were not; the route took ``current_user`` and never passed it on.

        Returns:
            SupplierIngredientRead on success, None if ingredient/supplier not found or the unit is
            not one the caller may see, or an error string if the SKU is a duplicate or the unit is
            unknown.
        """
        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        supplier = self.session.get(Supplier, data.supplier_id)
        if not supplier:
            return None

        if data.sku:
            sku_exists = self.session.exec(
                select(SupplierIngredient).where(SupplierIngredient.sku == data.sku)
            ).first()
            if sku_exists:
                return SKU_ALREADY_EXISTS

        # Resolve the unit BEFORE writing anything: the link row must carry the unit's org
        # (rule 9 — every scoped row is org-stamped) and an unknown unit is a client error.
        unit: PassportUnit | None = None
        if data.unit_id is not None:
            unit = self.session.get(PassportUnit, data.unit_id)
            if unit is None:
                return UNIT_NOT_FOUND
            # `None` (not UNIT_NOT_FOUND) so the route 404s: a unit the caller cannot see must not
            # be distinguishable from one that does not exist. Org admins hold every brand of their
            # org via the ladder, so they pass this naturally.
            if not self._may_write_at_unit(subject, unit.id):
                return None

        if data.is_preferred:
            self._unset_preferred(ingredient_id)

        si = SupplierIngredient(
            ingredient_id=ingredient_id,
            supplier_id=data.supplier_id,
            sku=data.sku,
            pack_size=data.pack_size,
            pack_unit=data.pack_unit,
            price_per_pack=data.price_per_pack,
            currency=data.currency,
            source=data.source,
            is_preferred=data.is_preferred,
        )
        self.session.add(si)
        self.session.flush()  # get si.id before committing

        if unit is not None:
            self.session.add(
                OutletSupplierIngredient(
                    supplier_ingredient_id=si.id,
                    unit_id=unit.id,
                    organization_id=unit.organization_id,
                )
            )

        self.session.commit()

        refreshed = self._load_si_with_relations(si.id)
        if not refreshed:
            return None
        return self._build_reads([refreshed])[0]

    def update_ingredient_supplier(
        self, supplier_ingredient_id: int, data: SupplierIngredientUpdate, subject: str
    ) -> SupplierIngredientRead | None | str:
        """Update a supplier-ingredient link the caller may actually see.

        ``subject`` is REQUIRED. This took no subject, and the route only checked authority when
        ``data.unit_id`` was present — so a PATCH without it reached here with no check at all, and
        any signed-in user could rewrite any brand's pricing. Returning the updated row also
        disclosed a link the scoped read hides, making the write an oracle too.

        Both the link's CURRENT unit and (when moving) the TARGET unit are checked: reading is
        scoped, so writing must not be looser in either direction.

        Returns None if the link does not exist, or an error string if a supplied unit_id
        names no Passport unit.
        """
        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        si = self.session.get(SupplierIngredient, supplier_ingredient_id)
        if not si:
            return None

        # `None`, so the route 404s: a link at a unit the caller cannot see must not be
        # distinguishable from one that does not exist. Checked BEFORE any field is read, so the
        # response body cannot disclose the row either.
        if not self._may_edit_link(subject, supplier_ingredient_id):
            return None

        update_data = data.model_dump(exclude_unset=True)

        # unit_id is not a column on SupplierIngredient — it lives on the link row.
        new_unit_id = update_data.pop("unit_id", None)
        if new_unit_id is not None:
            unit = self.session.get(PassportUnit, new_unit_id)
            if unit is None:
                return UNIT_NOT_FOUND
            # Re-homing stays ORG-ADMIN-ONLY, scoped to the TARGET unit's org. This is a
            # deliberate product rule, not a scope check: a brand Manager may edit their own
            # brand's pricing but may not re-home a link, because the destination is by definition
            # outside the brand they manage.
            if not access.is_org_admin(self.session, subject, unit.organization_id):
                return NOT_ORG_ADMIN_FOR_MOVE
            existing_link = self.session.exec(
                select(OutletSupplierIngredient).where(
                    OutletSupplierIngredient.supplier_ingredient_id == supplier_ingredient_id
                )
            ).first()
            if existing_link:
                existing_link.unit_id = unit.id
                existing_link.organization_id = unit.organization_id
                self.session.add(existing_link)
            else:
                self.session.add(
                    OutletSupplierIngredient(
                        supplier_ingredient_id=supplier_ingredient_id,
                        unit_id=unit.id,
                        organization_id=unit.organization_id,
                    )
                )

        if update_data.get("is_preferred"):
            self._unset_preferred(si.ingredient_id)

        for key, value in update_data.items():
            setattr(si, key, value)

        si.updated_at = datetime.utcnow()
        self.session.add(si)
        self.session.commit()

        refreshed = self._load_si_with_relations(si.id)
        if not refreshed:
            return None
        return self._build_reads([refreshed])[0]

    def _may_write_at_unit(self, subject: str, unit_id: str) -> bool:
        """Whether ``subject`` may attach, move or detach supplier pricing at ``unit_id``.

        Write scope must not be looser than read scope: being able to change a row you cannot see
        is the bug this closes.

        The admin check is scoped to the UNIT'S OWN ORG. `is_org_admin` without an org answers
        "an admin of ANY of your orgs", so an admin of org B would pass here for org A's brand —
        `access.org_role` documents that form as the live cross-org bug and says not to add callers
        to it. The unit carries its org, so there is no excuse for asking the org-less question.
        """
        unit = self.session.get(PassportUnit, unit_id)
        if unit is None:
            return False
        if access.is_org_admin(self.session, subject, unit.organization_id):
            return True
        return unit_id in self._get_accessible_unit_ids(subject)

    def _may_edit_link(self, subject: str, supplier_ingredient_id: int) -> bool:
        """Whether ``subject`` may change or remove an EXISTING link, by its current unit(s).

        A link attached to no unit is org-wide reference data that no brand role reaches; only an
        org admin gets it, and only via :meth:`_may_write_at_unit` on a real unit — so an unlinked
        row is not editable here at all. That is deliberate: it is exactly the row whose owner
        cannot be established.
        """
        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        unit_ids = list(
            self.session.exec(
                select(OutletSupplierIngredient.unit_id).where(
                    OutletSupplierIngredient.supplier_ingredient_id == supplier_ingredient_id
                )
            ).all()
        )
        return any(self._may_write_at_unit(subject, unit_id) for unit_id in unit_ids)

    def remove_ingredient_supplier(
        self, supplier_ingredient_id: int, subject: str
    ) -> bool:
        """Remove a supplier-ingredient link the caller may actually see.

        ``subject`` is REQUIRED. This took a bare id and deleted it, so any signed-in user could
        destroy another brand's supplier pricing by guessing a small integer — data the scoped read
        path would never have shown them.

        A link attached to no unit is org-wide reference data and stays admin-only; a link at units
        the caller cannot see is not theirs to remove.
        """
        si = self.session.get(SupplierIngredient, supplier_ingredient_id)
        if not si:
            return False

        if not self._may_edit_link(subject, supplier_ingredient_id):
            return False

        self.session.delete(si)
        self.session.commit()
        return True

    def get_preferred_supplier(
        self, ingredient_id: int, subject: str
    ) -> SupplierIngredientRead | None:
        """Get the preferred supplier for an ingredient, scoped to what the user may see.

        Returns the link marked preferred, else the first one, else None. Org admins are
        unscoped; everyone else only sees links attached to a unit they have access to.
        """
        ingredient = self.get_ingredient(ingredient_id)
        if not ingredient:
            return None

        from sqlalchemy.orm import selectinload

        from app.models.outlet_supplier_ingredient import OutletSupplierIngredient

        # No org-admin bypass. `accessible_unit_ids` ALREADY covers an org admin: the Passport
        # ladder gives them Manager at every brand of their org, including brands created after
        # them (verified). The bypass therefore widened nothing for their own org — it only skipped
        # the filter for OTHER orgs, because `is_org_admin` without an `organization_id` means
        # "admin of ANY of your orgs". `access.org_role` documents that form as the live bug.
        accessible = self._get_accessible_unit_ids(subject)
        if not accessible:
            return None

        def _unit_filter(stmt):
            # `accessible` is always a non-empty set here — the early return above handles the
            # empty case. The old `if accessible is None: return stmt` escape existed only for the
            # org-admin bypass that has been removed, and would now be an unreachable way to
            # disable scoping entirely.
            return stmt.where(
                col(SupplierIngredient.id).in_(
                    select(OutletSupplierIngredient.supplier_ingredient_id).where(
                        col(OutletSupplierIngredient.unit_id).in_(accessible)
                    )
                )
            )

        base_options = (
            selectinload(SupplierIngredient.supplier),
            selectinload(SupplierIngredient.ingredient),
            selectinload(SupplierIngredient.outlet_links),
        )

        statement = _unit_filter(
            select(SupplierIngredient)
            .where(
                SupplierIngredient.ingredient_id == ingredient_id,
                SupplierIngredient.is_preferred == True,
            )
            .options(*base_options)
        )
        preferred = self.session.exec(statement).first()
        if preferred:
            return self._build_reads([preferred], accessible_unit_ids=accessible)[0]

        statement = _unit_filter(
            select(SupplierIngredient)
            .where(SupplierIngredient.ingredient_id == ingredient_id)
            .options(*base_options)
            .limit(1)
        )
        first = self.session.exec(statement).first()
        if not first:
            return None
        return self._build_reads([first], accessible_unit_ids=accessible)[0]

    def _unset_preferred(self, ingredient_id: int) -> None:
        """Unset is_preferred on all supplier links for an ingredient."""
        statement = select(SupplierIngredient).where(
            SupplierIngredient.ingredient_id == ingredient_id,
            SupplierIngredient.is_preferred == True,
        )
        for si in self.session.exec(statement).all():
            si.is_preferred = False
            self.session.add(si)
