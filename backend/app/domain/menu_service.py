"""Menu management for restaurant menus."""

from datetime import datetime

from sqlmodel import Session, select

from app.models import (
    Menu,
    MenuCreate,
    MenuUpdate,
    MenuSection,
    MenuSectionCreate,
    MenuSectionUpdate,
    MenuItem,
    MenuItemCreate,
    MenuItemUpdate,
    MenuOutlet,
    MenuOutletCreate,
    User,
    UserType,
    Recipe,
    Outlet,
)


class MenuService:
    """Service for menu management."""

    def __init__(self, session: Session):
        self.session = session

    # --- Menu CRUD ---

    def create_menu(self, data: MenuCreate, outlet_ids: list[int]) -> Menu:
        """Create a new menu and link it to outlets."""
        menu = Menu.model_validate(data)
        self.session.add(menu)
        self.session.commit()
        self.session.refresh(menu)

        # Link menu to outlets
        for outlet_id in outlet_ids:
            menu_outlet = MenuOutlet(menu_id=menu.id, outlet_id=outlet_id)
            self.session.add(menu_outlet)
        self.session.commit()

        return menu

    def get_menu(self, menu_id: int) -> Menu | None:
        """Get a menu by ID (without sections/items)."""
        return self.session.get(Menu, menu_id)

    def list_menus(self, current_user: User | None = None) -> list[Menu]:
        """List all menus filtered by user access control.

        Access control:
        - Admin users see all menus
        - Normal users see menus assigned to their accessible outlets
        """
        statement = select(Menu).where(Menu.is_active == True)
        menus = list(self.session.exec(statement).all())

        # Admin users see all menus
        if current_user and current_user.user_type == UserType.ADMIN:
            return menus

        # Non-admin users: filter by outlet access
        if not current_user or not current_user.outlet_id:
            return []

        accessible_outlet_ids = self._get_accessible_outlet_ids(current_user)

        # Get MenuOutlet records for accessible outlets
        statement = select(MenuOutlet).where(
            MenuOutlet.outlet_id.in_(list(accessible_outlet_ids))
        )
        menu_outlets = list(self.session.exec(statement).all())
        accessible_menu_ids = {mo.menu_id for mo in menu_outlets}

        # Filter menus
        return [m for m in menus if m.id in accessible_menu_ids]

    def update_menu(
        self,
        menu_id: int,
        data: MenuUpdate,
        sections_data: list[dict] | None = None,
        outlet_ids: list[int] | None = None,
    ) -> Menu | None:
        """Update menu metadata and optionally replace sections/items/outlets.

        This implements merge/upsert logic for sections and items:
        - Sections/items with existing IDs are updated
        - Sections/items without IDs are inserted
        - Sections/items missing from the payload are deleted
        """
        menu = self.get_menu(menu_id)
        if not menu:
            return None

        # Update menu metadata
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(menu, key, value)
        menu.updated_at = datetime.utcnow()
        self.session.add(menu)
        self.session.commit()

        # Update sections and items if provided
        if sections_data is not None:
            self._update_sections_and_items(menu_id, sections_data)

        # Update outlet links if provided
        if outlet_ids is not None:
            self._update_menu_outlets(menu_id, outlet_ids)

        self.session.refresh(menu)
        return menu

    def fork_menu(self, menu_id: int) -> Menu | None:
        """Fork a menu with version_no + 1.

        Creates a new menu with all sections and items, copying outlets.
        """
        original = self.get_menu(menu_id)
        if not original:
            return None

        # Create new menu
        new_menu_data = MenuCreate(
            name=original.name,
            is_published=original.is_published,
            version_no=original.version_no + 1,
            created_by=original.created_by,
        )
        new_menu = Menu.model_validate(new_menu_data)
        self.session.add(new_menu)
        self.session.commit()
        self.session.refresh(new_menu)

        # Get original sections
        original_sections = self._get_sections_for_menu(menu_id)

        # Copy sections and items
        section_map = {}  # Old section ID -> new section ID
        for old_section in original_sections:
            new_section = MenuSection(
                menu_id=new_menu.id,
                name=old_section.name,
                order_no=old_section.order_no,
            )
            self.session.add(new_section)
            self.session.commit()
            self.session.refresh(new_section)
            section_map[old_section.id] = new_section.id

            # Copy items from this section
            old_items = self._get_items_for_section(old_section.id)
            for old_item in old_items:
                new_item = MenuItem(
                    section_id=new_section.id,
                    recipe_id=old_item.recipe_id,
                    order_no=old_item.order_no,
                    display_price=old_item.display_price,
                    additional_info=old_item.additional_info,
                    key_highlights=old_item.key_highlights,
                )
                self.session.add(new_item)
            self.session.commit()

        # Copy outlet links
        original_outlets = self._get_outlets_for_menu(menu_id)
        for mo in original_outlets:
            new_menu_outlet = MenuOutlet(menu_id=new_menu.id, outlet_id=mo.outlet_id)
            self.session.add(new_menu_outlet)
        self.session.commit()

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

    # --- Section & Item Management ---

    def _get_sections_for_menu(self, menu_id: int) -> list[MenuSection]:
        """Get all sections for a menu, ordered by order_no then name."""
        statement = (
            select(MenuSection)
            .where(MenuSection.menu_id == menu_id)
            .order_by(MenuSection.order_no, MenuSection.name)
        )
        return list(self.session.exec(statement).all())

    def _get_items_for_section(self, section_id: int) -> list[MenuItem]:
        """Get all items for a section, ordered by order_no then name."""
        statement = (
            select(MenuItem)
            .where(MenuItem.section_id == section_id)
            .order_by(MenuItem.order_no)
        )
        return list(self.session.exec(statement).all())

    def _update_sections_and_items(
        self, menu_id: int, sections_data: list[dict]
    ) -> None:
        """Merge/upsert sections and items.

        Sections/items with ID are updated, new ones are inserted,
        missing ones are deleted.
        """
        # Get current sections
        current_sections = self._get_sections_for_menu(menu_id)
        current_section_ids = {s.id for s in current_sections}
        new_section_ids = set()

        # Process each section in the payload
        for section_data in sections_data:
            section_id = section_data.get("id")

            if section_id and section_id in current_section_ids:
                # Update existing section
                section = self.session.get(MenuSection, section_id)
                if section:
                    section.name = section_data.get("name", section.name)
                    section.order_no = section_data.get("order_no", section.order_no)
                    section.updated_at = datetime.utcnow()
                    self.session.add(section)
                new_section_ids.add(section_id)
            else:
                # Create new section
                new_section = MenuSection(
                    menu_id=menu_id,
                    name=section_data["name"],
                    order_no=section_data["order_no"],
                )
                self.session.add(new_section)
                self.session.commit()
                self.session.refresh(new_section)
                new_section_ids.add(new_section.id)
                section_id = new_section.id

            # Handle items for this section
            items_data = section_data.get("items", [])
            self._update_items_for_section(section_id, items_data)

        # Delete sections not in payload
        sections_to_delete = current_section_ids - new_section_ids
        for section_id in sections_to_delete:
            section = self.session.get(MenuSection, section_id)
            if section:
                # Cascade delete items
                statement = select(MenuItem).where(MenuItem.section_id == section_id)
                items = list(self.session.exec(statement).all())
                for item in items:
                    self.session.delete(item)
                self.session.delete(section)

        self.session.commit()

    def _update_items_for_section(
        self, section_id: int, items_data: list[dict]
    ) -> None:
        """Merge/upsert items for a section."""
        current_items = self._get_items_for_section(section_id)
        current_item_ids = {i.id for i in current_items}
        new_item_ids = set()

        for item_data in items_data:
            item_id = item_data.get("id")

            if item_id and item_id in current_item_ids:
                # Update existing item
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
                    item.updated_at = datetime.utcnow()
                    self.session.add(item)
                new_item_ids.add(item_id)
            else:
                # Create new item
                new_item = MenuItem(
                    section_id=section_id,
                    recipe_id=item_data["recipe_id"],
                    order_no=item_data["order_no"],
                    display_price=item_data.get("display_price"),
                    additional_info=item_data.get("additional_info"),
                    key_highlights=item_data.get("key_highlights"),
                )
                self.session.add(new_item)
                self.session.commit()
                self.session.refresh(new_item)
                new_item_ids.add(new_item.id)

        # Delete items not in payload
        items_to_delete = current_item_ids - new_item_ids
        for item_id in items_to_delete:
            item = self.session.get(MenuItem, item_id)
            if item:
                self.session.delete(item)

        self.session.commit()

    # --- Outlet Management ---

    def _get_outlets_for_menu(self, menu_id: int) -> list[MenuOutlet]:
        """Get all outlet links for a menu."""
        statement = select(MenuOutlet).where(MenuOutlet.menu_id == menu_id)
        return list(self.session.exec(statement).all())

    def _update_menu_outlets(self, menu_id: int, outlet_ids: list[int]) -> None:
        """Replace outlet links for a menu."""
        # Delete existing links
        statement = select(MenuOutlet).where(MenuOutlet.menu_id == menu_id)
        existing = list(self.session.exec(statement).all())
        for mo in existing:
            self.session.delete(mo)

        # Create new links
        for outlet_id in outlet_ids:
            menu_outlet = MenuOutlet(menu_id=menu_id, outlet_id=outlet_id)
            self.session.add(menu_outlet)

        self.session.commit()

    def get_menus_by_outlet(self, outlet_id: int) -> list[Menu]:
        """Get all menus accessible to an outlet.

        If outlet is a location, it inherits menus from parent (brand).
        """
        # Get menus directly linked to this outlet
        statement = select(MenuOutlet).where(MenuOutlet.outlet_id == outlet_id)
        direct_links = list(self.session.exec(statement).all())
        menu_ids = {mo.menu_id for mo in direct_links}

        # If outlet is a location, also get parent outlet's menus
        outlet = self.session.get(Outlet, outlet_id)
        if outlet and outlet.parent_outlet_id:
            statement = select(MenuOutlet).where(
                MenuOutlet.outlet_id == outlet.parent_outlet_id
            )
            parent_links = list(self.session.exec(statement).all())
            menu_ids.update(mo.menu_id for mo in parent_links)

        # Fetch menus
        if menu_ids:
            statement = select(Menu).where(Menu.id.in_(list(menu_ids)))
            return list(self.session.exec(statement).all())

        return []

    def get_items_by_section(self, section_id: int) -> list[MenuItem]:
        """Get items for a section, ordered by order_no then name."""
        return self._get_items_for_section(section_id)

    # --- Helper Methods ---

    def _get_accessible_outlet_ids(self, user: User) -> set[int]:
        """Get the set of outlet IDs accessible to a user.

        - If user is in a parent outlet (brand): that outlet + all child outlets
        - If user is in a child outlet (location): that outlet + parent
        """
        if not user.outlet_id:
            return set()

        from app.domain.outlet_service import OutletService

        outlet_service = OutletService(self.session)
        user_outlet = outlet_service.get_outlet(user.outlet_id)
        if not user_outlet:
            return set()

        accessible = {user.outlet_id}

        # If user is in a location, add parent
        if user_outlet.outlet_type.value == "location" and user_outlet.parent_outlet_id:
            accessible.add(user_outlet.parent_outlet_id)

        # Add all child outlets (works for both brand and location parents)
        def add_children(outlet_id: int):
            children = outlet_service.get_child_outlets(outlet_id)
            for child in children:
                accessible.add(child.id)
                add_children(child.id)

        add_children(user.outlet_id)

        return accessible
