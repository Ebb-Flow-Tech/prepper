"""Tests for tasting note images endpoints."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def sample_tasting_note(client: TestClient):
    """Create a sample tasting note for testing."""
    # First create a recipe
    recipe_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = recipe_response.json()["id"]

    # Create a tasting session
    session_response = client.post(
        "/api/v1/tasting-sessions",
        json={
            "name": "Test Session",
            "date": "2024-12-15T10:00:00",
        },
    )
    session_id = session_response.json()["id"]

    # Create a tasting note
    note_response = client.post(
        f"/api/v1/tasting-sessions/{session_id}/notes",
        json={
            "recipe_id": recipe_id,
            "taste_rating": 4,
            "feedback": "Good flavor",
        },
    )
    assert note_response.status_code == 201
    return note_response.json()


def test_add_image_to_tasting_note(client: TestClient, sample_tasting_note):
    """Test adding an image to a tasting note."""
    tasting_note_id = sample_tasting_note["id"]
    image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": image_base64},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["tasting_note_id"] == tasting_note_id
    assert data["image_url"] is not None
    assert data["id"] is not None


def test_add_multiple_images_to_tasting_note(client: TestClient, sample_tasting_note):
    """Test adding multiple images to a tasting note."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add first image
    response1 = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": base64_image},
    )
    assert response1.status_code == 201
    image1 = response1.json()
    assert image1["id"] is not None

    # Add second image
    response2 = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": base64_image},
    )
    assert response2.status_code == 201
    image2 = response2.json()
    assert image2["id"] is not None
    assert image1["id"] != image2["id"]

    # Add third image
    response3 = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": base64_image},
    )
    assert response3.status_code == 201
    image3 = response3.json()
    assert image3["id"] is not None


def test_get_tasting_note_images(client: TestClient, sample_tasting_note):
    """Test retrieving all images for a tasting note."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add multiple images
    for _ in range(3):
        client.post(
            f"/api/v1/tasting-note-images/{tasting_note_id}",
            json={"image_base64": base64_image},
        )

    # Get all images
    response = client.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    assert response.status_code == 200
    images = response.json()
    assert len(images) == 3


def test_delete_tasting_note_image(client: TestClient, sample_tasting_note):
    """Test deleting a tasting note image."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add two images
    response1 = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": base64_image},
    )
    image1_id = response1.json()["id"]

    response2 = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": base64_image},
    )
    image2_id = response2.json()["id"]

    # Delete first image
    delete_response = client.delete(f"/api/v1/tasting-note-images/{image1_id}")
    assert delete_response.status_code == 204

    # Verify image is deleted
    images_response = client.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    images = images_response.json()
    assert len(images) == 1
    assert images[0]["id"] == image2_id


def test_delete_nonexistent_tasting_note_image(client: TestClient):
    """Test deleting a non-existent image."""
    response = client.delete("/api/v1/tasting-note-images/99999")
    assert response.status_code == 404
    assert "Image not found" in response.json()["detail"]


def test_add_image_to_nonexistent_tasting_note(client: TestClient):
    """Test adding an image to a non-existent tasting note."""
    image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        "/api/v1/tasting-note-images/99999",
        json={"image_base64": image_base64},
    )

    assert response.status_code == 404
    assert "Tasting note not found" in response.json()["detail"]


def test_get_images_for_nonexistent_tasting_note(client: TestClient):
    """Test getting images for a non-existent tasting note returns empty list."""
    response = client.get("/api/v1/tasting-note-images/99999")
    assert response.status_code == 200
    images = response.json()
    assert images == []


def test_add_image_missing_base64(client: TestClient, sample_tasting_note):
    """Test adding an image without image_base64 returns validation error."""
    tasting_note_id = sample_tasting_note["id"]

    response = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={},
    )

    assert response.status_code == 422  # Pydantic validation error


def test_tasting_note_image_has_timestamps(client: TestClient, sample_tasting_note):
    """Test that tasting note images have created_at and updated_at timestamps."""
    tasting_note_id = sample_tasting_note["id"]
    image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        f"/api/v1/tasting-note-images/{tasting_note_id}",
        json={"image_base64": image_base64},
    )

    assert response.status_code == 201
    data = response.json()
    assert "created_at" in data
    assert "updated_at" in data


def test_delete_multiple_images(client: TestClient, sample_tasting_note):
    """Test deleting multiple images from a tasting note."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add three images
    image_ids = []
    for i in range(3):
        response = client.post(
            f"/api/v1/tasting-note-images/{tasting_note_id}",
            json={"image_base64": base64_image},
        )
        image_ids.append(response.json()["id"])

    # Verify all three exist
    get_response = client.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    assert len(get_response.json()) == 3

    # Delete first image
    client.delete(f"/api/v1/tasting-note-images/{image_ids[0]}")
    get_response = client.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    assert len(get_response.json()) == 2

    # Delete second image
    client.delete(f"/api/v1/tasting-note-images/{image_ids[1]}")
    get_response = client.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    assert len(get_response.json()) == 1

    # Delete third image
    client.delete(f"/api/v1/tasting-note-images/{image_ids[2]}")
    get_response = client.get(f"/api/v1/tasting-note-images/{tasting_note_id}")
    assert len(get_response.json()) == 0


def test_add_multiple_images_batch(client: TestClient, sample_tasting_note):
    """Test adding multiple images in a single batch request."""
    tasting_note_id = sample_tasting_note["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        f"/api/v1/tasting-note-images/batch/{tasting_note_id}",
        json={
            "images": [base64_image, base64_image, base64_image]
        },
    )

    assert response.status_code == 201
    images = response.json()
    assert len(images) == 3
    assert all("tasting_note_id" in img for img in images)
    assert all("image_url" in img for img in images)
    assert all("id" in img for img in images)


def test_add_multiple_images_batch_nonexistent_note(client: TestClient):
    """Test adding multiple images to a non-existent tasting note."""
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        "/api/v1/tasting-note-images/batch/99999",
        json={
            "images": [base64_image, base64_image]
        },
    )

    assert response.status_code == 404
    assert "Tasting note not found" in response.json()["detail"]


def test_add_empty_batch(client: TestClient, sample_tasting_note):
    """Test adding an empty batch of images."""
    tasting_note_id = sample_tasting_note["id"]

    response = client.post(
        f"/api/v1/tasting-note-images/batch/{tasting_note_id}",
        json={"images": []},
    )

    assert response.status_code == 201
    images = response.json()
    assert images == []


def test_batch_upload_different_images(client: TestClient, sample_tasting_note):
    """Test batch upload with different base64 images."""
    tasting_note_id = sample_tasting_note["id"]
    # Two different valid base64 PNG images
    image1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    image2 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        f"/api/v1/tasting-note-images/batch/{tasting_note_id}",
        json={"images": [image1, image2]},
    )

    assert response.status_code == 201
    images = response.json()
    assert len(images) == 2
    # Each image should have a unique ID
    assert images[0]["id"] != images[1]["id"]
    # Both should belong to the same tasting note
    assert images[0]["tasting_note_id"] == tasting_note_id
    assert images[1]["tasting_note_id"] == tasting_note_id
