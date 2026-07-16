"""Recipe tasting history API routes (mounted under /recipes)."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_current_user, get_session
from app.api.guards import require_recipe_access
from app.domain import TastingNoteService
from app.models import (
    Recipe,
    RecipeTastingSummary,
    TastingNoteWithRecipe,
    User,
)

router = APIRouter()


@router.get(
    "/with-feedback",
    response_model=list[Recipe],
)
def get_recipes_with_feedback(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Recipes with tasting feedback, scoped to what the CALLER may see.

    The user id used to come from the URL path. The service scoped correctly — against whoever the
    caller named, so substituting a victim's id returned their confidential recipes. Full
    authorisation machinery wired to an attacker-supplied identity.

    The identity now comes from the token, which is the only place it can come from. The path
    parameter is gone rather than ignored: a `{user_id}` that no longer does anything is an
    invitation to wire it back up.
    """
    service = TastingNoteService(session)
    return service.get_recipes_with_feedback(user_id=current_user.id)


@router.get(
    "/{recipe_id}/tasting-notes",
    response_model=list[TastingNoteWithRecipe],
)
def get_recipe_tasting_notes(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Get all tasting notes for a recipe."""
    service = TastingNoteService(session)
    return service.get_for_recipe(recipe_id)


@router.get(
    "/{recipe_id}/tasting-summary",
    response_model=RecipeTastingSummary,
)
def get_recipe_tasting_summary(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
):
    """Get aggregated tasting data for a recipe."""
    service = TastingNoteService(session)
    return service.get_recipe_summary(recipe_id)
