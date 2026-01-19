"""Category Agent - AI agent for categorizing ingredients using Claude.

This agent uses the Claude Agent SDK to:
1. Perform semantic search for category matching
2. Query existing categories by name (with similarity threshold)
3. Add new categories when no match is found
"""

import json
from difflib import SequenceMatcher
from typing import Any

import anthropic
from sqlmodel import Session, select, func

from app.config import get_settings
from app.models.category import Category, CategoryCreate


# Tool definitions for the Claude agent
TOOLS = [
    {
        "name": "query_category_by_name",
        "description": "Search for a category by name using semantic similarity. Returns the closest matching category if similarity is >= 0.8, otherwise returns null.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The category name to search for"
                }
            },
            "required": ["name"]
        }
    },
    {
        "name": "add_category",
        "description": "Add a new category to the database. The name will be converted to title case.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The name of the category to add"
                },
                "description": {
                    "type": "string",
                    "description": "Optional description for the category"
                }
            },
            "required": ["name"]
        }
    }
]

SYSTEM_PROMPT = """You are a helpful assistant that categorizes ingredients into food categories.

Your task is to:
1. When given an ingredient name, determine the most appropriate food category for it
2. Use the query_category_by_name tool to search for an existing category that matches
3. If a category is found (similarity >= 0.8), return that category
4. If no category is found, use the add_category tool to create a new appropriate category

Guidelines for categorization:
- Use common ingredient category names (e.g., "Dairy", "Meat", "Poultry", "Seafood", "Vegetables", "Fruits", "Grains", "Spices", "Herbs", "Oils", "Condiments", "Baking", "Nuts", "Legumes", etc.)
- Always convert category names to Title Case
- Be specific but not overly granular (e.g., use "Dairy" not "Milk Products")
- Consider what type of ingredient it is and how it's typically used in cooking

Always respond with a brief explanation of the category you chose and why it fits the ingredient."""


class CategoryAgent:
    """Agent for categorizing ingredients using Claude with tool use."""

    SIMILARITY_THRESHOLD = 0.8

    def __init__(self, session: Session):
        """Initialize the category agent.

        Args:
            session: SQLModel database session for category operations
        """
        self.session = session
        self.settings = get_settings()
        self._last_category_id: int | None = None
        self._last_category_name: str | None = None

        if not self.settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured")

        self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate similarity ratio between two strings (case-insensitive).

        Uses SequenceMatcher for semantic similarity calculation.
        """
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()

    def _query_category_by_name(self, name: str) -> dict[str, Any] | None:
        """Query for a category by name with similarity matching.

        Returns the closest matching category if similarity >= 0.8.

        Args:
            name: The category name to search for

        Returns:
            Category dict if found with sufficient similarity, None otherwise
        """
        # Get all active categories
        statement = select(Category).where(Category.is_active == True)
        categories = list(self.session.exec(statement).all())

        if not categories:
            return None

        # Find the best matching category
        best_match: Category | None = None
        best_similarity = 0.0

        for category in categories:
            similarity = self._calculate_similarity(name, category.name)
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = category

        # Only return if similarity meets threshold
        if best_match and best_similarity >= self.SIMILARITY_THRESHOLD:
            return {
                "id": best_match.id,
                "name": best_match.name,
                "description": best_match.description,
                "similarity": round(best_similarity, 3)
            }

        return None

    def _add_category(self, name: str, description: str | None = None) -> dict[str, Any]:
        """Add a new category to the database.

        Args:
            name: Category name (will be converted to title case)
            description: Optional category description

        Returns:
            The created category as a dict
        """
        # Convert to title case
        title_case_name = name.title()

        # Check if category already exists (case-insensitive)
        existing = self.session.exec(
            select(Category).where(
                func.lower(Category.name) == title_case_name.lower(),
                Category.is_active == True
            )
        ).first()

        if existing:
            return {
                "id": existing.id,
                "name": existing.name,
                "description": existing.description,
                "already_existed": True
            }

        # Create new category
        category_data = CategoryCreate(name=title_case_name, description=description)
        category = Category.model_validate(category_data)
        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)

        return {
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "already_existed": False
        }

    def _process_tool_call(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        """Process a tool call from Claude.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Input parameters for the tool

        Returns:
            JSON string with the tool result
        """
        print(f"[Tool Call] {tool_name}")
        print(f"[Tool Input] {json.dumps(tool_input, indent=2)}")

        if tool_name == "query_category_by_name":
            result = self._query_category_by_name(tool_input["name"])
            if result:
                self._last_category_id = result["id"]
                self._last_category_name = result["name"]
            return json.dumps(result) if result else json.dumps(None)

        elif tool_name == "add_category":
            result = self._add_category(
                name=tool_input["name"],
                description=tool_input.get("description")
            )
            self._last_category_id = result["id"]
            self._last_category_name = result["name"]
            return json.dumps(result)

        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

    async def categorize_ingredient(self, ingredient_name: str) -> dict[str, Any]:
        """Categorize an ingredient by name using Claude with tool use.

        This method implements the agentic loop:
        1. Send ingredient name to Claude
        2. Claude performs semantic analysis and calls tools
        3. Process tool results and continue until Claude provides final answer

        Args:
            ingredient_name: The name of the ingredient to categorize

        Returns:
            Dict with category info and agent's explanation
        """
        messages = [
            {
                "role": "user",
                "content": f"Please categorize this ingredient: '{ingredient_name}'\n\nFirst, search for an existing category that might match. If none is found, create an appropriate new category."
            }
        ]

        # Agentic loop - continue until we get a final response
        while True:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages
            )

            # Check if Claude wants to use a tool
            if response.stop_reason == "tool_use":
                # Find tool use blocks
                tool_uses = [
                    block for block in response.content
                    if block.type == "tool_use"
                ]

                # Add assistant message with tool use
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })

                # Process each tool call and add results
                tool_results = []
                for tool_use in tool_uses:
                    result = self._process_tool_call(
                        tool_use.name,
                        tool_use.input
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": result
                    })

                messages.append({
                    "role": "user",
                    "content": tool_results
                })

            else:
                # Claude has finished - extract the final response
                final_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        final_text += block.text

                return {
                    "category_id": self._last_category_id,
                    "category_name": self._last_category_name,
                    "explanation": final_text,
                    "success": True
                }

    def categorize_ingredient_sync(self, ingredient_name: str) -> dict[str, Any]:
        """Synchronous version of categorize_ingredient.

        Args:
            ingredient_name: The name of the ingredient to categorize

        Returns:
            Dict with category info and agent's explanation
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
                        asyncio.run,
                        self.categorize_ingredient(ingredient_name)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(self.categorize_ingredient(ingredient_name))
        except RuntimeError:
            return asyncio.run(self.categorize_ingredient(ingredient_name))
