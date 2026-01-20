"""Tests for the Feedback Summary Agent."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session

from app.agents.feedback_summary_agent import FeedbackSummaryAgent
from app.models.tasting import TastingNote, TastingSession
from app.models.recipe import Recipe

# Import mock classes from conftest
from tests.conftest import MockContentBlock, MockToolUseBlock, MockClaudeResponse


class TestFeedbackSummaryAgentInit:
    """Tests for FeedbackSummaryAgent initialization."""

    def test_init_success(self, session: Session, mock_settings, mock_anthropic):
        """Test successful agent initialization."""
        agent = FeedbackSummaryAgent(session)
        assert agent.session == session
        assert agent._last_summary is None

    def test_init_no_api_key(self, session: Session, agent_no_api_key):
        """Test initialization fails without API key."""
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY is not configured"):
            FeedbackSummaryAgent(session)


class TestRetrieveFeedback:
    """Tests for retrieving feedback from tasting notes."""

    def test_retrieve_feedback_success(self, session: Session, mock_settings, mock_anthropic):
        """Test successfully retrieving feedback for a recipe."""
        # Create recipe
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        # Create tasting session
        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        # Create tasting notes with feedback
        note1 = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            feedback="Great flavor!",
            taster_name="Chef A"
        )
        note2 = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            feedback="Needs more salt",
            taster_name="Chef B"
        )
        session.add(note1)
        session.add(note2)
        session.commit()

        agent = FeedbackSummaryAgent(session)
        feedback_list = agent._retrieve_feedback(recipe.id)

        assert len(feedback_list) == 2
        assert "Great flavor!" in feedback_list
        assert "Needs more salt" in feedback_list

    def test_retrieve_feedback_no_feedback(self, session: Session, mock_settings, mock_anthropic):
        """Test retrieving feedback when no notes have feedback text."""
        # Create recipe
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        # Create tasting session
        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        # Create tasting note without feedback
        note = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            taste_rating=5,
            taster_name="Chef A"
        )
        session.add(note)
        session.commit()

        agent = FeedbackSummaryAgent(session)

        with pytest.raises(ValueError, match=f"No feedback found for recipe {recipe.id}"):
            agent._retrieve_feedback(recipe.id)

    def test_retrieve_feedback_empty_recipe(self, session: Session, mock_settings, mock_anthropic):
        """Test retrieving feedback for recipe with no tasting notes."""
        # Create recipe with no notes
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        agent = FeedbackSummaryAgent(session)

        with pytest.raises(ValueError, match=f"No feedback found for recipe {recipe.id}"):
            agent._retrieve_feedback(recipe.id)

    def test_retrieve_feedback_mixed_notes(self, session: Session, mock_settings, mock_anthropic):
        """Test retrieving feedback with mix of notes with and without feedback."""
        # Create recipe
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        # Create tasting session
        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        # Create notes: one with feedback, one without
        note1 = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            feedback="Excellent!",
            taster_name="Chef A"
        )
        note2 = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            taste_rating=5,
            taster_name="Chef B"
        )
        session.add(note1)
        session.add(note2)
        session.commit()

        agent = FeedbackSummaryAgent(session)
        feedback_list = agent._retrieve_feedback(recipe.id)

        assert len(feedback_list) == 1
        assert feedback_list[0] == "Excellent!"


class TestProcessToolCall:
    """Tests for processing tool calls."""

    def test_process_retrieve_feedback_tool(self, session: Session, mock_settings, mock_anthropic):
        """Test processing retrieve_feedback tool call."""
        # Create test data
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        note = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            feedback="Good taste",
            taster_name="Chef A"
        )
        session.add(note)
        session.commit()

        agent = FeedbackSummaryAgent(session)
        result = agent._process_tool_call("retrieve_feedback", {"recipe_id": recipe.id})

        assert '"feedback_count": 1' in result
        assert '"Good taste"' in result

    def test_process_finalize_summary_tool(self, session: Session, mock_settings, mock_anthropic):
        """Test processing finalize_summary tool call."""
        agent = FeedbackSummaryAgent(session)
        summary_text = "This is the final summary"
        result = agent._process_tool_call(
            "finalize_summary",
            {"summary": summary_text}
        )

        assert agent._last_summary == summary_text
        assert '"status": "finalized"' in result

    def test_process_unknown_tool(self, session: Session, mock_settings, mock_anthropic):
        """Test processing an unknown tool."""
        agent = FeedbackSummaryAgent(session)
        result = agent._process_tool_call("unknown_tool", {})

        assert "error" in result
        assert "Unknown tool" in result


class TestSummarizeFeedback:
    """Tests for the main summarize_feedback method."""

    @pytest.mark.asyncio
    async def test_summarize_feedback_success(
        self, session: Session, mock_settings, mock_anthropic
    ):
        """Test successful feedback summarization."""
        # Create test data
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        note = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            feedback="Great flavor",
            taster_name="Chef A"
        )
        session.add(note)
        session.commit()

        # Mock Claude responses
        mock_client = MagicMock()

        # First response: tool use to retrieve feedback
        retrieve_response = MockClaudeResponse(
            content=[
                MockToolUseBlock("tool-1", "retrieve_feedback", {"recipe_id": recipe.id})
            ],
            stop_reason="tool_use"
        )

        # Second response: tool use to finalize summary
        finalize_response = MockClaudeResponse(
            content=[
                MockToolUseBlock(
                    "tool-2",
                    "finalize_summary",
                    {"summary": "The recipe received excellent feedback for flavor."}
                )
            ],
            stop_reason="tool_use"
        )

        mock_client.messages.create.side_effect = [retrieve_response, finalize_response]
        mock_anthropic.return_value = mock_client

        agent = FeedbackSummaryAgent(session)
        result = await agent.summarize_feedback(recipe.id)

        assert result["success"] is True
        assert result["summary"] == "The recipe received excellent feedback for flavor."

    @pytest.mark.asyncio
    async def test_summarize_feedback_no_feedback(
        self, session: Session, mock_settings, mock_anthropic
    ):
        """Test summarization fails gracefully when no feedback exists."""
        # Create recipe with no feedback
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        # Mock Claude response - will trigger retrieve_feedback which will raise ValueError
        mock_client = MagicMock()
        retrieve_response = MockClaudeResponse(
            content=[
                MockToolUseBlock("tool-1", "retrieve_feedback", {"recipe_id": recipe.id})
            ],
            stop_reason="tool_use"
        )
        mock_client.messages.create.return_value = retrieve_response
        mock_anthropic.return_value = mock_client

        agent = FeedbackSummaryAgent(session)
        result = await agent.summarize_feedback(recipe.id)

        assert result["success"] is False
        assert result["summary"] is None

    @pytest.mark.asyncio
    async def test_summarize_feedback_multiple_feedbacks(
        self, session: Session, mock_settings, mock_anthropic
    ):
        """Test summarization with multiple feedback entries."""
        # Create recipe and multiple feedback notes
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        feedbacks = [
            "Excellent flavor profile",
            "Texture needs improvement",
            "Presentation is perfect",
        ]

        for idx, feedback in enumerate(feedbacks):
            note = TastingNote(
                session_id=tasting_session.id,
                recipe_id=recipe.id,
                feedback=feedback,
                taster_name=f"Chef {idx}"
            )
            session.add(note)

        session.commit()

        # Mock Claude responses
        mock_client = MagicMock()

        retrieve_response = MockClaudeResponse(
            content=[
                MockToolUseBlock("tool-1", "retrieve_feedback", {"recipe_id": recipe.id})
            ],
            stop_reason="tool_use"
        )

        finalize_response = MockClaudeResponse(
            content=[
                MockToolUseBlock(
                    "tool-2",
                    "finalize_summary",
                    {
                        "summary": "Mixed feedback: Great flavor and presentation, but texture needs work. "
                        "Overall good foundation with room for refinement."
                    }
                )
            ],
            stop_reason="tool_use"
        )

        mock_client.messages.create.side_effect = [retrieve_response, finalize_response]
        mock_anthropic.return_value = mock_client

        agent = FeedbackSummaryAgent(session)
        result = await agent.summarize_feedback(recipe.id)

        assert result["success"] is True
        assert "Mixed feedback" in result["summary"]


class TestSummarizeFeedbackAPI:
    """Tests for the API endpoint."""

    def test_summarize_feedback_endpoint_success(self, client, session: Session):
        """Test the /agents/summarize-feedback/{recipe_id} endpoint with success."""
        # Create test data
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        tasting_session = TastingSession(name="Test Session", date=datetime(2024, 1, 1))
        session.add(tasting_session)
        session.commit()
        session.refresh(tasting_session)

        note = TastingNote(
            session_id=tasting_session.id,
            recipe_id=recipe.id,
            feedback="Delicious!",
            taster_name="Chef A"
        )
        session.add(note)
        session.commit()

        with (
            patch("app.agents.base_agent.get_settings") as mock_settings,
            patch("app.agents.base_agent.anthropic.Anthropic") as mock_anthropic,
        ):
            settings = MagicMock()
            settings.anthropic_api_key = "test-key"
            mock_settings.return_value = settings

            mock_client = MagicMock()

            # Mock tool use then finalize response
            retrieve_response = MockClaudeResponse(
                content=[
                    MockToolUseBlock("tool-1", "retrieve_feedback", {"recipe_id": recipe.id})
                ],
                stop_reason="tool_use"
            )
            finalize_response = MockClaudeResponse(
                content=[
                    MockToolUseBlock(
                        "tool-2",
                        "finalize_summary",
                        {"summary": "Recipe is delicious and well-received."}
                    )
                ],
                stop_reason="tool_use"
            )
            mock_client.messages.create.side_effect = [retrieve_response, finalize_response]
            mock_anthropic.return_value = mock_client

            response = client.post(f"/api/v1/agents/summarize-feedback/{recipe.id}")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["summary"] == "Recipe is delicious and well-received."

    def test_summarize_feedback_endpoint_no_feedback(self, client, session: Session):
        """Test endpoint returns error when recipe has no feedback."""
        # Create recipe with no feedback
        recipe = Recipe(name="Test Recipe", is_public=True)
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        with (
            patch("app.agents.base_agent.get_settings") as mock_settings,
            patch("app.agents.base_agent.anthropic.Anthropic") as mock_anthropic,
        ):
            settings = MagicMock()
            settings.anthropic_api_key = "test-key"
            mock_settings.return_value = settings

            mock_client = MagicMock()
            retrieve_response = MockClaudeResponse(
                content=[
                    MockToolUseBlock("tool-1", "retrieve_feedback", {"recipe_id": recipe.id})
                ],
                stop_reason="tool_use"
            )
            mock_client.messages.create.return_value = retrieve_response
            mock_anthropic.return_value = mock_client

            response = client.post(f"/api/v1/agents/summarize-feedback/{recipe.id}")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert data["summary"] is None

    def test_summarize_feedback_endpoint_no_api_key(self, client, agent_no_api_key):
        """Test endpoint fails gracefully without API key."""
        recipe_id = 999

        response = client.post(f"/api/v1/agents/summarize-feedback/{recipe_id}")

        assert response.status_code == 500
        assert "ANTHROPIC_API_KEY" in response.json()["detail"]

    def test_summarize_feedback_endpoint_path_parameter(self, client):
        """Test endpoint correctly handles path parameter recipe_id."""
        recipe_id = 12345

        with (
            patch("app.agents.base_agent.get_settings") as mock_settings,
            patch("app.agents.base_agent.anthropic.Anthropic") as mock_anthropic,
        ):
            settings = MagicMock()
            settings.anthropic_api_key = "test-key"
            mock_settings.return_value = settings

            mock_client = MagicMock()
            retrieve_response = MockClaudeResponse(
                content=[
                    MockToolUseBlock("tool-1", "retrieve_feedback", {"recipe_id": recipe_id})
                ],
                stop_reason="tool_use"
            )
            mock_client.messages.create.return_value = retrieve_response
            mock_anthropic.return_value = mock_client

            response = client.post(f"/api/v1/agents/summarize-feedback/{recipe_id}")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert data["summary"] is None
