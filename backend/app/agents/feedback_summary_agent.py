"""Feedback Summary Agent - AI agent for summarizing tasting feedback using Claude with tool use.

This agent uses Claude with tool use to:
1. Retrieve all feedback from tasting_notes for a recipe
2. Combine and summarize the feedback
"""

import json
from typing import Any

from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.agents.base_agent import BaseAgent
from app.agents.agent_utils import print_tool_call, print_tool_timing, run_async_in_sync, time_it
from app.models.tasting import TastingNote


# Structured output schema for the agent response
class FeedbackSummaryResult(BaseModel):
    """Structured output for feedback summary result."""

    summary: str | None = Field(description="Summary of all feedback for the recipe, or None if no feedback exists")
    success: bool = Field(default=True, description="Whether summarization was successful")


class FeedbackSummaryAgent(BaseAgent):
    """Agent for summarizing tasting feedback using Claude with tool use."""

    @property
    def agent_name(self) -> str:
        """Name of the agent for logging purposes."""
        return "Feedback Summary Agent"

    @property
    def tools(self) -> list[dict[str, Any]]:
        """Tool definitions for the agent."""
        return [
            {
                "name": "retrieve_feedback",
                "description": "Retrieve all feedback from tasting notes for a specific recipe. Returns a list of feedback strings.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "recipe_id": {
                            "type": "integer",
                            "description": "The recipe ID to retrieve feedback for",
                        }
                    },
                    "required": ["recipe_id"],
                },
            },
            {
                "name": "finalize_summary",
                "description": "Finalize the feedback summary. Call this when you have completed the summarization.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "The summary of all feedback",
                        }
                    },
                    "required": ["summary"],
                },
            },
        ]

    @property
    def system_prompt(self) -> str:
        """System prompt for the agent."""
        return """You are a helpful assistant that summarizes tasting feedback for recipes.

Your task is to:
1. Use the retrieve_feedback tool to get all feedback notes for the recipe
2. Read through all the feedback carefully
3. Identify key themes, patterns, and common points mentioned across all feedback
4. Create a concise, well-organized summary that captures:
   - Main flavor/taste feedback
   - Texture and presentation comments
   - Common action items or improvement suggestions
   - Overall sentiment and decisions
5. Use the finalize_summary tool to provide the final summary

Guidelines for summarization:
- Be concise but comprehensive (2-4 paragraphs)
- Group similar feedback together
- Highlight consensus points and common themes
- Distinguish between consistent feedback and outlier opinions
- Focus on actionable insights
- If no feedback exists, indicate that clearly
"""

    def __init__(self, session: Session):
        """Initialize the feedback summary agent.

        Args:
            session: SQLModel database session for feedback retrieval
        """
        super().__init__(session)
        self._last_summary: str | None = None

    def _retrieve_feedback(self, recipe_id: int) -> list[str]:
        """Retrieve all feedback from tasting notes for a recipe.

        Args:
            recipe_id: The recipe ID to retrieve feedback for

        Returns:
            List of feedback strings

        Raises:
            ValueError: If no feedback exists for the recipe
        """
        statement = select(TastingNote).where(TastingNote.recipe_id == recipe_id)
        notes = list(self.session.exec(statement).all())

        feedback_list = []
        for note in notes:
            if note.feedback:
                feedback_list.append(note.feedback)

        if not feedback_list:
            raise ValueError(f"No feedback found for recipe {recipe_id}")

        return feedback_list

    def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        """Process a tool call from Claude.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Input parameters for the tool

        Returns:
            JSON string with the tool result
        """
        print_tool_call(tool_name, tool_input)

        def execute_tool() -> str:
            if tool_name == "retrieve_feedback":
                recipe_id = tool_input.get("recipe_id")
                feedback_list = self._retrieve_feedback(recipe_id)
                return json.dumps(
                    {
                        "feedback_count": len(feedback_list),
                        "feedback": feedback_list,
                    }
                )

            elif tool_name == "finalize_summary":
                summary = tool_input.get("summary", "")
                self._last_summary = summary
                return json.dumps({"status": "finalized"})

            else:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})

        output, elapsed_ms = time_it(lambda: execute_tool())
        print_tool_timing(tool_name, elapsed_ms)
        return output

    def _on_finalization(self) -> dict[str, Any]:
        """Return the final result when agent finalization is complete.

        Returns:
            Dictionary with the agent's result
        """
        result = FeedbackSummaryResult(
            summary=self._last_summary or "",
            success=self._last_summary is not None,
        )
        return result.model_dump()

    async def summarize_feedback(self, recipe_id: int) -> dict[str, Any]:
        """Summarize all tasting feedback for a recipe using Claude with tool use.

        Args:
            recipe_id: The ID of the recipe to summarize feedback for

        Returns:
            Dict with summary and success status
        """
        try:
            initial_message = f"Please summarize all the feedback from tasting notes for recipe ID {recipe_id}. First retrieve all the feedback, then create a comprehensive summary."
            return await self._run_agentic_loop(initial_message)
        except ValueError as e:
            # No feedback found or other validation error
            print(f"\n[{self.agent_name}] Error: {str(e)}")
            result = FeedbackSummaryResult(
                summary=None,
                success=False,
            )
            return result.model_dump()

    def summarize_feedback_sync(self, recipe_id: int) -> dict[str, Any]:
        """Synchronous version of summarize_feedback.

        Args:
            recipe_id: The ID of the recipe to summarize feedback for

        Returns:
            Dict with summary and success status
        """
        return run_async_in_sync(self.summarize_feedback(recipe_id))
