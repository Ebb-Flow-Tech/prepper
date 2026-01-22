"""Tests for recipe image upload endpoint (legacy - for backwards compatibility)."""

from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient


# A minimal valid PNG base64 (1x1 transparent pixel)
TEST_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def test_create_recipe_without_description(client: TestClient):
    """Test creating a recipe without description (defaults to null)."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Recipe without Description",
            "yield_quantity": 1,
            "yield_unit": "portion",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Recipe without Description"
    assert data["description"] is None


def test_create_recipe_with_description(client: TestClient):
    """Test creating a recipe with description."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Recipe with Description",
            "yield_quantity": 1,
            "yield_unit": "portion",
            "description": "This is a delicious recipe",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Recipe with Description"
    assert data["description"] == "This is a delicious recipe"


def test_update_recipe_description_via_patch(client: TestClient):
    """Test updating recipe description via PATCH endpoint."""
    # Create recipe first
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update description via PATCH
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"description": "Updated description"},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Updated description"


def test_fork_recipe_does_not_copy_images(client: TestClient):
    """Test that forking a recipe does not copy images."""
    # Create recipe
    create_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Recipe with Images",
            "yield_quantity": 1,
            "yield_unit": "portion",
        },
    )
    original_id = create_response.json()["id"]

    # Add an image to original recipe
    client.post(
        f"/api/v1/recipe-images/{original_id}",
        json={"image_url": "https://example.com/original-image.png"},
    )

    # Fork the recipe
    fork_response = client.post(f"/api/v1/recipes/{original_id}/fork")
    assert fork_response.status_code == 201
    forked_id = fork_response.json()["id"]

    # Verify forked recipe has no images
    images_response = client.get(f"/api/v1/recipe-images/{forked_id}")
    images = images_response.json()
    assert len(images) == 0
