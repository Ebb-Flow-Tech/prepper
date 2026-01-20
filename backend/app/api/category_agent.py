"""API router for the Category Agent."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.agents.category_agent import CategoryAgent

router = APIRouter()


class CategorizeIngredientRequest(BaseModel):
    """Request body for categorizing an ingredient."""

    ingredient_name: str


class CategorizeIngredientResponse(BaseModel):
    """Response from the category agent."""

    category_id: int | None
    category_name: str | None
    explanation: str
    success: bool


@router.post(
    "/categorize-ingredient",
    response_model=CategorizeIngredientResponse,
    status_code=status.HTTP_200_OK,
    summary="Categorize an ingredient",
    description="Use AI agent to categorize an ingredient by name. The agent will search for existing categories and create new ones if needed.",
)
async def categorize_ingredient(
    request: CategorizeIngredientRequest,
    session: Session = Depends(get_session),
) -> CategorizeIngredientResponse:
    """Categorize an ingredient using the AI agent.

    The agent will:
    1. Analyze the ingredient name semantically
    2. Search for existing categories with >= 0.8 similarity
    3. If found, return the matching category
    4. If not found, create a new category in title case
    """
    try:
        agent = CategoryAgent(session)
        result = await agent.categorize_ingredient(request.ingredient_name)
        return CategorizeIngredientResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent error: {str(e)}",
        )
