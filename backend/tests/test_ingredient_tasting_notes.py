"""Tests for ingredient tasting notes endpoints."""

from datetime import datetime
from fastapi.testclient import TestClient


def test_create_ingredient_tasting_note(client: TestClient):
    """Test creating an ingredient tasting note."""
    # Create ingredient and session
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Olive Oil", "base_unit": "ml"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Ingredient Tasting", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Create ingredient tasting note
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 4,
            "aroma_rating": 5,
            "texture_rating": 4,
            "overall_rating": 4,
            "feedback": "Fresh and high quality",
            "decision": "approved",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["ingredient_id"] == ingredient_id
    assert data["session_id"] == session_id
    assert data["taste_rating"] == 4
    assert data["aroma_rating"] == 5
    assert data["overall_rating"] == 4
    assert data["decision"] == "approved"
    assert "id" in data


def test_create_note_for_nonexistent_ingredient(client: TestClient):
    """Test creating a note for an ingredient that doesn't exist."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": 9999,
            "taste_rating": 5,
            "overall_rating": 5,
        },
    )
    assert response.status_code == 400


def test_create_note_for_nonexistent_session(client: TestClient):
    """Test creating a note for a session that doesn't exist."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    response = client.post(
        "/api/v1/tasting-sessions/9999/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 5,
            "overall_rating": 5,
        },
    )
    assert response.status_code == 400


def test_get_session_ingredient_notes(client: TestClient):
    """Test getting ingredient notes for a tasting session."""
    # Create ingredients and session
    ingredient1 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 1", "base_unit": "g"},
    ).json()
    ingredient2 = client.post(
        "/api/v1/ingredients",
        json={"name": "Ingredient 2", "base_unit": "ml"},
    ).json()

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Ingredient Tasting", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Create notes for both ingredients
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient1["id"],
            "taste_rating": 4,
            "overall_rating": 4,
            "feedback": "Good",
        },
    )
    client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient2["id"],
            "taste_rating": 5,
            "overall_rating": 5,
            "feedback": "Excellent",
        },
    )

    # Get session notes
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredient-notes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_session_ingredient_notes_empty(client: TestClient):
    """Test getting ingredient notes from a session with no notes."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Empty Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredient-notes")
    assert response.status_code == 200
    assert response.json() == []


def test_get_single_ingredient_note(client: TestClient):
    """Test getting a single ingredient tasting note."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "kg"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Create note
    create_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 4,
            "overall_rating": 4,
            "feedback": "Test feedback",
        },
    )
    note_id = create_response.json()["id"]

    # Get single note
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredient-notes/{note_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == note_id
    assert data["ingredient_id"] == ingredient_id
    assert data["feedback"] == "Test feedback"


def test_get_nonexistent_note(client: TestClient):
    """Test getting a note that doesn't exist."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredient-notes/9999")
    assert response.status_code == 404


def test_update_ingredient_tasting_note(client: TestClient):
    """Test updating an ingredient tasting note."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Create note
    create_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 3,
            "overall_rating": 3,
            "feedback": "Initial feedback",
        },
    )
    note_id = create_response.json()["id"]

    # Update note
    response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes/{note_id}",
        json={
            "taste_rating": 5,
            "overall_rating": 5,
            "feedback": "Updated feedback",
            "decision": "approved",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["taste_rating"] == 5
    assert data["overall_rating"] == 5
    assert data["feedback"] == "Updated feedback"
    assert data["decision"] == "approved"


def test_update_nonexistent_note(client: TestClient):
    """Test updating a note that doesn't exist."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    response = client.patch(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes/9999",
        json={"taste_rating": 5},
    )
    assert response.status_code == 404


def test_delete_ingredient_tasting_note(client: TestClient):
    """Test deleting an ingredient tasting note."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "ml"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Create note
    create_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 4,
            "overall_rating": 4,
        },
    )
    note_id = create_response.json()["id"]

    # Delete note
    response = client.delete(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes/{note_id}"
    )
    assert response.status_code == 204


def test_delete_nonexistent_note(client: TestClient):
    """Test deleting a note that doesn't exist."""
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    response = client.delete(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes/9999"
    )
    assert response.status_code == 404


def test_rating_validations(client: TestClient):
    """Test that rating values outside 1-5 range are rejected."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Try with rating > 5
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 6,
            "overall_rating": 4,
        },
    )
    assert response.status_code == 422  # Validation error

    # Try with rating < 1
    response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 0,
            "overall_rating": 4,
        },
    )
    assert response.status_code == 422  # Validation error


def test_decision_enum_validation(client: TestClient):
    """Test that decision field accepts only valid enum values."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # Valid decision values should work
    for decision in ["approved", "needs_work", "rejected"]:
        response = client.post(
            f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
            json={
                "ingredient_id": ingredient_id,
                "overall_rating": 4,
                "decision": decision,
            },
        )
        assert response.status_code == 201


def test_multiple_tasters_per_ingredient(client: TestClient):
    """Test that multiple tasters can provide feedback for the same ingredient in one session."""
    ingredient_response = client.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "g"},
    )
    ingredient_id = ingredient_response.json()["id"]

    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={"name": "Test Session", "date": "2024-12-15T10:00:00"},
    )
    session_id = session_response.json()["id"]

    # First taster
    response1 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 4,
            "overall_rating": 4,
            "taster_name": "Chef Marco",
            "feedback": "Good quality",
        },
    )
    assert response1.status_code == 201

    # Second taster for same ingredient
    response2 = client.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 5,
            "overall_rating": 5,
            "taster_name": "Sarah",
            "feedback": "Excellent quality",
        },
    )
    assert response2.status_code == 201

    # Both notes should exist
    response = client.get(f"/api/v1/tasting-sessions/{session_id}/ingredient-notes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
