"""Tests for tasting sessions and notes endpoints."""

from datetime import date
from fastapi.testclient import TestClient


def test_create_tasting_session(client: TestClient):
    """Test creating a new tasting session."""
    response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "December Menu Tasting",
            "date": "2024-12-15",
            "location": "Main Kitchen",
            "attendees": ["Chef Marco", "Sarah", "James"],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "December Menu Tasting"
    assert data["date"] == "2024-12-15"
    assert data["location"] == "Main Kitchen"
    assert data["attendees"] == ["Chef Marco", "Sarah", "James"]
    assert "id" in data


def test_list_tasting_sessions(client: TestClient):
    """Test listing tasting sessions."""
    # Create sessions
    client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 1", "date": "2024-12-10"},
    )
    client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 2", "date": "2024-12-15"},
    )

    response = client.get("/api/v1/tasting-sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Should be ordered by date descending
    assert data[0]["date"] == "2024-12-15"


def test_get_tasting_session(client: TestClient):
    """Test getting a specific tasting session."""
    # Create session
    create_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15"},
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
        json={"name": "Original Name", "date": "2024-12-15"},
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
        json={"name": "To Delete", "date": "2024-12-15"},
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
        json={"name": "Menu Tasting", "date": "2024-12-15"},
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
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["taste_rating"] == 5
    assert data["decision"] == "approved"


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
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add note first time - should succeed
    response1 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 4, "taster_name": "Chef Marco"},
    )
    assert response1.status_code == 201

    # Add note second time with different taster - should also succeed
    response2 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 5, "taster_name": "Chef Sarah"},
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
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add notes
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe1["id"], "overall_rating": 4, "decision": "approved"},
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe2["id"], "overall_rating": 3, "decision": "needs_work"},
    )

    # List notes
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/notes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


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
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add note
    note_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 3, "decision": "needs_work"},
    )
    note_id = note_response.json()["id"]

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
        json={"name": "Test Session", "date": "2024-12-15"},
    )
    session_id = session_response.json()["id"]

    # Add note
    note_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={"recipe_id": recipe_id, "overall_rating": 4},
    )
    note_id = note_response.json()["id"]

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
        json={"name": "Test Session", "date": "2024-12-15"},
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
        json={"name": "Session 1", "date": "2024-12-10"},
    ).json()
    session2 = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 2", "date": "2024-12-15"},
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
    assert data[0]["session_date"] == "2024-12-15"
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
        json={"name": "Session 1", "date": "2024-12-10"},
    ).json()
    session2 = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Session 2", "date": "2024-12-15"},
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
    assert data["latest_tasting_date"] == "2024-12-15"


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
        json={"name": "Test Session", "date": "2024-12-15"},
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
        json={"name": "Test Session", "date": "2024-12-15"},
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
        json={"name": "Test Session", "date": "2024-12-15"},
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
        json={"name": "Test Session", "date": "2024-12-15"},
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
