"""Recipe tasting history API routes (mounted under /recipes)."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_session
from app.models import (
    TastingNoteWithRecipe,
    RecipeTastingSummary,
    Recipe,
)
from app.domain import TastingNoteService


router = APIRouter()


@router.get(
    "/with-feedback/{user_id}",
    response_model=list[Recipe],
)
def get_recipes_with_feedback(
    user_id: str,
    session: Session = Depends(get_session),
):
    """Get all unique recipes that have at least one tasting note."""
    service = TastingNoteService(session)
    return service.get_recipes_with_feedback(user_id=user_id)


@router.get(
    "/{recipe_id}/tasting-notes",
    response_model=list[TastingNoteWithRecipe],
)
def get_recipe_tasting_notes(
    recipe_id: int,
    session: Session = Depends(get_session),
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
):
    """Get aggregated tasting data for a recipe."""
    service = TastingNoteService(session)
    return service.get_recipe_summary(recipe_id)
