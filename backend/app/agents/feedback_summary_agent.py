"""Feedback Summary Agent - AI agent for summarizing tasting feedback using Claude with tool use.

This agent uses Claude with tool use to:
1. Retrieve all feedback from tasting_notes for a recipe
2. Combine and summarize the feedback
"""

import json
import time
from typing import Any

import anthropic
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.config import get_settings
from app.models.tasting import TastingNote


# Structured output schema for the agent response
class FeedbackSummaryResult(BaseModel):
    """Structured output for feedback summary result."""

    summary: str | None = Field(description="Summary of all feedback for the recipe, or None if no feedback exists")
    success: bool = Field(default=True, description="Whether summarization was successful")


# Tool definitions for the Claude agent
TOOLS = [
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

SYSTEM_PROMPT = """You are a helpful assistant that summarizes tasting feedback for recipes.

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


class FeedbackSummaryAgent:
    """Agent for summarizing tasting feedback using Claude with tool use."""

    def __init__(self, session: Session):
        """Initialize the feedback summary agent.

        Args:
            session: SQLModel database session for feedback retrieval
        """
        self.session = session
        self.settings = get_settings()
        self._last_summary: str | None = None

        if not self.settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured")

        self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

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
        start_time = time.perf_counter()
        print(f"[Tool Call] {tool_name}")
        print(f"[Tool Input] {json.dumps(tool_input, indent=2)}")

        if tool_name == "retrieve_feedback":
            recipe_id = tool_input.get("recipe_id")
            feedback_list = self._retrieve_feedback(recipe_id)
            output = json.dumps(
                {
                    "feedback_count": len(feedback_list),
                    "feedback": feedback_list,
                }
            )

        elif tool_name == "finalize_summary":
            summary = tool_input.get("summary", "")
            self._last_summary = summary
            output = json.dumps({"status": "finalized"})

        else:
            output = json.dumps({"error": f"Unknown tool: {tool_name}"})

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        print(f"[Tool Time] {tool_name}: {elapsed_ms:.2f}ms")
        return output

    async def summarize_feedback(self, recipe_id: int) -> dict[str, Any]:
        """Summarize all tasting feedback for a recipe using Claude with tool use.

        This method implements the agentic loop:
        1. Send recipe ID to Claude
        2. Claude retrieves feedback and creates summary
        3. Process tool results and continue until Claude provides final answer

        Args:
            recipe_id: The ID of the recipe to summarize feedback for

        Returns:
            Dict with summary and success status
        """
        overall_start = time.perf_counter()
        api_call_count = 0
        total_api_time_ms = 0.0

        print(f"\n{'='*60}")
        print(f"[Feedback Summary Agent] Starting summarization for recipe: {recipe_id}")
        print(f"{'='*60}")

        messages = [
            {
                "role": "user",
                "content": f"Please summarize all the feedback from tasting notes for recipe ID {recipe_id}. First retrieve all the feedback, then create a comprehensive summary.",
            }
        ]

        try:
            # Agentic loop - continue until we get a final response
            while True:
                api_call_count += 1
                api_start = time.perf_counter()
                print(f"\n[API Call #{api_call_count}] Calling Claude...")

                response = self.client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=1024,
                    system=SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=messages,
                )

                api_elapsed_ms = (time.perf_counter() - api_start) * 1000
                total_api_time_ms += api_elapsed_ms
                print(
                    f"[API Call #{api_call_count}] Completed in {api_elapsed_ms:.2f}ms (stop_reason: {response.stop_reason})"
                )

                # Check if Claude wants to use a tool
                if response.stop_reason == "tool_use":
                    # Find tool use blocks
                    tool_uses = [
                        block for block in response.content if block.type == "tool_use"
                    ]

                    # Add assistant message with tool use
                    messages.append({"role": "assistant", "content": response.content})

                    # Process each tool call and add results
                    tool_results = []
                    finalized = False
                    for tool_use in tool_uses:
                        result = self._process_tool_call(tool_use.name, tool_use.input)
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_use.id,
                                "content": result,
                            }
                        )
                        # Check if finalization tool was called
                        if tool_use.name == "finalize_summary":
                            finalized = True

                    messages.append({"role": "user", "content": tool_results})

                    # If finalized, break the loop and return the result
                    if finalized:
                        overall_elapsed_ms = (time.perf_counter() - overall_start) * 1000
                        print(f"\n{'='*60}")
                        print(f"[Feedback Summary Agent] TIMING SUMMARY")
                        print(f"{'='*60}")
                        print(f"  Total API calls: {api_call_count}")
                        print(f"  Total API time: {total_api_time_ms:.2f}ms")
                        print(f"  Overall time: {overall_elapsed_ms:.2f}ms")
                        print(
                            f"  Overhead (non-API): {overall_elapsed_ms - total_api_time_ms:.2f}ms"
                        )
                        print(f"{'='*60}\n")

                        result = FeedbackSummaryResult(
                            summary=self._last_summary or "",
                            success=self._last_summary is not None,
                        )
                        return result.model_dump()

                else:
                    # Claude has finished without finalization
                    overall_elapsed_ms = (time.perf_counter() - overall_start) * 1000
                    print(f"\n{'='*60}")
                    print(f"[Feedback Summary Agent] TIMING SUMMARY")
                    print(f"{'='*60}")
                    print(f"  Total API calls: {api_call_count}")
                    print(f"  Total API time: {total_api_time_ms:.2f}ms")
                    print(f"  Overall time: {overall_elapsed_ms:.2f}ms")
                    print(
                        f"  Overhead (non-API): {overall_elapsed_ms - total_api_time_ms:.2f}ms"
                    )
                    print(f"{'='*60}\n")

                    result = FeedbackSummaryResult(
                        summary="",
                        success=False,
                    )
                    return result.model_dump()
        except ValueError as e:
            # No feedback found or other validation error
            print(f"\n[Feedback Summary Agent] Error: {str(e)}")
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
        import asyncio

        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're already in an async context, create a new loop
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run, self.summarize_feedback(recipe_id)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(self.summarize_feedback(recipe_id))
        except RuntimeError:
            return asyncio.run(self.summarize_feedback(recipe_id))
