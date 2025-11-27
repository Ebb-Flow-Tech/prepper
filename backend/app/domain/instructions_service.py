"""Instructions processing operations."""

from datetime import datetime
from typing import Any

from sqlmodel import Session

from app.models import Recipe


class InstructionsService:
    """Service for recipe instructions processing."""

    def __init__(self, session: Session):
        self.session = session

    def store_raw_instructions(self, recipe_id: int, text: str) -> Recipe | None:
        """Store raw instructions text for a recipe."""
        recipe = self.session.get(Recipe, recipe_id)
        if not recipe:
            return None

        recipe.instructions_raw = text
        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def parse_instructions_with_llm(self, raw_text: str) -> dict[str, Any]:
        """
        Parse raw instructions text into structured JSON using LLM.

        This is a placeholder for LLM integration.
        Returns a structured format with numbered steps.
        """
        # TODO: Integrate with LLM service (OpenAI, Anthropic, etc.)
        # For now, return a simple line-by-line parsing
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        steps = [
            {"step_number": i + 1, "instruction": line}
            for i, line in enumerate(lines)
        ]
        return {"steps": steps}

    def update_structured_instructions(
        self, recipe_id: int, structured: dict[str, Any]
    ) -> Recipe | None:
        """Update the structured instructions for a recipe."""
        recipe = self.session.get(Recipe, recipe_id)
        if not recipe:
            return None

        recipe.instructions_structured = structured
        recipe.updated_at = datetime.utcnow()
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        return recipe

    def parse_and_store_instructions(
        self, recipe_id: int, raw_text: str
    ) -> Recipe | None:
        """
        Full flow: store raw, parse with LLM, store structured.

        1. Save raw text
        2. LLM formats → JSON steps
        3. Store structured output
        """
        recipe = self.store_raw_instructions(recipe_id, raw_text)
        if not recipe:
            return None

        structured = self.parse_instructions_with_llm(raw_text)
        return self.update_structured_instructions(recipe_id, structured)
