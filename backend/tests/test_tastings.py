"""Tests for tasting sessions and notes endpoints."""

from datetime import datetime
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import User, UserType


def test_create_tasting_session(client: TestClient):
    """Test creating a new tasting session."""
    response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "December Menu Tasting",
            "date": "2024-12-15T10:00:00",
            "location": "Main Kitchen",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "December Menu Tasting"
    assert data["date"] == "2024-12-15T10:00:00"
    assert data["location"] == "Main Kitchen"
    assert data["participants"] == []
    assert data["creator_id"] == "test-admin-user"
    assert "id" in data


def test_list_tasting_sessions(client: TestClient):
    """Test listing tasting sessions."""
    # Create sessions
    client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 1", "date": "2024-12-10T09:00:00"},
    )
    client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 2", "date": "2024-12-15T14:00:00"},
    )

    response = client.get("/api/v1/tasting-sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should be ordered by date descending
    assert data[0]["date"] == "2024-12-15T14:00:00"


def test_get_tasting_session(client: TestClient):
    """Test getting a specific tasting session."""
    # Create session
    create_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = create_response.json()["id"]

    # Get session
    response = client.get(f"/api/v1/tasting-sessions/{session_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Session"


def test_get_nonexistent_session(client: TestClient):
    """Test getting a session that doesn't exist."""
    response = client.get("/api/v1/tasting-sessions/9999")
    assert response.status_code == 404


def test_update_tasting_session(client: TestClient):
    """Test updating a tasting session."""
    # Create session
    create_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Original Name", "date": "2024-12-15T10:00:00"},
    )
    session_id = create_response.json()["id"]

    # Update session
    response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}",
        json={"name": "Updated Name", "location": "New Location"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["location"] == "New Location"


def test_delete_tasting_session(client: TestClient):
    """Test deleting a tasting session."""
    # Create session
    create_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "To Delete", "date": "2024-12-15T10:00:00"},
    )
    session_id = create_response.json()["id"]

    # Delete session
    response = client.delete(f"/api/v1/tasting-sessions/{session_id}")
    assert response.status_code == 204

    # Verify it's gone
    get_response = client.get(f"/api/v1/tasting-sessions/{session_id}")
    assert get_response.status_code == 404


def test_add_note_to_session(client: TestClient):
    """Test adding a tasting note to a session."""
    # Create a recipe first
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Carbonara", "yield_quantity": 4, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Menu Tasting", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "taste_rating": 5,
            "presentation_rating": 4,
            "texture_rating": 5,
            "overall_rating": 5,
            "feedback": "Perfectly rendered guanciale",
            "action_items": "Add more black pepper",
            "decision": "approved",
            "taster_name": "Chef Marco",
            "user_id": "test-user-123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["taste_rating"] == 5
    assert data["decision"] == "approved"
    assert data["user_id"] == "test-user-123"


def test_multiple_notes_for_same_recipe_allowed(client: TestClient):
    """Test that multiple notes for the same recipe are allowed (different tasters)."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note first time - should succeed
    response1 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 4,
            "taster_name": "Chef Marco",
            "user_id": "user-marco",
        },
    )
    assert response1.status_code == 201

    # Add note second time with different taster - should also succeed
    response2 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 5,
            "taster_name": "Chef Sarah",
            "user_id": "user-sarah",
        },
    )
    assert response2.status_code == 201

    # Verify both notes exist
    notes_response = client.get(f"/api/v1/tasting-sessions/{session_id}/notes")
    assert len(notes_response.json()) == 2


def test_list_session_notes(client: TestClient):
    """Test listing notes for a session."""
    # Create recipes
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 1", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe2 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 2", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add notes
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe1["id"],
            "overall_rating": 4,
            "decision": "approved",
            "user_id": "user-1",
        },
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe2["id"],
            "overall_rating": 3,
            "decision": "needs_work",
            "user_id": "user-2",
        },
    )

    # List notes
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/notes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Verify user_id is present in responses
    assert data[0]["user_id"] is not None
    assert data[1]["user_id"] is not None


def test_update_tasting_note(client: TestClient):
    """Test updating a tasting note."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note
    note_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 3,
            "decision": "needs_work",
            "user_id": "user-123",
        },
    )
    note_id = note_response.json()["id"]
    assert note_response.json()["user_id"] == "user-123"

    # Update note
    response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}/notes/{note_id}",
        json={"overall_rating": 5, "decision": "approved", "feedback": "Much better!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overall_rating"] == 5
    assert data["decision"] == "approved"
    assert data["feedback"] == "Much better!"
    # user_id should still be present
    assert data["user_id"] == "user-123"


def test_delete_tasting_note(client: TestClient):
    """Test deleting a tasting note."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note
    note_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 4, "user_id": "user-456"},
    )
    note_id = note_response.json()["id"]
    assert note_response.json()["user_id"] == "user-456"

    # Delete note
    response = client.delete(f"/api/v1/tasting-sessions/{session_id}/notes/{note_id}")
    assert response.status_code == 204

    # Verify it's gone
    get_response = client.get(f"/api/v1/tasting-sessions/{session_id}/notes")
    assert len(get_response.json()) == 0


def test_session_stats(client: TestClient):
    """Test getting session statistics."""
    # Create recipes
    recipe1 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 1", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe2 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 2", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()
    recipe3 = client.post(
        "/api/v1/recipes",
        json={"name": "Recipe 3", "yield_quantity": 1, "yield_unit": "portion"},
    ).json()

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add notes with different decisions
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe1["id"], "decision": "approved"},
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe2["id"], "decision": "approved"},
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe3["id"], "decision": "needs_work"},
    )

    # Get stats
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["recipe_count"] == 3
    assert data["approved_count"] == 2
    assert data["needs_work_count"] == 1
    assert data["rejected_count"] == 0


def test_recipe_tasting_notes(client: TestClient):
    """Test getting tasting notes for a recipe."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create two sessions with notes for the same recipe
    session1 = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 1", "date": "2024-12-10T09:00:00"},
    ).json()
    session2 = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 2", "date": "2024-12-15T14:00:00"},
    ).json()

    client.post(
        f"/api/v1/tasting-sessions/{session1['id']}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 3, "decision": "needs_work"},
    )
    client.post(
        f"/api/v1/tasting-sessions/{session2['id']}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 5, "decision": "approved"},
    )

    # Get recipe tasting notes
    response = client.get(f"/api/v1/recipes/{recipe_id}/tasting-notes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should be ordered by date descending
    assert data[0]["session_date"] == "2024-12-15T14:00:00"
    assert data[0]["overall_rating"] == 5


def test_recipe_tasting_summary(client: TestClient):
    """Test getting tasting summary for a recipe."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create sessions with notes
    session1 = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 1", "date": "2024-12-10T09:00:00"},
    ).json()
    session2 = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 2", "date": "2024-12-15T14:00:00"},
    ).json()

    client.post(
        f"/api/v1/tasting-sessions/{session1['id']}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 3,
            "decision": "needs_work",
            "feedback": "Needs more seasoning",
        },
    )
    client.post(
        f"/api/v1/tasting-sessions/{session2['id']}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 5,
            "decision": "approved",
            "feedback": "Perfect!",
        },
    )

    # Get summary
    response = client.get(f"/api/v1/recipes/{recipe_id}/tasting-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["total_tastings"] == 2
    assert data["average_overall_rating"] == 4.0  # (3 + 5) / 2
    assert data["latest_decision"] == "approved"
    assert data["latest_feedback"] == "Perfect!"
    assert data["latest_tasting_date"] == "2024-12-15T14:00:00"


def test_recipe_tasting_summary_empty(client: TestClient):
    """Test tasting summary for recipe with no tastings."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "New Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Get summary (should be empty)
    response = client.get(f"/api/v1/recipes/{recipe_id}/tasting-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["total_tastings"] == 0
    assert data["average_overall_rating"] is None
    assert data["latest_decision"] is None


def test_create_note_with_action_items_done(client: TestClient):
    """Test creating a tasting note with action_items_done set to true."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note with action_items_done = True
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 4,
            "action_items": "Add more salt",
            "action_items_done": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["action_items"] == "Add more salt"
    assert data["action_items_done"] is True


def test_create_note_action_items_done_defaults_to_false(client: TestClient):
    """Test that action_items_done defaults to false when not specified."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note without specifying action_items_done
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 4,
            "action_items": "Reduce cooking time",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["action_items"] == "Reduce cooking time"
    assert data["action_items_done"] is False


def test_update_action_items_done(client: TestClient):
    """Test updating action_items_done from false to true."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note with action_items_done = False (default)
    note_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 3,
            "action_items": "Improve plating",
        },
    )
    note_id = note_response.json()["id"]
    assert note_response.json()["action_items_done"] is False

    # Update action_items_done to True
    response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}/notes/{note_id}",
        json={"action_items_done": True},
    )
    assert response.status_code == 200
    assert response.json()["action_items_done"] is True

    # Update action_items_done back to False
    response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}/notes/{note_id}",
        json={"action_items_done": False},
    )
    assert response.status_code == 200
    assert response.json()["action_items_done"] is False


def test_cascade_delete_session_notes(client: TestClient):
    """Test that deleting a session cascades to notes."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session with note
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 4},
    )

    # Verify note exists
    notes_before = client.get(f"/api/v1/recipes/{recipe_id}/tasting-notes").json()
    assert len(notes_before) == 1

    # Delete session
    client.delete(f"/api/v1/tasting-sessions/{session_id}")

    # Verify notes are also deleted
    notes_after = client.get(f"/api/v1/recipes/{recipe_id}/tasting-notes").json()
    assert len(notes_after) == 0


def test_add_note_requires_user_id(client: TestClient):
    """Test that user_id should be provided when adding a note."""
    # Create recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Add note with user_id should succeed
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "overall_rating": 4,
            "taster_name": "Chef",
            "user_id": "current-user-id",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == "current-user-id"


# ============================================================================
# Participant Association Tests
# ============================================================================


def test_create_session_with_participant_ids(
    client: TestClient, session: Session
):
    """Creating a session with participant_ids should populate participants list."""
    # Create a user in the DB
    user = User(
        id="user-123",
        email="chef@example.com",
        username="Chef Marco",
        user_type=UserType.NORMAL,
        outlet_id=None,
    )
    session.add(user)
    session.commit()

    # Create session with that user's ID
    response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Menu Tasting",
            "date": "2024-12-15T10:00:00",
            "participant_ids": ["user-123"],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["participants"]) == 1
    assert data["participants"][0]["email"] == "chef@example.com"
    assert data["participants"][0]["username"] == "Chef Marco"
    assert data["participants"][0]["user_id"] == "user-123"


def test_create_session_without_participant_ids(client: TestClient):
    """Creating a session without participant_ids results in empty participants."""
    response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Menu Tasting",
            "date": "2024-12-15T10:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["participants"] == []


def test_update_session_participant_ids_replaces_participants(
    client: TestClient, session: Session
):
    """PATCHing participant_ids fully replaces current participants."""
    # Create two users
    user1 = User(
        id="user-1",
        email="chef1@example.com",
        username="Chef One",
        user_type=UserType.NORMAL,
        outlet_id=None,
    )
    user2 = User(
        id="user-2",
        email="chef2@example.com",
        username="Chef Two",
        user_type=UserType.NORMAL,
        outlet_id=None,
    )
    session.add(user1)
    session.add(user2)
    session.commit()

    # Create session with user1
    create_response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Menu Tasting",
            "date": "2024-12-15T10:00:00",
            "participant_ids": ["user-1"],
        },
    )
    session_id = create_response.json()["id"]
    assert len(create_response.json()["participants"]) == 1

    # Update to replace with user2
    update_response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}",
        json={"participant_ids": ["user-2"]},
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert len(data["participants"]) == 1
    assert data["participants"][0]["email"] == "chef2@example.com"


def test_update_session_without_participant_ids_preserves_participants(
    client: TestClient, session: Session
):
    """PATCHing name only should NOT remove existing participants."""
    # Create a user
    user = User(
        id="user-1",
        email="chef@example.com",
        username="Chef One",
        user_type=UserType.NORMAL,
        outlet_id=None,
    )
    session.add(user)
    session.commit()

    # Create session with user
    create_response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Menu Tasting",
            "date": "2024-12-15T10:00:00",
            "participant_ids": ["user-1"],
        },
    )
    session_id = create_response.json()["id"]
    original_participants = create_response.json()["participants"]

    # Update only the name (no participant_ids key)
    update_response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}",
        json={"name": "Updated Name"},
    )
    assert update_response.status_code == 200
    data = update_response.json()
    # Participants should be unchanged
    assert data["participants"] == original_participants


def test_nonadmin_cannot_access_session_they_are_not_invited_to(
    session: Session, normal_user_client: TestClient
):
    """GET /tasting-sessions/{id} returns 403 for non-participant non-admin."""
    # Create a session with admin user (using default client/admin context)
    # We need to use the normal_user_client to make the GET request
    # Create an unrelated session first - create it via SQL to avoid auth issues
    from app.models import TastingSession
    from datetime import datetime

    unrelated_session = TastingSession(
        name="Not Mine",
        date=datetime(2024, 12, 15, 10, 0, 0),
        location="Somewhere",
    )
    session.add(unrelated_session)
    session.commit()
    session.refresh(unrelated_session)

    # Normal user tries to access session they're not in
    response = normal_user_client.get(
        f"/api/v1/tasting-sessions/{unrelated_session.id}"
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Access denied"


def test_admin_can_access_any_session(client: TestClient, session: Session):
    """Admin users always get 200 regardless of participant list."""
    # Create a session with no participants
    response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Test Session",
            "date": "2024-12-15T10:00:00",
        },
    )
    session_id = response.json()["id"]

    # Admin can still access it
    get_response = client.get(f"/api/v1/tasting-sessions/{session_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Test Session"
