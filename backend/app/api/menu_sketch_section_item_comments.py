"""Menu sketch section item comment API router.

The deepest link in the chain: comment -> item -> section -> sketch -> org. A comment id never
mentions a sketch, which is exactly why a guard on the sketch alone would have left these five
routes open. See the menu-sketch family comment in `api/guards.py`.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import OrgContext, get_org_context, get_session
from app.api.guards import (
    require_sketch_access,
    require_sketch_comment_access,
    sketch_item_reachable,
)
from app.domain.menu_sketch_section_item_comment_service import (
    MenuSketchSectionItemCommentService,
)
from app.models.menu_sketch import MenuSketch
from app.models.menu_sketch_section_item_comment import (
    MenuSketchCommentsResponse,
    MenuSketchSectionItemComment,
    MenuSketchSectionItemCommentCreate,
    MenuSketchSectionItemCommentRead,
    MenuSketchSectionItemCommentUpdate,
)

router = APIRouter()


@router.get("/menu-sketch/{menu_sketch_id}", response_model=MenuSketchCommentsResponse)
def get_comments_for_menu(
    sketch: MenuSketch = Depends(require_sketch_access),
    session: Session = Depends(get_session),
) -> MenuSketchCommentsResponse:
    """Aggregated comments for all dishes in a menu sketch."""
    return MenuSketchSectionItemCommentService(session).get_comments_for_menu(sketch.id)


@router.post("", response_model=MenuSketchSectionItemCommentRead, status_code=201)
def create_comment(
    data: MenuSketchSectionItemCommentCreate,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSectionItemComment:
    """Add a comment to a dish item. 404 if the item is not in the acting org.

    The item id arrives in the BODY, so no dependency can resolve it — the route has to ask.
    """
    if not sketch_item_reachable(session, data.menu_sketch_section_item_id, org.organization_id):
        raise HTTPException(status_code=404, detail="Section item not found")
    comment = MenuSketchSectionItemCommentService(session).create_comment(data)
    if comment is None:
        raise HTTPException(status_code=404, detail="Section item not found")
    return comment


@router.patch("/{comment_id}", response_model=MenuSketchSectionItemCommentRead)
def update_comment(
    data: MenuSketchSectionItemCommentUpdate,
    comment: MenuSketchSectionItemComment = Depends(require_sketch_comment_access),
    session: Session = Depends(get_session),
) -> MenuSketchSectionItemComment:
    """Update comment text."""
    updated = MenuSketchSectionItemCommentService(session).update_comment(comment.id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return updated


@router.patch("/resolve/{comment_id}", response_model=MenuSketchSectionItemCommentRead)
def resolve_comment(
    comment: MenuSketchSectionItemComment = Depends(require_sketch_comment_access),
    session: Session = Depends(get_session),
) -> MenuSketchSectionItemComment:
    """Mark a comment as resolved."""
    resolved = MenuSketchSectionItemCommentService(session).resolve_comment(comment.id)
    if resolved is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return resolved


@router.delete("/{comment_id}", status_code=200)
def delete_comment(
    comment: MenuSketchSectionItemComment = Depends(require_sketch_comment_access),
    session: Session = Depends(get_session),
) -> dict:
    """Hard-delete a comment."""
    deleted = MenuSketchSectionItemCommentService(session).delete_comment(comment.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}
