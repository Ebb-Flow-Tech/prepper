"""Tests for the Category Agent."""

from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session, select

from app.agents.category_agent import CategoryAgent
from app.models.category import Category

# Import mock classes from conftest
from tests.conftest import MockContentBlock, MockToolUseBlock, MockClaudeResponse


class TestCategoryAgentInit:
    """Tests for CategoryAgent initialization."""

    def test_init_success(self, session: Session, mock_settings, mock_anthropic):
        """Test successful agent initialization."""
        agent = CategoryAgent(session)
        assert agent.session == session
        assert agent._last_category_id is None
        assert agent._last_category_name is None
        mock_anthropic.assert_called_once_with(api_key="test-api-key")

    def test_init_no_api_key(self, session: Session, agent_no_api_key):
        """Test initialization fails without API key."""
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY is not configured"):
            CategoryAgent(session)


class TestSimilarityCalculation:
    """Tests for similarity calculation."""

    def test_exact_match(self, session: Session, mock_settings, mock_anthropic):
        """Test exact match returns 1.0."""
        agent = CategoryAgent(session)
        assert agent._calculate_similarity("Dairy", "Dairy") == 1.0

    def test_case_insensitive(self, session: Session, mock_settings, mock_anthropic):
        """Test similarity is case-insensitive."""
        agent = CategoryAgent(session)
        assert agent._calculate_similarity("DAIRY", "dairy") == 1.0
        assert agent._calculate_similarity("Dairy", "DAIRY") == 1.0

    def test_similar_strings(self, session: Session, mock_settings, mock_anthropic):
        """Test similar strings have high similarity."""
        agent = CategoryAgent(session)
        # "Vegetables" vs "Vegetable" should be > 0.8
        similarity = agent._calculate_similarity("Vegetables", "Vegetable")
        assert similarity > 0.8

    def test_different_strings(self, session: Session, mock_settings, mock_anthropic):
        """Test different strings have low similarity."""
        agent = CategoryAgent(session)
        similarity = agent._calculate_similarity("Dairy", "Seafood")
        assert similarity < 0.5


class TestQueryCategoryByName:
    """Tests for querying categories by name."""

    def test_exact_match_found(self, session: Session, mock_settings, mock_anthropic):
        """Test finding an exact category match."""
        # Create a category in the database
        category = Category(name="Dairy", description="Milk products")
        session.add(category)
        session.commit()
        session.refresh(category)

        agent = CategoryAgent(session)
        result = agent._query_category_by_name("Dairy")

        assert result is not None
        assert result["id"] == category.id
        assert result["name"] == "Dairy"
        assert result["similarity"] == 1.0

    def test_similar_match_found(self, session: Session, mock_settings, mock_anthropic):
        """Test finding a similar category match above threshold."""
        category = Category(name="Vegetables", description="Fresh vegetables")
        session.add(category)
        session.commit()
        session.refresh(category)

        agent = CategoryAgent(session)
        result = agent._query_category_by_name("Vegetable")

        assert result is not None
        assert result["id"] == category.id
        assert result["name"] == "Vegetables"
        assert result["similarity"] >= 0.8

    def test_no_match_below_threshold(self, session: Session, mock_settings, mock_anthropic):
        """Test that low similarity doesn't return a match."""
        category = Category(name="Dairy", description="Milk products")
        session.add(category)
        session.commit()

        agent = CategoryAgent(session)
        result = agent._query_category_by_name("Seafood")

        assert result is None

    def test_no_categories_exist(self, session: Session, mock_settings, mock_anthropic):
        """Test querying when no categories exist."""
        agent = CategoryAgent(session)
        result = agent._query_category_by_name("Dairy")

        assert result is None

    def test_inactive_categories_excluded(self, session: Session, mock_settings, mock_anthropic):
        """Test that inactive categories are not matched."""
        category = Category(name="Dairy", description="Milk products", is_active=False)
        session.add(category)
        session.commit()

        agent = CategoryAgent(session)
        result = agent._query_category_by_name("Dairy")

        assert result is None

    def test_case_insensitive_match(self, session: Session, mock_settings, mock_anthropic):
        """Test that querying is case-insensitive."""
        category = Category(name="Dairy", description="Milk products")
        session.add(category)
        session.commit()
        session.refresh(category)

        agent = CategoryAgent(session)

        # Test various case variations
        result_lower = agent._query_category_by_name("dairy")
        assert result_lower is not None
        assert result_lower["id"] == category.id
        assert result_lower["name"] == "Dairy"
        assert result_lower["similarity"] == 1.0

        result_upper = agent._query_category_by_name("DAIRY")
        assert result_upper is not None
        assert result_upper["id"] == category.id
        assert result_upper["name"] == "Dairy"
        assert result_upper["similarity"] == 1.0

        result_mixed = agent._query_category_by_name("DaIrY")
        assert result_mixed is not None
        assert result_mixed["id"] == category.id
        assert result_mixed["name"] == "Dairy"
        assert result_mixed["similarity"] == 1.0


class TestAddCategory:
    """Tests for adding categories."""

    def test_add_new_category(self, session: Session, mock_settings, mock_anthropic):
        """Test adding a new category."""
        agent = CategoryAgent(session)
        result = agent._add_category("dairy", "Milk products")

        assert result["name"] == "Dairy"  # Title case
        assert result["description"] == "Milk products"
        assert result["already_existed"] is False
        assert result["id"] is not None

    def test_add_category_title_case(self, session: Session, mock_settings, mock_anthropic):
        """Test that category names are converted to title case."""
        agent = CategoryAgent(session)

        result = agent._add_category("SEAFOOD")
        assert result["name"] == "Seafood"

        result = agent._add_category("fresh vegetables")
        assert result["name"] == "Fresh Vegetables"

    def test_add_category_already_exists(self, session: Session, mock_settings, mock_anthropic):
        """Test adding a category that already exists."""
        # Create existing category
        category = Category(name="Dairy", description="Original")
        session.add(category)
        session.commit()

        agent = CategoryAgent(session)
        result = agent._add_category("dairy", "New description")

        assert result["name"] == "Dairy"
        assert result["already_existed"] is True

    def test_add_category_no_description(self, session: Session, mock_settings, mock_anthropic):
        """Test adding a category without description."""
        agent = CategoryAgent(session)
        result = agent._add_category("herbs")

        assert result["name"] == "Herbs"
        assert result["description"] is None
        assert result["already_existed"] is False


class TestProcessToolCall:
    """Tests for processing tool calls."""

    def test_process_query_category_found(self, session: Session, mock_settings, mock_anthropic):
        """Test processing query_category_by_name when found."""
        category = Category(name="Dairy", description="Milk products")
        session.add(category)
        session.commit()
        session.refresh(category)

        agent = CategoryAgent(session)
        result = agent._process_tool_call("query_category_by_name", {"name": "Dairy"})

        assert '"name": "Dairy"' in result
        assert agent._last_category_id == category.id
        assert agent._last_category_name == "Dairy"

    def test_process_query_category_not_found(self, session: Session, mock_settings, mock_anthropic):
        """Test processing query_category_by_name when not found."""
        agent = CategoryAgent(session)
        result = agent._process_tool_call("query_category_by_name", {"name": "Dairy"})

        assert result == "null"
        assert agent._last_category_id is None
        assert agent._last_category_name is None

    def test_process_add_category(self, session: Session, mock_settings, mock_anthropic):
        """Test processing add_category tool call."""
        agent = CategoryAgent(session)
        result = agent._process_tool_call(
            "add_category",
            {"name": "Dairy", "description": "Milk products"}
        )

        assert '"name": "Dairy"' in result
        assert '"already_existed": false' in result
        assert agent._last_category_id is not None
        assert agent._last_category_name == "Dairy"

    def test_process_unknown_tool(self, session: Session, mock_settings, mock_anthropic):
        """Test processing an unknown tool."""
        agent = CategoryAgent(session)
        result = agent._process_tool_call("unknown_tool", {})

        assert "error" in result
        assert "Unknown tool" in result


class TestCategorizeIngredient:
    """Tests for the main categorize_ingredient method."""

    @pytest.mark.asyncio
    async def test_categorize_with_existing_category(
        self, session: Session, mock_settings, mock_anthropic
    ):
        """Test categorizing when a matching category exists."""
        # Create existing category
        category = Category(name="Dairy", description="Milk products")
        session.add(category)
        session.commit()
        session.refresh(category)

        # Mock Claude responses
        mock_client = MagicMock()

        # First response: tool use to query category
        tool_use_response = MockClaudeResponse(
            content=[
                MockToolUseBlock("tool-1", "query_category_by_name", {"name": "Dairy"})
            ],
            stop_reason="tool_use"
        )

        # Second response: finalize categorization tool
        finalize_response = MockClaudeResponse(
            content=[
                MockToolUseBlock(
                    "tool-2",
                    "finalize_categorization",
                    {
                        "category_id": category.id,
                        "category_name": "Dairy",
                        "explanation": "Milk is a dairy product."
                    }
                )
            ],
            stop_reason="tool_use"
        )

        mock_client.messages.create.side_effect = [tool_use_response, finalize_response]
        mock_anthropic.return_value = mock_client

        agent = CategoryAgent(session)
        result = await agent.categorize_ingredient("Milk")

        assert result["category_id"] == category.id
        assert result["category_name"] == "Dairy"
        assert result["success"] is True
        assert result["explanation"]  # Ensure explanation is not empty

    @pytest.mark.asyncio
    async def test_categorize_creates_new_category(
        self, session: Session, mock_settings, mock_anthropic
    ):
        """Test categorizing when no matching category exists."""
        mock_client = MagicMock()

        # First response: tool use to query category (not found)
        query_response = MockClaudeResponse(
            content=[
                MockToolUseBlock("tool-1", "query_category_by_name", {"name": "Seafood"})
            ],
            stop_reason="tool_use"
        )

        # Second response: tool use to add category
        add_response = MockClaudeResponse(
            content=[
                MockToolUseBlock("tool-2", "add_category", {"name": "Seafood"})
            ],
            stop_reason="tool_use"
        )

        # Third response: finalize categorization tool
        finalize_response = MockClaudeResponse(
            content=[
                MockToolUseBlock(
                    "tool-3",
                    "finalize_categorization",
                    {
                        "category_id": 1,  # Placeholder, will be set by agent
                        "category_name": "Seafood",
                        "explanation": "Salmon is a seafood product."
                    }
                )
            ],
            stop_reason="tool_use"
        )

        mock_client.messages.create.side_effect = [query_response, add_response, finalize_response]
        mock_anthropic.return_value = mock_client

        agent = CategoryAgent(session)
        result = await agent.categorize_ingredient("Salmon")

        assert result["category_id"] is not None
        assert result["category_name"] == "Seafood"
        assert result["success"] is True

        # Verify category was created in database
        categories = list(session.exec(select(Category)).all())
        assert len(categories) == 1
        assert categories[0].name == "Seafood"
        assert result["category_id"] == categories[0].id


class TestCategorizeIngredientAPI:
    """Tests for the API endpoint."""

    def test_categorize_ingredient_endpoint(self, client, session: Session):
        """Test the /agents/categorize-ingredient endpoint."""
        # Create a category first
        category = Category(name="Dairy", description="Milk products")
        session.add(category)
        session.commit()
        session.refresh(category)

        with (
            patch("app.agents.base_agent.get_settings") as mock_settings,
            patch("app.agents.base_agent.anthropic.Anthropic") as mock_anthropic,
        ):
            settings = MagicMock()
            settings.anthropic_api_key = "test-key"
            mock_settings.return_value = settings

            mock_client = MagicMock()

            # Mock tool use then final response
            tool_response = MockClaudeResponse(
                content=[
                    MockToolUseBlock("tool-1", "query_category_by_name", {"name": "Dairy"})
                ],
                stop_reason="tool_use"
            )
            final_response = MockClaudeResponse(
                content=[MockContentBlock("Categorized as Dairy.")],
                stop_reason="end_turn"
            )
            mock_client.messages.create.side_effect = [tool_response, final_response]
            mock_anthropic.return_value = mock_client

            response = client.post(
                "/api/v1/agents/categorize-ingredient",
                json={"ingredient_name": "Cheese"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["category_id"] == category.id
            assert data["category_name"] == "Dairy"
            assert data["success"] is True

    def test_categorize_ingredient_no_api_key(self, client, agent_no_api_key):
        """Test endpoint fails gracefully without API key."""
        response = client.post(
            "/api/v1/agents/categorize-ingredient",
            json={"ingredient_name": "Cheese"}
        )

        assert response.status_code == 500
        assert "ANTHROPIC_API_KEY" in response.json()["detail"]
