"""Menu API routes for restaurant menu management.

Menus hang off Passport UNITS (brands and outlets), and every write is authorised AT THE UNITS THE
MENU TOUCHES — `Manager` at each of them (rule 8). There is no global "manager" any more: the old
`is_manager` flag granted at every brand what was granted at one, so a manager at Temper could edit
Willow's menus. That was the bug. An org Owner/Admin holds `Manager` everywhere through Passport's
ladder, so they need no special case here.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import OrgContext, get_current_user, get_org_context, get_session
from app.domain import MenuService
from app.models import (
    MenuCreate,
    MenuDetail,
    MenuItem,
    MenuItemRead,
    MenuOutlet,
    MenuRead,
    MenuSection,
    MenuSectionRead,
    MenuUpdate,
    Recipe,
    User,
)
from app.passport import access

MANAGER = "Manager"


# --- Request/Response DTOs ---


class MenuItemInput(BaseModel):
    """Input schema for menu item (create/update)."""

    id: int | None = None
    recipe_id: int
    order_no: int
    display_price: float | None = None
    additional_info: str | None = None
    key_highlights: str | None = None
    substitution: str | None = None


class MenuSectionInput(BaseModel):
    """Input schema for menu section with items."""

    id: int | None = None
    name: str
    order_no: int
    items: list[MenuItemInput] = []


class CreateMenuRequest(BaseModel):
    """Request body for creating a new menu. `unit_ids` are Passport unit UUIDs."""

    name: str
    is_published: bool = False
    unit_ids: list[str] = []
    sections: list[MenuSectionInput] = []


class UpdateMenuRequest(BaseModel):
    """Request body for updating a menu. `unit_ids` are Passport unit UUIDs."""

    name: str | None = None
    is_published: bool | None = None
    unit_ids: list[str] | None = None
    sections: list[MenuSectionInput] | None = None


# --- Routers ---

router = APIRouter()
menu_outlets_router = APIRouter()
menu_items_router = APIRouter()


# --- Helper Functions ---


def _menu_units(menu_id: int, session: Session) -> list[MenuOutlet]:
    """The Passport unit links of a menu — the units the menu lives at."""
    return list(
        session.exec(select(MenuOutlet).where(MenuOutlet.menu_id == menu_id)).all()
    )


def _require_manager_at_units(
    unit_ids: list[str], current_user: User, session: Session
) -> None:
    """403 unless the caller is `Manager` at EVERY unit the operation touches.

    A menu can be served at several units, and writing it writes all of them — so `Manager` at one
    of them is not enough. With no unit in scope (a menu assigned nowhere) there is no brand to be a
    manager of, so the fallback is org-wide administration.
    """
    if not unit_ids:
        if not access.is_org_admin(session, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only organisation administrators can manage a menu with no unit",
            )
        return

    for unit_id in unit_ids:
        if access.role_at_unit(session, current_user.id, unit_id) != MANAGER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a manager at every brand this menu belongs to",
            )


def _require_manager_for_menu(
    menu_id: int, current_user: User, session: Session
) -> None:
    """403 unless the caller manages every unit the existing menu is served at."""
    _require_manager_at_units(
        [mo.unit_id for mo in _menu_units(menu_id, session)], current_user, session
    )


def _get_menu_detail(
    menu_id: int, session: Session, organization_id: str
) -> MenuDetail | None:
    """Get menu with all sections, items, and recipe names in minimal queries."""
    service = MenuService(session, organization_id)
    menu = service.get_menu(menu_id)
    if not menu:
        return None

    # Single join query: sections + items + recipe names
    statement = (
        select(MenuSection, MenuItem, Recipe.name)
        .outerjoin(MenuItem, MenuItem.section_id == MenuSection.id)
        .outerjoin(Recipe, Recipe.id == MenuItem.recipe_id)
        .where(MenuSection.menu_id == menu_id)
        .order_by(MenuSection.order_no, MenuItem.order_no)
    )
    rows = session.exec(statement).all()

    # Group by section
    sections_map: dict[int, tuple[MenuSection, list[MenuItemRead]]] = {}
    section_order: list[int] = []
    for section, item, recipe_name in rows:
        if section.id not in sections_map:
            sections_map[section.id] = (section, [])
            section_order.append(section.id)
        if item:
            sections_map[section.id][1].append(
                MenuItemRead(
                    id=item.id,
                    recipe_id=item.recipe_id,
                    recipe_name=recipe_name or "",
                    section_id=item.section_id,
                    order_no=item.order_no,
                    display_price=item.display_price,
                    additional_info=item.additional_info,
                    key_highlights=item.key_highlights,
                    substitution=item.substitution,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

    section_reads = []
    for sid in section_order:
        section, item_reads = sections_map[sid]
        section_reads.append(
            MenuSectionRead(
                id=section.id,
                name=section.name,
                menu_id=section.menu_id,
                order_no=section.order_no,
                items=item_reads,
                created_at=section.created_at,
                updated_at=section.updated_at,
            )
        )

    return MenuDetail(
        id=menu.id,
        name=menu.name,
        is_published=menu.is_published,
        is_active=menu.is_active,
        version_no=menu.version_no,
        created_by=menu.created_by,
        created_at=menu.created_at,
        updated_at=menu.updated_at,
        sections=section_reads,
        outlets=_menu_units(menu_id, session),
    )


def _check_menu_accessible(
    menu_id: int, current_user: User, session: Session, organization_id: str
) -> bool:
    """Whether the caller may see this menu: it must live at a unit they can see.

    Org admins fall out of this naturally — they hold a role at every brand, so
    `accessible_unit_ids` already covers every unit.
    """
    service = MenuService(session, organization_id)
    menu = service.get_menu(menu_id)
    if not menu or not menu.is_active:
        return False

    visible = access.accessible_unit_ids(session, current_user.id)
    if not visible:
        return False

    return any(mo.unit_id in visible for mo in _menu_units(menu_id, session))


def _validate_menu_items(items: list[MenuItemInput], session: Session) -> bool:
    """Validate that all recipes exist."""
    from sqlmodel import func

    recipe_ids = list({item.recipe_id for item in items})
    if not recipe_ids:
        return True
    count = session.exec(
        select(func.count()).where(Recipe.id.in_(recipe_ids))
    ).one()
    return count == len(recipe_ids)


# --- GET /menus ---


@router.get("", response_model=list[MenuRead])
def list_menus(
    include_archived: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """List the menus the caller may see — those served at a unit they hold a role at.

    `include_archived` spans every unit at once, so there is no single unit to scope it to: a user
    may ask for archived menus if they manage AT LEAST ONE brand. That is not a hole — the service
    still restricts the result to their accessible units, so a Temper manager sees Temper's archived
    menus and nobody else's.
    """
    can_see_archived = MANAGER in access.brand_roles(session, current_user.id).values()
    effective_include_archived = include_archived and can_see_archived

    service = MenuService(session, org.organization_id)
    menus = service.list_menus(current_user, include_archived=effective_include_archived)
    return [
        MenuRead(
            id=m.id,
            name=m.name,
            is_published=m.is_published,
            is_active=m.is_active,
            version_no=m.version_no,
            created_by=m.created_by,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in menus
    ]


# --- GET /menus/{menu_id} ---


@router.get("/{menu_id}", response_model=MenuDetail)
def get_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Get menu detail with sections and items.

    Returns 404 if menu not found or not accessible.
    """
    if not _check_menu_accessible(menu_id, current_user, session, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    menu_detail = _get_menu_detail(menu_id, session, org.organization_id)
    if not menu_detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return menu_detail


# --- POST /menus ---


@router.post("", response_model=MenuDetail, status_code=status.HTTP_201_CREATED)
def create_menu(
    data: CreateMenuRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Create a new menu, requiring `Manager` at every unit it is being created for.

    The unit scope comes from the request body — the menu does not exist yet. This subsumes the old
    "cannot assign menu to inaccessible outlets" check: being able to see a unit is no longer enough
    to publish a menu there, you must manage it.
    """
    _require_manager_at_units(data.unit_ids, current_user, session)

    # Validate recipes
    for section in data.sections:
        if not _validate_menu_items(section.items, session):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid recipe ID in menu items",
            )

    # Create menu
    service = MenuService(session, org.organization_id)
    menu_create = MenuCreate(
        name=data.name,
        is_published=data.is_published,
        version_no=1,
        created_by=current_user.id,
    )
    menu = service.create_menu(menu_create, data.unit_ids)

    # Add sections and items
    for section_data in data.sections:
        section = MenuSection(
            menu_id=menu.id,
            name=section_data.name,
            order_no=section_data.order_no,
        )
        session.add(section)
        session.commit()
        session.refresh(section)

        for item_data in section_data.items:
            item = MenuItem(
                section_id=section.id,
                recipe_id=item_data.recipe_id,
                order_no=item_data.order_no,
                display_price=item_data.display_price,
                additional_info=item_data.additional_info,
                key_highlights=item_data.key_highlights,
                substitution=item_data.substitution,
            )
            session.add(item)
        session.commit()

    return _get_menu_detail(menu.id, session, org.organization_id)


# --- POST /menus/{menu_id}/fork ---


@router.post("/{menu_id}/fork", response_model=MenuDetail, status_code=status.HTTP_201_CREATED)
def fork_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Fork a menu with version_no + 1.

    The fork copies the source menu's unit links, so it requires `Manager` at every one of them.
    """
    if not _check_menu_accessible(menu_id, current_user, session, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    _require_manager_for_menu(menu_id, current_user, session)

    service = MenuService(session, org.organization_id)
    new_menu = service.fork_menu(menu_id)

    if not new_menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return _get_menu_detail(new_menu.id, session, org.organization_id)


# --- PATCH /menus/{menu_id} ---


@router.patch("/{menu_id}", response_model=MenuDetail)
def update_menu(
    menu_id: int,
    data: UpdateMenuRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Update menu metadata and/or contents.

    Two unit scopes are touched, and `Manager` is required at BOTH: the units the menu is served at
    today (you are editing their menu) and any units it is being reassigned to (you are publishing
    into them). A manager at Temper can no longer edit Willow's menu, nor push a menu onto Willow —
    that was the bug the global `is_manager` flag created.
    """
    if not _check_menu_accessible(menu_id, current_user, session, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    _require_manager_for_menu(menu_id, current_user, session)
    if data.unit_ids:
        _require_manager_at_units(data.unit_ids, current_user, session)

    # Validate recipes if sections provided
    if data.sections:
        for section in data.sections:
            if not _validate_menu_items(section.items, session):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid recipe ID in menu items",
                )

    service = MenuService(session, org.organization_id)
    menu_update = MenuUpdate(
        name=data.name,
        is_published=data.is_published,
    )

    # Convert sections to dict format for service
    sections_data = None
    if data.sections:
        sections_data = []
        for section in data.sections:
            section_dict = {
                "id": section.id,
                "name": section.name,
                "order_no": section.order_no,
                "items": [
                    {
                        "id": item.id,
                        "recipe_id": item.recipe_id,
                        "order_no": item.order_no,
                        "display_price": item.display_price,
                        "additional_info": item.additional_info,
                        "key_highlights": item.key_highlights,
                        "substitution": item.substitution,
                    }
                    for item in section.items
                ],
            }
            sections_data.append(section_dict)

    updated = service.update_menu(
        menu_id,
        menu_update,
        sections_data=sections_data,
        unit_ids=data.unit_ids,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return _get_menu_detail(menu_id, session, org.organization_id)


# --- PATCH /menus/{menu_id}/delete ---


@router.patch("/{menu_id}/delete", response_model=MenuRead)
def delete_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Soft-delete a menu (set is_active to False).

    Requires `Manager` at every unit the menu is served at — archiving it removes it from all of them.
    """
    if not _check_menu_accessible(menu_id, current_user, session, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    _require_manager_for_menu(menu_id, current_user, session)

    service = MenuService(session, org.organization_id)
    deleted = service.soft_delete_menu(menu_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return MenuRead(
        id=deleted.id,
        name=deleted.name,
        is_published=deleted.is_published,
        is_active=deleted.is_active,
        version_no=deleted.version_no,
        created_by=deleted.created_by,
        created_at=deleted.created_at,
        updated_at=deleted.updated_at,
    )


# --- PATCH /menus/{menu_id}/restore ---


@router.patch("/{menu_id}/restore", response_model=MenuRead)
def restore_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Restore a soft-deleted menu (set is_active to True).

    Scoped to the archived menu's own units: restoring puts it back in front of those brands, so it
    takes `Manager` at each. `_check_menu_accessible` cannot be used here — it deliberately rejects
    archived menus.
    """
    service = MenuService(session, org.organization_id)
    if not service.get_menu(menu_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    _require_manager_for_menu(menu_id, current_user, session)

    restored = service.restore_menu(menu_id)
    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return MenuRead(
        id=restored.id,
        name=restored.name,
        is_published=restored.is_published,
        is_active=restored.is_active,
        version_no=restored.version_no,
        created_by=restored.created_by,
        created_at=restored.created_at,
        updated_at=restored.updated_at,
    )


# --- GET /menu-outlets/{unit_id} ---


@menu_outlets_router.get("/{unit_id}", response_model=list[MenuRead])
def get_menus_by_unit(
    unit_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Get all menus served at a Passport unit — 404 if the caller cannot see that unit."""
    if unit_id not in access.accessible_unit_ids(session, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit not found",
        )

    service = MenuService(session, org.organization_id)
    menus = service.get_menus_by_unit(unit_id)

    return [
        MenuRead(
            id=m.id,
            name=m.name,
            is_published=m.is_published,
            is_active=m.is_active,
            version_no=m.version_no,
            created_by=m.created_by,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in menus
    ]


# --- GET /menu-items/{section_id} ---


@menu_items_router.get("/{section_id}", response_model=list[MenuItemRead])
def get_items_by_section(
    section_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
):
    """Get menu items for a section, ordered by order_no then name.

    404 unless the caller can see the section's menu — a section id must not be a way around the
    brand scoping every other menu read enforces.
    """
    section = session.get(MenuSection, section_id)
    if not section or not _check_menu_accessible(section.menu_id, current_user, session, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found",
        )

    statement = (
        select(MenuItem, Recipe.name)
        .outerjoin(Recipe, Recipe.id == MenuItem.recipe_id)
        .where(MenuItem.section_id == section_id)
        .order_by(MenuItem.order_no)
    )
    rows = session.exec(statement).all()

    return [
        MenuItemRead(
            id=item.id,
            recipe_id=item.recipe_id,
            recipe_name=recipe_name or "",
            section_id=item.section_id,
            order_no=item.order_no,
            display_price=item.display_price,
            additional_info=item.additional_info,
            key_highlights=item.key_highlights,
            substitution=item.substitution,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item, recipe_name in rows
    ]
