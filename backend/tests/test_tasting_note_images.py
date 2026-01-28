"""Tests for tasting note images endpoints."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def sample_tasting_note(client_with_storage: TestClient):
    """Create a sample tasting note for testing."""
    # First create a recipe
    recipe_response = client_with_storage.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create a tasting session
    session_response = client_with_storage.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Test Session",
            "date": "2024-12-15T10:00:00",
        },
    )
    session_id = session_response.json()["id"]

    # Create a tasting note
    note_response = client_with_storage.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "taste_rating": 4,
            "feedback": "Good flavor",
        },
    )
    assert note_response.status_code == 201
    return note_response.json()


def test_sync_add_new_images(client_with_storage: TestClient, sample_tasting_note):
    """Test syncing to add multiple new images."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )

    assert response.status_code == 200
    images = response.json()
    assert len(images) == 3
    assert all(img["tasting_note_id"] == tasting_note_id for img in images)
    assert all(img["image_url"] is not None for img in images)
    assert all(img["id"] is not None for img in images)
    assert all("created_at" in img for img in images)
    assert all("updated_at" in img for img in images)


def test_sync_delete_images(client_with_storage: TestClient, sample_tasting_note):
    """Test syncing to delete multiple images."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # First, add three images
    add_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )
    assert add_response.status_code == 200
    images = add_response.json()
    assert len(images) == 3
    image_ids = [img["id"] for img in images]

    # Now delete two images
    delete_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": image_ids[0], "removed": True},
                {"id": image_ids[1], "removed": True},
                {"id": image_ids[2], "removed": False},
            ]
        },
    )
    assert delete_response.status_code == 200
    remaining_images = delete_response.json()
    assert len(remaining_images) == 1
    assert remaining_images[0]["id"] == image_ids[2]


def test_sync_add_and_delete(client_with_storage: TestClient, sample_tasting_note):
    """Test syncing to add new images and delete existing ones in one call."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add initial images
    add_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )
    images = add_response.json()
    image_ids = [img["id"] for img in images]

    # Now sync: delete one, keep one, add two new
    sync_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": image_ids[0], "removed": True},
                {"id": image_ids[1], "removed": False},
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )
    assert sync_response.status_code == 200
    result_images = sync_response.json()
    assert len(result_images) == 3
    # Should contain the kept image and two new ones
    assert image_ids[1] in [img["id"] for img in result_images]


def test_sync_keep_existing_images(client_with_storage: TestClient, sample_tasting_note):
    """Test syncing with only existing images (no additions or deletions)."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add initial images
    add_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )
    images = add_response.json()
    image_ids = [img["id"] for img in images]

    # Sync with same images, no changes
    sync_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": image_ids[0], "removed": False},
                {"id": image_ids[1], "removed": False},
            ]
        },
    )
    assert sync_response.status_code == 200
    result_images = sync_response.json()
    assert len(result_images) == 2
    assert set(img["id"] for img in result_images) == set(image_ids)


def test_sync_nonexistent_tasting_note(client_with_storage: TestClient):
    """Test syncing images for a non-existent tasting note."""
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client_with_storage.post(
        "/api/v1/tasting-note-images/sync/recipe/99999",
        json={
            "images": [
                {"id": None, "data": base64_image},
            ]
        },
    )

    assert response.status_code == 404
    assert "Tasting note not found" in response.json()["detail"]


def test_sync_empty_images(client_with_storage: TestClient, sample_tasting_note):
    """Test syncing with no images."""
    tasting_note_id = sample_tasting_note["id"]

    response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={"images": []},
    )

    assert response.status_code == 200
    images = response.json()
    assert images == []


def test_get_tasting_note_images(client_with_storage: TestClient, sample_tasting_note):
    """Test retrieving all images for a tasting note."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add multiple images using sync
    client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )

    # Get all images
    response = client_with_storage.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    assert response.status_code == 200
    images = response.json()
    assert len(images) == 3


def test_delete_tasting_note_image(client_with_storage: TestClient, sample_tasting_note):
    """Test deleting a single tasting note image."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add two images
    add_response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/recipe/{tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )
    images = add_response.json()
    image1_id = images[0]["id"]
    image2_id = images[1]["id"]

    # Delete first image
    delete_response = client_with_storage.delete(f"/api/v1/tasting-note-images/{image1_id}")
    assert delete_response.status_code == 204

    # Verify image is deleted
    images_response = client_with_storage.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    remaining_images = images_response.json()
    assert len(remaining_images) == 1
    assert remaining_images[0]["id"] == image2_id


def test_delete_nonexistent_tasting_note_image(client_with_storage: TestClient):
    """Test deleting a non-existent image."""
    response = client_with_storage.delete("/api/v1/tasting-note-images/99999")
    assert response.status_code == 404
    assert "Image not found" in response.json()["detail"]


def test_get_images_for_nonexistent_tasting_note(client_with_storage: TestClient):
    """Test getting images for a non-existent tasting note returns empty list."""
    response = client_with_storage.get("/api/v1/tasting-note-images/99999")
    assert response.status_code == 200
    images = response.json()
    assert images == []


# ========== Ingredient Tasting Note Images Tests ==========


@pytest.fixture
def sample_ingredient_tasting_note(client_with_storage: TestClient):
    """Create a sample ingredient tasting note for testing."""
    # First create an ingredient
    ingredient_response = client_with_storage.post(
        "/api/v1/ingredients",
        json={"name": "Test Ingredient", "base_unit": "kg"},
    )
    ingredient_id = ingredient_response.json()["id"]

    # Create a tasting session
    session_response = client_with_storage.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Test Session",
            "date": "2024-12-15T10:00:00",
        },
    )
    session_id = session_response.json()["id"]

    # Create an ingredient tasting note
    note_response = client_with_storage.post(
        f"/api/v1/tasting-sessions/{session_id}/ingredient-notes",
        json={
            "ingredient_id": ingredient_id,
            "taste_rating": 4,
            "feedback": "Good flavor",
        },
    )
    assert note_response.status_code == 201
    return note_response.json()


def test_sync_add_new_ingredient_images(client_with_storage: TestClient, sample_ingredient_tasting_note):
    """Test syncing to add multiple new images for ingredient tasting note."""
    ingredient_tasting_note_id = sample_ingredient_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/ingredient/{ingredient_tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )

    assert response.status_code == 200
    images = response.json()
    assert len(images) == 2
    assert all(img["ingredient_tasting_note_id"] == ingredient_tasting_note_id for img in images)
    assert all(img["image_url"] is not None for img in images)
    assert all(img["id"] is not None for img in images)


def test_get_ingredient_tasting_note_images(client_with_storage: TestClient, sample_ingredient_tasting_note):
    """Test retrieving all images for an ingredient tasting note."""
    ingredient_tasting_note_id = sample_ingredient_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add multiple images using sync
    client_with_storage.post(
        f"/api/v1/tasting-note-images/sync/ingredient/{ingredient_tasting_note_id}",
        json={
            "images": [
                {"id": None, "data": base64_image},
                {"id": None, "data": base64_image},
            ]
        },
    )

    # Get all images
    response = client_with_storage.get(f"/api/v1/tasting-note-images/ingredient/{ingredient_tasting_note_id}")
    assert response.status_code == 200
    images = response.json()
    assert len(images) == 2


def test_sync_ingredient_images_nonexistent(client_with_storage: TestClient):
    """Test syncing images for a non-existent ingredient tasting note."""
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client_with_storage.post(
        "/api/v1/tasting-note-images/sync/ingredient/99999",
        json={
            "images": [
                {"id": None, "data": base64_image},
            ]
        },
    )

    assert response.status_code == 404
    assert "Ingredient tasting note not found" in response.json()["detail"]
