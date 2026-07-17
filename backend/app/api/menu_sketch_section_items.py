"""Menu sketch section item API router.

Items hang off a section, which hangs off a sketch, which carries the org. These routes resolved a
bare `item_id` or a body-supplied `menu_sketch_section_id` and never asked whose it was — see the
menu-sketch family comment in `api/guards.py`.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import OrgContext, get_current_user, get_org_context, get_session
from app.api.guards import (
    require_section_access,
    require_sketch_item_access,
    section_reachable,
)
from app.domain.menu_sketch_section_item_service import MenuSketchSectionItemService
from app.models import User
from app.models.menu_sketch_section import MenuSketchSection
from app.models.menu_sketch_section_item import (
    MenuSketchSectionItem,
    MenuSketchSectionItemCreate,
    MenuSketchSectionItemRead,
    MenuSketchSectionItemUpdate,
)

router = APIRouter()


@router.get("", response_model=list[MenuSketchSectionItemRead])
def list_menu_sketch_section_items(
    section: MenuSketchSection = Depends(require_section_access),
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> list[MenuSketchSectionItemRead]:
    """List all items for a section."""
    return MenuSketchSectionItemService(session, org.organization_id).list_items(section.id)


@router.post("", response_model=MenuSketchSectionItemRead, status_code=201)
def create_menu_sketch_section_item(
    data: MenuSketchSectionItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSectionItemRead:
    """Create a dish item. 404 if the section does not exist or is not in the acting org.

    Pass ``recipe_id`` to link an existing recipe, or ``name`` to auto-create a new draft recipe
    and link it.

    The section id arrives in the BODY, so no dependency can resolve it — the route has to ask.
    """
    if not section_reachable(session, data.menu_sketch_section_id, org.organization_id):
        raise HTTPException(status_code=404, detail="Section not found")
    item = MenuSketchSectionItemService(session, org.organization_id).create_item(data, owner_id=current_user.id)
    if item is None:
        raise HTTPException(status_code=404, detail="Section not found")
    return item


@router.patch("/{item_id}", response_model=MenuSketchSectionItemRead)
def update_menu_sketch_section_item(
    data: MenuSketchSectionItemUpdate,
    item: MenuSketchSectionItem = Depends(require_sketch_item_access),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSectionItemRead:
    """Update a dish item.

    If ``name`` is provided and the linked recipe has tasting feedback, the
    recipe is silently forked before applying the rename.
    """
    updated = MenuSketchSectionItemService(session, org.organization_id).update_item(
        item.id, data, owner_id=current_user.id
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated


@router.delete("/{item_id}", status_code=200)
def delete_menu_sketch_section_item(
    item: MenuSketchSectionItem = Depends(require_sketch_item_access),
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> dict:
    """Hard-delete a dish item. The linked recipe is NOT deleted."""
    deleted = MenuSketchSectionItemService(session, org.organization_id).delete_item(item.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}
