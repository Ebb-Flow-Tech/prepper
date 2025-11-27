"""Instructions API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.deps import get_session
from app.models import Recipe, InstructionsRaw, InstructionsStructured
from app.domain import InstructionsService, RecipeService

router = APIRouter()


@router.post("/{recipe_id}/instructions/raw", response_model=Recipe)
def store_raw_instructions(
    recipe_id: int,
    data: InstructionsRaw,
    session: Session = Depends(get_session),
):
    """Store raw instructions text for a recipe."""
    service = InstructionsService(session)
    recipe = service.store_raw_instructions(recipe_id, data.text)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe


@router.post("/{recipe_id}/instructions/parse", response_model=Recipe)
def parse_instructions(
    recipe_id: int,
    session: Session = Depends(get_session),
):
    """Parse raw instructions into structured format using LLM."""
    recipe_service = RecipeService(session)
    recipe = recipe_service.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    if not recipe.instructions_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No raw instructions to parse",
        )

    instructions_service = InstructionsService(session)
    structured = instructions_service.parse_instructions_with_llm(
        recipe.instructions_raw
    )
    result = instructions_service.update_structured_instructions(recipe_id, structured)
    return result


@router.patch("/{recipe_id}/instructions/structured", response_model=Recipe)
def update_structured_instructions(
    recipe_id: int,
    data: InstructionsStructured,
    session: Session = Depends(get_session),
):
    """Manually update structured instructions."""
    service = InstructionsService(session)
    recipe = service.update_structured_instructions(recipe_id, {"steps": data.steps})
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )
    return recipe
