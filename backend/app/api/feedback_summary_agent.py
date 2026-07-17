"""API router for the Feedback Summary Agent."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.agents.feedback_summary_agent import FeedbackSummaryAgent
from app.api.guards import require_recipe_access
from app.api.rate_limit import rate_limit_ai
from app.database import get_session
from app.models import Recipe

router = APIRouter()


class SummarizeFeedbackResponse(BaseModel):
    """Response from the feedback summary agent."""

    summary: str | None
    success: bool


@router.post(
    "/summarize-feedback/{recipe_id}",
    dependencies=[Depends(rate_limit_ai)],
    response_model=SummarizeFeedbackResponse,
    status_code=status.HTTP_200_OK,
    summary="Summarize recipe feedback",
    description="Use AI agent to summarize all tasting feedback for a recipe. The agent retrieves all feedback notes and creates a comprehensive summary.",
)
async def summarize_feedback(
    recipe_id: int,
    session: Session = Depends(get_session),
    _recipe: Recipe = Depends(require_recipe_access),
) -> SummarizeFeedbackResponse:
    """Summarize all tasting feedback for a recipe using the AI agent.

    The agent will:
    1. Retrieve all feedback from tasting notes for the recipe
    2. Analyze and organize the feedback
    3. Create a comprehensive summary capturing key themes and insights

    Returns empty summary with success=false if no feedback exists or summarization fails.
    """
    try:
        agent = FeedbackSummaryAgent(session)
        result = await agent.summarize_feedback(recipe_id)
        return SummarizeFeedbackResponse(**result)
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
