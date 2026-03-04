"""Recipe-tasting session relationship API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_session, get_current_user
from app.models import Recipe, RecipeTasting, RecipeTastingCreate, User
from app.domain import RecipeTastingService, TastingSessionService
from app.api.tastings import _check_creator_only


router = APIRouter()


@router.get(
    "/{session_id}/recipes",
    response_model=list[RecipeTasting],
)
def get_session_recipes(
    session_id: int,
    session: Session = Depends(get_session),
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


@router.delete(
    "/{session_id}/recipes/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_recipe_from_session(
    session_id: int,
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
