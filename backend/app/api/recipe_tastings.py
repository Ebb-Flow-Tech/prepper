"""Recipe-tasting session relationship API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_session
from app.api.guards import require_session_access
from app.api.tastings import _check_creator_only
from app.domain import RecipeTastingService, TastingSessionService
from app.models import (
    Recipe,
    RecipeTasting,
    RecipeTastingBatchCreate,
    RecipeTastingBatchResult,
    RecipeTastingCreate,
    RecipeTastingRead,
    RecipeTastingReorderRequest,
    User,
)
from app.models.tasting import TastingSession

router = APIRouter()


@router.get(
    "/{session_id}/recipes",
    response_model=list[RecipeTastingRead],
)
def get_session_recipes(
    session_id: int,
    session: Session = Depends(get_session),
    _session: TastingSession = Depends(require_session_access),
):
    """Get all recipes associated with a tasting session."""
    service = RecipeTastingService(session)
    return service.get_recipes_for_session(session_id)


@router.get(
    "/{session_id}/recipes-full",
    response_model=list[Recipe],
)
def get_session_recipes_full(
    session_id: int,
    session: Session = Depends(get_session),
    _session: TastingSession = Depends(require_session_access),
):
    """Get all recipes associated with a tasting session with full details.

    No access control - returns all recipes in the session regardless of user permissions.
    Used for displaying recipes in tasting session context.
    """
    # Join RecipeTasting with Recipe to get full recipe details
    statement = select(Recipe).join(RecipeTasting).where(
        RecipeTasting.tasting_session_id == session_id
    )
    return list(session.exec(statement).all())


@router.post(
    "/{session_id}/recipes",
    response_model=RecipeTasting,
    status_code=status.HTTP_201_CREATED,
)
def add_recipe_to_session(
    session_id: int,
    data: RecipeTastingCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _session: TastingSession = Depends(require_session_access),
):
    """Add a recipe to a tasting session. Only the session creator can do this."""
    tasting_service = TastingSessionService(session)
    tasting_session = tasting_service.get(session_id)
    if not tasting_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tasting session not found")
    _check_creator_only(tasting_session, current_user)

    service = RecipeTastingService(session)
    recipe_tasting = service.add_recipe_to_session(session_id, data)
    if not recipe_tasting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add recipe. Session or recipe not found, or recipe already in session.",
        )
    return recipe_tasting


@router.post(
    "/{session_id}/recipes/batch",
    response_model=RecipeTastingBatchResult,
    status_code=status.HTTP_200_OK,
)
def add_recipes_to_session_batch(
    session_id: int,
    data: RecipeTastingBatchCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _session: TastingSession = Depends(require_session_access),
):
    """Add multiple recipes to a tasting session. Only the session creator can do this."""
    tasting_service = TastingSessionService(session)
    tasting_session = tasting_service.get(session_id)
    if not tasting_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tasting session not found")
    _check_creator_only(tasting_session, current_user)

    service = RecipeTastingService(session)
    result = service.add_recipes_to_session(session_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tasting session not found")
    return result


@router.patch(
    "/{session_id}/recipes/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reorder_session_recipes(
    session_id: int,
    data: RecipeTastingReorderRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _session: TastingSession = Depends(require_session_access),
):
    """Reorder dishes in a tasting session by updating their sequence numbers. Creator-only."""
    tasting_service = TastingSessionService(session)
    tasting_session = tasting_service.get(session_id)
    if not tasting_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tasting session not found")
    _check_creator_only(tasting_session, current_user)

    service = RecipeTastingService(session)
    success = service.reorder_session_dishes(session_id, data.items)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not reorder dishes. Some dish IDs may not belong to this session.",
        )
    return None


@router.delete(
    "/{session_id}/recipes/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_recipe_from_session(
    session_id: int,
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _session: TastingSession = Depends(require_session_access),
):
    """Remove a recipe from a tasting session. Only the session creator can do this."""
    tasting_service = TastingSessionService(session)
    tasting_session = tasting_service.get(session_id)
    if not tasting_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tasting session not found")
    _check_creator_only(tasting_session, current_user)

    service = RecipeTastingService(session)
    deleted = service.remove_recipe_from_session(session_id, recipe_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found in session.",
        )
    return None
