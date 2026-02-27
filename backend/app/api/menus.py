"""Menu API routes for restaurant menu management."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import get_session, get_current_user
from app.models import (
    Menu,
    MenuCreate,
    MenuUpdate,
    MenuRead,
    MenuDetail,
    MenuSection,
    MenuSectionRead,
    MenuItem,
    MenuItemRead,
    MenuOutlet,
    User,
    UserType,
    Recipe,
)
from app.domain import MenuService


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
    """Request body for creating a new menu."""

    name: str
    is_published: bool = False
    outlet_ids: list[int] = []
    sections: list[MenuSectionInput] = []


class UpdateMenuRequest(BaseModel):
    """Request body for updating a menu."""

    name: str | None = None
    is_published: bool | None = None
    outlet_ids: list[int] | None = None
    sections: list[MenuSectionInput] | None = None


# --- Routers ---

router = APIRouter()
menu_outlets_router = APIRouter()
menu_items_router = APIRouter()


# --- Helper Functions ---


def _get_menu_detail(menu_id: int, session: Session) -> MenuDetail | None:
    """Get menu with all sections and items populated."""
    service = MenuService(session)
    menu = service.get_menu(menu_id)
    if not menu:
        return None

    sections = service._get_sections_for_menu(menu_id)
    section_reads = []

    for section in sections:
        items = service._get_items_for_section(section.id)
        item_reads = []

        for item in items:
            recipe = session.get(Recipe, item.recipe_id)
            item_read = MenuItemRead(
                id=item.id,
                recipe_id=item.recipe_id,
                recipe_name=recipe.name if recipe else "",
                section_id=item.section_id,
                order_no=item.order_no,
                display_price=item.display_price,
                additional_info=item.additional_info,
                key_highlights=item.key_highlights,
                substitution=item.substitution,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            item_reads.append(item_read)

        section_read = MenuSectionRead(
            id=section.id,
            name=section.name,
            menu_id=section.menu_id,
            order_no=section.order_no,
            items=item_reads,
            created_at=section.created_at,
            updated_at=section.updated_at,
        )
        section_reads.append(section_read)

    # Get menu outlets
    outlets = service._get_outlets_for_menu(menu_id)

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
        outlets=outlets,
    )


def _check_menu_accessible(
    menu_id: int, current_user: User, session: Session
) -> bool:
    """Check if menu is accessible to the current user."""
    if current_user.user_type == UserType.ADMIN:
        return True

    service = MenuService(session)
    menu = service.get_menu(menu_id)
    if not menu or not menu.is_active:
        return False

    # Check if menu is assigned to accessible outlets
    accessible_outlet_ids = service._get_accessible_outlet_ids(current_user)
    if not accessible_outlet_ids:
        return False

    menu_outlets = service._get_outlets_for_menu(menu_id)
    for mo in menu_outlets:
        if mo.outlet_id in accessible_outlet_ids:
            return True

    return False


def _validate_menu_items(items: list[MenuItemInput], session: Session) -> bool:
    """Validate that all recipes exist."""
    for item in items:
        recipe = session.get(Recipe, item.recipe_id)
        if not recipe:
            return False
    return True


# --- GET /menus ---


@router.get("", response_model=list[MenuRead])
def list_menus(
    include_archived: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all accessible menus.

    - Admin users see all menus
    - Normal users see menus assigned to their accessible outlets
    - include_archived: only admins/managers can include archived menus
    """
    # Only admins/managers can see archived menus
    can_see_archived = (
        current_user.user_type == UserType.ADMIN or current_user.is_manager
    )
    effective_include_archived = include_archived and can_see_archived

    service = MenuService(session)
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
):
    """Get menu detail with sections and items.

    Returns 404 if menu not found or not accessible.
    """
    if not _check_menu_accessible(menu_id, current_user, session):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    menu_detail = _get_menu_detail(menu_id, session)
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
):
    """Create a new menu.

    Only admin and manager users can create menus.
    """
    # Check authorization
    if current_user.user_type != UserType.ADMIN and not current_user.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can create menus",
        )

    # Check outlet access for managers (admins can create for any outlet)
    if current_user.user_type != UserType.ADMIN:
        service = MenuService(session)
        accessible_outlet_ids = service._get_accessible_outlet_ids(current_user)
        for outlet_id in data.outlet_ids:
            if outlet_id not in accessible_outlet_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign menu to inaccessible outlets",
                )

    # Validate recipes
    for section in data.sections:
        if not _validate_menu_items(section.items, session):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid recipe ID in menu items",
            )

    # Create menu
    service = MenuService(session)
    menu_create = MenuCreate(
        name=data.name,
        is_published=data.is_published,
        version_no=1,
        created_by=current_user.id,
    )
    menu = service.create_menu(menu_create, data.outlet_ids)

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

    return _get_menu_detail(menu.id, session)


# --- POST /menus/{menu_id}/fork ---


@router.post("/{menu_id}/fork", response_model=MenuDetail, status_code=status.HTTP_201_CREATED)
def fork_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Fork a menu with version_no + 1.

    Only admin and manager users can fork menus.
    """
    # Check authorization
    if current_user.user_type != UserType.ADMIN and not current_user.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can fork menus",
        )

    # Check access
    if not _check_menu_accessible(menu_id, current_user, session):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    service = MenuService(session)
    new_menu = service.fork_menu(menu_id)

    if not new_menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return _get_menu_detail(new_menu.id, session)


# --- PATCH /menus/{menu_id} ---


@router.patch("/{menu_id}", response_model=MenuDetail)
def update_menu(
    menu_id: int,
    data: UpdateMenuRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update menu metadata and/or contents.

    Only admin and manager users can update menus.
    """
    # Check authorization
    if current_user.user_type != UserType.ADMIN and not current_user.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can update menus",
        )

    # Check access
    if not _check_menu_accessible(menu_id, current_user, session):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    # Validate recipes if sections provided
    if data.sections:
        for section in data.sections:
            if not _validate_menu_items(section.items, session):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid recipe ID in menu items",
                )

    # Validate outlets if provided (managers can only assign accessible outlets)
    if data.outlet_ids and current_user.user_type != UserType.ADMIN:
        service = MenuService(session)
        accessible_outlet_ids = service._get_accessible_outlet_ids(current_user)
        for outlet_id in data.outlet_ids:
            if outlet_id not in accessible_outlet_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign menu to inaccessible outlets",
                )

    service = MenuService(session)
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
        outlet_ids=data.outlet_ids,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    return _get_menu_detail(menu_id, session)


# --- PATCH /menus/{menu_id}/delete ---


@router.patch("/{menu_id}/delete", response_model=MenuRead)
def delete_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a menu (set is_active to False).

    Only admin and manager users can delete menus.
    """
    # Check authorization
    if current_user.user_type != UserType.ADMIN and not current_user.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can delete menus",
        )

    # Check access
    if not _check_menu_accessible(menu_id, current_user, session):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu not found",
        )

    service = MenuService(session)
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
):
    """Restore a soft-deleted menu (set is_active to True).

    Only admin and manager users can restore menus.
    """
    # Check authorization
    if current_user.user_type != UserType.ADMIN and not current_user.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can restore menus",
        )

    service = MenuService(session)
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


# --- GET /menu-outlets/{outlet_id} ---


@menu_outlets_router.get("/{outlet_id}", response_model=list[MenuRead])
def get_menus_by_outlet(
    outlet_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all menus accessible to an outlet."""
    service = MenuService(session)
    menus = service.get_menus_by_outlet(outlet_id)

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
):
    """Get menu items for a section, ordered by order_no then name."""
    service = MenuService(session)
    items = service.get_items_by_section(section_id)

    item_reads = []
    for item in items:
        recipe = session.get(Recipe, item.recipe_id)
        item_read = MenuItemRead(
            id=item.id,
            recipe_id=item.recipe_id,
            recipe_name=recipe.name if recipe else "",
            section_id=item.section_id,
            order_no=item.order_no,
            display_price=item.display_price,
            additional_info=item.additional_info,
            key_highlights=item.key_highlights,
            substitution=item.substitution,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        item_reads.append(item_read)

    return item_reads
