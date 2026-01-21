"""Tests for recipe image endpoints."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def sample_recipe(client: TestClient):
    """Create a sample recipe for testing."""
    response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    assert response.status_code == 201
    return response.json()


def test_add_image_to_recipe(client: TestClient, sample_recipe):
    """Test adding an image to a recipe."""
    recipe_id = sample_recipe["id"]
    image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": image_base64},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["image_url"] is not None  # Should have generated URL from upload
    assert data["is_main"] is True  # First image should be main
    assert data["order"] == 0
    assert data["id"] is not None


def test_add_multiple_images(client: TestClient, sample_recipe):
    """Test adding multiple images to a recipe."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add first image
    response1 = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )
    assert response1.status_code == 201
    image1 = response1.json()
    assert image1["is_main"] is True
    assert image1["order"] == 0
    assert image1["id"] is not None

    # Add second image
    response2 = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )
    assert response2.status_code == 201
    image2 = response2.json()
    assert image2["is_main"] is False  # Second image should not be main
    assert image2["order"] == 1
    assert image2["id"] is not None

    # Add third image
    response3 = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )
    assert response3.status_code == 201
    image3 = response3.json()
    assert image3["is_main"] is False
    assert image3["order"] == 2
    assert image3["id"] is not None


def test_get_recipe_images(client: TestClient, sample_recipe):
    """Test retrieving all images for a recipe."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add multiple images
    for _ in range(3):
        client.post(
            f"/api/v1/recipe-images/{recipe_id}",
            json={"image_base64": base64_image},
        )

    # Get all images
    response = client.get(f"/api/v1/recipe-images/{recipe_id}")
    assert response.status_code == 200
    images = response.json()
    assert len(images) == 3
    assert images[0]["order"] == 0
    assert images[1]["order"] == 1
    assert images[2]["order"] == 2


def test_delete_recipe_image(client: TestClient, sample_recipe):
    """Test deleting a recipe image."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add two images
    response1 = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )
    image1_id = response1.json()["id"]

    response2 = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )
    image2_id = response2.json()["id"]

    # Delete first image
    delete_response = client.delete(f"/api/v1/recipe-images/{image1_id}")
    assert delete_response.status_code == 204

    # Verify image is deleted
    images_response = client.get(f"/api/v1/recipe-images/{recipe_id}")
    images = images_response.json()
    assert len(images) == 1
    assert images[0]["id"] == image2_id


def test_delete_nonexistent_image(client: TestClient):
    """Test deleting a non-existent image."""
    response = client.delete("/api/v1/recipe-images/99999")
    assert response.status_code == 404
    assert "Image not found" in response.json()["detail"]


def test_reorder_recipe_images(client: TestClient, sample_recipe):
    """Test reordering images for a recipe."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add three images
    image_ids = []
    for i in range(3):
        response = client.post(
            f"/api/v1/recipe-images/{recipe_id}",
            json={"image_base64": base64_image},
        )
        image_ids.append(response.json()["id"])

    # Reorder: put image 3 first, then image 1, then image 2
    reorder_data = {
        "images": [
            {"id": image_ids[2], "order": 0},
            {"id": image_ids[0], "order": 1},
            {"id": image_ids[1], "order": 2},
        ]
    }

    response = client.patch(
        f"/api/v1/recipe-images/{recipe_id}",
        json=reorder_data,
    )

    assert response.status_code == 200
    images = response.json()
    assert len(images) == 3
    assert images[0]["id"] == image_ids[2]
    assert images[0]["order"] == 0
    assert images[1]["id"] == image_ids[0]
    assert images[1]["order"] == 1
    assert images[2]["id"] == image_ids[1]
    assert images[2]["order"] == 2


def test_reorder_empty_recipe_images(client: TestClient, sample_recipe):
    """Test reordering images for a recipe with no images."""
    recipe_id = sample_recipe["id"]

    reorder_data = {"images": []}

    response = client.patch(
        f"/api/v1/recipe-images/{recipe_id}",
        json=reorder_data,
    )

    # Should still succeed (empty list is valid)
    assert response.status_code == 200
    images = response.json()
    assert len(images) == 0


def test_delete_image_reorders_remaining(client: TestClient, sample_recipe):
    """Test that deleting an image reorders the remaining images."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add three images
    image_ids = []
    for i in range(3):
        response = client.post(
            f"/api/v1/recipe-images/{recipe_id}",
            json={"image_base64": base64_image},
        )
        image_ids.append(response.json()["id"])

    # Verify initial order
    get_response = client.get(f"/api/v1/recipe-images/{recipe_id}")
    images = get_response.json()
    assert images[0]["order"] == 0
    assert images[1]["order"] == 1
    assert images[2]["order"] == 2

    # Delete middle image
    client.delete(f"/api/v1/recipe-images/{image_ids[1]}")

    # Verify remaining images are reordered
    get_response = client.get(f"/api/v1/recipe-images/{recipe_id}")
    images = get_response.json()
    assert len(images) == 2
    assert images[0]["order"] == 0
    assert images[1]["order"] == 1


def test_add_image_missing_base64(client: TestClient, sample_recipe):
    """Test adding an image without image_base64 returns validation error."""
    recipe_id = sample_recipe["id"]

    response = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={},
    )

    assert response.status_code == 422  # Pydantic validation error


def test_get_images_for_nonexistent_recipe(client: TestClient):
    """Test getting images for a non-existent recipe returns empty list."""
    response = client.get("/api/v1/recipe-images/99999")
    assert response.status_code == 200
    images = response.json()
    assert images == []


def test_first_image_is_always_main(client: TestClient, sample_recipe):
    """Test that the first image added is always set as main."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    response = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )

    image = response.json()
    assert image["is_main"] is True


def test_subsequent_images_not_main(client: TestClient, sample_recipe):
    """Test that subsequent images are not set as main."""
    recipe_id = sample_recipe["id"]
    base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # Add first image
    client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )

    # Add second image
    response = client.post(
        f"/api/v1/recipe-images/{recipe_id}",
        json={"image_base64": base64_image},
    )

    image = response.json()
    assert image["is_main"] is False
