"""Menu management for restaurant menus.

Menus hang off Passport UNITS (a brand or an outlet), not a local outlet row — Prepper's
`outlets` table is gone and structure now comes from Passport's projection. Two consequences
run through this file:

* every `menu_outlets` row carries the unit's `organization_id`, read from the projected unit,
  so a menu is always org-scoped without consulting a configured constant;
* who may see a menu is answered by `app.passport.access`, never by a column on the user row.
"""

from datetime import datetime

from sqlalchemy import or_
from sqlmodel import Session, col, select

from app.models import (
    Menu,
    MenuCreate,
    MenuItem,
    MenuOutlet,
    MenuSection,
    MenuUpdate,
    PassportUnit,
    PassportUnitRelation,
    User,
)
from app.passport import access

_BELONGS_TO_BRAND = "belongs_to_brand"


class MenuService:
    """Service for menu management."""

    def __init__(self, session: Session):
        self.session = session

    # --- Menu CRUD ---

    def _organization_id_for(self, unit_id: str) -> str:
        """The Passport org that owns ``unit_id``.

        Every `menu_outlets` row is org-stamped from the unit itself (rule 9) rather than from
        config, because Prepper holds units for every org it is entitled to. An unknown unit is
        a programming error — units are only ever supplied from the projection.
        """
        unit = self.session.get(PassportUnit, unit_id)
        if unit is None:
            raise ValueError(f"Unknown Passport unit: {unit_id}")
        return unit.organization_id

    def _link_menu_to_units(self, menu_id: int, unit_ids: list[str]) -> None:
        """Create `menu_outlets` rows for a menu, org-stamped from each unit."""
        for unit_id in unit_ids:
            self.session.add(
                MenuOutlet(
                    menu_id=menu_id,
                    unit_id=unit_id,
                    organization_id=self._organization_id_for(unit_id),
                )
            )

    def create_menu(self, data: MenuCreate, unit_ids: list[str], organization_id: str) -> Menu:
        """Create a new menu, stamped with the acting org, and link it to Passport units.

        ``organization_id`` comes from the acting org context, never from the request body — the
        Create schemas deliberately have no such field. A tenant id a client can assert is not a
        tenant id, for the same reason `owner_id` and `users.email` are not.
        """
        menu = Menu.model_validate(data)
        menu.organization_id = organization_id
        self.session.add(menu)
        self.session.commit()
        self.session.refresh(menu)

        self._link_menu_to_units(menu.id, unit_ids)
        self.session.commit()

        return menu

    def get_menu(self, menu_id: int) -> Menu | None:
        """Get a menu by ID (without sections/items)."""
        return self.session.get(Menu, menu_id)

    def list_menus(
        self, current_user: User | None = None, include_archived: bool = False
    ) -> list[Menu]:
        """List the menus this user may see.

        Visibility is the set of units Passport says the user can reach — the brands they hold
        a role at, plus the outlets under them — matched against `menu_outlets.unit_id`.

        **Fail closed.** No user, or no role at any brand, means no menus. The old model treated
        a null `outlet_id` as "see everything"; that is deliberately not carried over. An org
        Owner/Admin still sees everything, because Passport's ladder gives them Manager at every
        brand, so their accessible-unit set is never empty.
        """
        if not current_user:
            return []

        statement = select(Menu)
        if not include_archived:
            statement = statement.where(col(Menu.is_active).is_(True))

        # Explicit admin bypass: an org Owner/Admin administers the ORGANISATION and sees every
        # menu in it, including one not yet placed on any unit — which the ladder cannot supply,
        # since `accessible_unit_ids` only reaches menus LINKED to a unit.
        #
        # Scoped to the orgs actually administered. It used to ask `is_org_admin(user)` with no
        # org — "admin of ANY of your orgs" — so an Owner of org B listed every menu in org A.
        # NULL orgs are included while the backfill is outstanding; see recipe_service for the
        # same reasoning.
        admin_orgs = access.admin_org_ids(self.session, current_user.id)
        if admin_orgs:
            return list(
                self.session.exec(
                    statement.where(
                        or_(
                            col(Menu.organization_id).in_(admin_orgs),
                            col(Menu.organization_id).is_(None),
                        )
                    )
                ).all()
            )

        unit_ids = access.accessible_unit_ids(self.session, current_user.id)
        if not unit_ids:
            return []

        visible_menu_ids = select(MenuOutlet.menu_id).where(
            col(MenuOutlet.unit_id).in_(unit_ids)
        )
        statement = statement.where(col(Menu.id).in_(visible_menu_ids))
        return list(self.session.exec(statement).all())

    def update_menu(
        self,
        menu_id: int,
        data: MenuUpdate,
        sections_data: list[dict] | None = None,
        unit_ids: list[str] | None = None,
    ) -> Menu | None:
        """Update menu metadata and optionally replace sections/items/units.

        This implements merge/upsert logic for sections and items:
        - Sections/items with existing IDs are updated
        - Sections/items without IDs are inserted
        - Sections/items missing from the payload are deleted
        """
        menu = self.get_menu(menu_id)
        if not menu:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(menu, key, value)
        menu.updated_at = datetime.utcnow()
        self.session.add(menu)
        self.session.commit()

        if sections_data is not None:
            self._update_sections_and_items(menu_id, sections_data)

        if unit_ids is not None:
            self._update_menu_units(menu_id, unit_ids)

        self.session.refresh(menu)
        return menu

    def fork_menu(self, menu_id: int) -> Menu | None:
        """Fork a menu with version_no + 1.

        Creates a new menu with all sections and items, copying unit links.
        """
        original = self.get_menu(menu_id)
        if not original:
            return None

        new_menu_data = MenuCreate(
            name=original.name,
            is_published=original.is_published,
            version_no=original.version_no + 1,
            created_by=original.created_by,
        )
        new_menu = Menu.model_validate(new_menu_data)
        self.session.add(new_menu)
        self.session.flush()

        for old_section in self._get_sections_for_menu(menu_id):
            new_section = MenuSection(
                menu_id=new_menu.id,
                name=old_section.name,
                order_no=old_section.order_no,
            )
            self.session.add(new_section)
            self.session.flush()

            for old_item in self._get_items_for_section(old_section.id):
                self.session.add(
                    MenuItem(
                        section_id=new_section.id,
                        recipe_id=old_item.recipe_id,
                        order_no=old_item.order_no,
                        display_price=old_item.display_price,
                        additional_info=old_item.additional_info,
                        key_highlights=old_item.key_highlights,
                        substitution=old_item.substitution,
                    )
                )

        # Copy unit links, carrying each row's org stamp across with it
        for mo in self.get_menu_units(menu_id):
            self.session.add(
                MenuOutlet(
                    menu_id=new_menu.id,
                    unit_id=mo.unit_id,
                    organization_id=mo.organization_id,
                )
            )

        self.session.commit()
        self.session.refresh(new_menu)
        return new_menu

    def soft_delete_menu(self, menu_id: int) -> Menu | None:
        """Soft-delete a menu by setting is_active to False."""
        menu = self.get_menu(menu_id)
        if not menu:
            return None

        menu.is_active = False
        menu.updated_at = datetime.utcnow()
        self.session.add(menu)
        self.session.commit()
        self.session.refresh(menu)
        return menu

    def restore_menu(self, menu_id: int) -> Menu | None:
        """Restore a soft-deleted menu by setting is_active to True."""
        menu = self.session.get(Menu, menu_id)
        if not menu:
            return None

        menu.is_active = True
        menu.updated_at = datetime.utcnow()
        self.session.add(menu)
        self.session.commit()
        self.session.refresh(menu)
        return menu

    # --- Section & Item Management ---

    def _get_sections_for_menu(self, menu_id: int) -> list[MenuSection]:
        """Get all sections for a menu, ordered by order_no then name."""
        statement = (
            select(MenuSection)
            .where(MenuSection.menu_id == menu_id)
            .order_by(col(MenuSection.order_no), col(MenuSection.name))
        )
        return list(self.session.exec(statement).all())

    def _get_items_for_section(self, section_id: int) -> list[MenuItem]:
        """Get all items for a section, ordered by order_no."""
        statement = (
            select(MenuItem)
            .where(MenuItem.section_id == section_id)
            .order_by(col(MenuItem.order_no))
        )
        return list(self.session.exec(statement).all())

    def _update_sections_and_items(self, menu_id: int, sections_data: list[dict]) -> None:
        """Merge/upsert sections and items.

        Sections/items with ID are updated, new ones are inserted, missing ones are deleted.
        """
        current_sections = self._get_sections_for_menu(menu_id)
        current_section_ids = {s.id for s in current_sections}
        new_section_ids = set()

        for section_data in sections_data:
            section_id = section_data.get("id")

            if section_id and section_id in current_section_ids:
                section = self.session.get(MenuSection, section_id)
                if section:
                    section.name = section_data.get("name", section.name)
                    section.order_no = section_data.get("order_no", section.order_no)
                    section.updated_at = datetime.utcnow()
                    self.session.add(section)
                new_section_ids.add(section_id)
            else:
                new_section = MenuSection(
                    menu_id=menu_id,
                    name=section_data["name"],
                    order_no=section_data["order_no"],
                )
                self.session.add(new_section)
                self.session.flush()
                new_section_ids.add(new_section.id)
                section_id = new_section.id

            self._update_items_for_section(section_id, section_data.get("items", []))

        for section_id in current_section_ids - new_section_ids:
            section = self.session.get(MenuSection, section_id)
            if not section:
                continue
            # Cascade delete items
            items = self.session.exec(
                select(MenuItem).where(MenuItem.section_id == section_id)
            ).all()
            for item in items:
                self.session.delete(item)
            self.session.delete(section)

        self.session.commit()

    def _update_items_for_section(self, section_id: int, items_data: list[dict]) -> None:
        """Merge/upsert items for a section."""
        current_items = self._get_items_for_section(section_id)
        current_item_ids = {i.id for i in current_items}
        new_item_ids = set()

        for item_data in items_data:
            item_id = item_data.get("id")

            if item_id and item_id in current_item_ids:
                item = self.session.get(MenuItem, item_id)
                if item:
                    item.recipe_id = item_data.get("recipe_id", item.recipe_id)
                    item.order_no = item_data.get("order_no", item.order_no)
                    item.display_price = item_data.get("display_price", item.display_price)
                    item.additional_info = item_data.get(
                        "additional_info", item.additional_info
                    )
                    item.key_highlights = item_data.get(
                        "key_highlights", item.key_highlights
                    )
                    item.substitution = item_data.get("substitution", item.substitution)
                    item.updated_at = datetime.utcnow()
                    self.session.add(item)
                new_item_ids.add(item_id)
            else:
                new_item = MenuItem(
                    section_id=section_id,
                    recipe_id=item_data["recipe_id"],
                    order_no=item_data["order_no"],
                    display_price=item_data.get("display_price"),
                    additional_info=item_data.get("additional_info"),
                    key_highlights=item_data.get("key_highlights"),
                    substitution=item_data.get("substitution"),
                )
                self.session.add(new_item)
                self.session.flush()
                new_item_ids.add(new_item.id)

        for item_id in current_item_ids - new_item_ids:
            item = self.session.get(MenuItem, item_id)
            if item:
                self.session.delete(item)

    # --- Unit Management ---

    def get_menu_units(self, menu_id: int) -> list[MenuOutlet]:
        """Get all Passport-unit links for a menu."""
        statement = select(MenuOutlet).where(MenuOutlet.menu_id == menu_id)
        return list(self.session.exec(statement).all())

    def _update_menu_units(self, menu_id: int, unit_ids: list[str]) -> None:
        """Replace the unit links for a menu."""
        existing = self.session.exec(
            select(MenuOutlet).where(MenuOutlet.menu_id == menu_id)
        ).all()
        for mo in existing:
            self.session.delete(mo)

        self._link_menu_to_units(menu_id, unit_ids)
        self.session.commit()

    def get_menus_by_unit(self, unit_id: str) -> list[Menu]:
        """Get all menus that apply at a Passport unit.

        An outlet inherits the menus placed on its brand — that is Passport's structure
        (`belongs_to_brand`), read from the projection rather than from a local parent pointer.
        A brand has no parent, so it resolves to its own menus only.
        """
        unit_ids = {unit_id}

        brand_id = self.session.exec(
            select(PassportUnitRelation.to_unit_id).where(
                PassportUnitRelation.from_unit_id == unit_id,
                PassportUnitRelation.relation == _BELONGS_TO_BRAND,
            )
        ).first()
        if brand_id:
            unit_ids.add(brand_id)

        menu_ids = select(MenuOutlet.menu_id).where(col(MenuOutlet.unit_id).in_(unit_ids))
        statement = select(Menu).where(col(Menu.id).in_(menu_ids))
        return list(self.session.exec(statement).all())

    def get_items_by_section(self, section_id: int) -> list[MenuItem]:
        """Get items for a section, ordered by order_no."""
        return self._get_items_for_section(section_id)
