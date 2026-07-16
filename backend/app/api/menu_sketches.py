"""Menu sketch API router — freeform canvas menu sketches."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.api.deps import OrgContext, get_org_context, get_session
from app.domain.menu_sketch_service import MenuSketchService
from app.models.menu_sketch import (
    MenuSketch,
    MenuSketchCreate,
    MenuSketchRead,
    MenuSketchUpdate,
)

router = APIRouter()


@router.get("", response_model=list[MenuSketchRead])
def list_menu_sketches(
    include_archived: bool = Query(False, description="Include archived sketches"),
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> list[MenuSketch]:
    """List menu sketches. Pass include_archived=true to include archived ones."""
    return MenuSketchService(session, org.organization_id).list_sketches(
        include_archived=include_archived
    )


@router.get("/{sketch_id}", response_model=MenuSketchRead)
def get_menu_sketch(
    sketch_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketch:
    """Get a single menu sketch by ID."""
    sketch = MenuSketchService(session, org.organization_id).get_sketch(sketch_id)
    if sketch is None:
        raise HTTPException(status_code=404, detail="Sketch not found")
    return sketch


@router.post("", response_model=MenuSketchRead, status_code=201)
def create_menu_sketch(
    data: MenuSketchCreate,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketch:
    """Create a new menu sketch."""
    return MenuSketchService(session, org.organization_id).create_sketch(data)


@router.patch("/{sketch_id}", response_model=MenuSketchRead)
def update_menu_sketch(
    sketch_id: int,
    data: MenuSketchUpdate,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketch:
    """Update a menu sketch."""
    sketch = MenuSketchService(session, org.organization_id).update_sketch(
        sketch_id, data
    )
    if sketch is None:
        raise HTTPException(status_code=404, detail="Sketch not found")
    return sketch


@router.delete("/{sketch_id}", status_code=200)
def delete_menu_sketch(
    sketch_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> dict:
    """Soft-delete a menu sketch (sets status to 'archived')."""
    deleted = MenuSketchService(session, org.organization_id).delete_sketch(sketch_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sketch not found")
    return {"ok": True}


@router.post("/{sketch_id}/fork", response_model=MenuSketchRead, status_code=201)
def fork_menu_sketch(
    sketch_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketch:
    """Fork a menu sketch — creates a copy with incremented version."""
    sketch = MenuSketchService(session, org.organization_id).fork_sketch(sketch_id)
    if sketch is None:
        raise HTTPException(status_code=404, detail="Sketch not found")
    return sketch
