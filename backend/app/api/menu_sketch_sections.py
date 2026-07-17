"""Menu sketch section API router.

Every route here hangs off a menu sketch, and the sketch is what carries the org. These routes used
to resolve a bare `section_id` or a body-supplied `menu_sketch_id` and never ask whose it was, so a
guessed integer reached straight past the parent's org scoping. The guards in `api/guards.py` follow
the chain back to the sketch; see the family comment there.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import OrgContext, get_org_context, get_session
from app.api.guards import (
    require_section_access,
    require_sketch_access,
    sketch_reachable,
)
from app.domain.menu_sketch_section_service import MenuSketchSectionService
from app.models.menu_sketch import MenuSketch
from app.models.menu_sketch_section import (
    MenuSketchSection,
    MenuSketchSectionCreate,
    MenuSketchSectionRead,
    MenuSketchSectionUpdate,
)

router = APIRouter()


@router.get("", response_model=list[MenuSketchSectionRead])
def list_menu_sketch_sections(
    sketch: MenuSketch = Depends(require_sketch_access),
    session: Session = Depends(get_session),
) -> list[MenuSketchSection]:
    """List all sections for a menu sketch.

    `menu_sketch_id` is a query parameter, and `require_sketch_access` resolves it — so the id the
    guard checked and the id the service reads are the same value by construction.
    """
    return MenuSketchSectionService(session).list_sections(sketch.id)


@router.post("", response_model=MenuSketchSectionRead, status_code=201)
def create_menu_sketch_section(
    data: MenuSketchSectionCreate,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSection:
    """Create a section. 404 if the sketch does not exist or is not in the acting org.

    The parent id arrives in the BODY, so no dependency can resolve it — the route has to ask.
    That is exactly the shape that hid an IDOR inside `tasting-note-images/sync/*`.
    """
    if not sketch_reachable(session, data.menu_sketch_id, org.organization_id):
        raise HTTPException(status_code=404, detail="Menu sketch not found")
    section = MenuSketchSectionService(session).create_section(data)
    if section is None:
        raise HTTPException(status_code=404, detail="Menu sketch not found")
    return section


@router.patch("/{section_id}", response_model=MenuSketchSectionRead)
def update_menu_sketch_section(
    data: MenuSketchSectionUpdate,
    section: MenuSketchSection = Depends(require_section_access),
    session: Session = Depends(get_session),
) -> MenuSketchSection:
    """Update a section."""
    updated = MenuSketchSectionService(session).update_section(section.id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Section not found")
    return updated


@router.delete("/{section_id}", status_code=200)
def delete_menu_sketch_section(
    section: MenuSketchSection = Depends(require_section_access),
    session: Session = Depends(get_session),
) -> dict:
    """Hard-delete a section (cascades to items and comments)."""
    deleted = MenuSketchSectionService(session).delete_section(section.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Section not found")
    return {"ok": True}
