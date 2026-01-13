"""Tests for recipe image endpoint."""

from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient


# A minimal valid PNG base64 (1x1 transparent pixel)
TEST_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def test_update_recipe_image_storage_not_configured(client: TestClient):
    """Test that updating image returns 503 when storage is not configured."""
    # Create recipe first
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Try to update image without storage configured
    with patch("app.api.recipes.is_storage_configured", return_value=False):
        response = client.patch(
            f"/api/v1/recipes/{recipe_id}/image",
            json={"image_base64": TEST_BASE64},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Storage service not configured"


def test_update_recipe_image_recipe_not_found(client: TestClient):
    """Test that updating image for non-existent recipe returns 404."""
    with patch("app.api.recipes.is_storage_configured", return_value=True):
        response = client.patch(
            "/api/v1/recipes/99999/image",
            json={"image_base64": TEST_BASE64},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Recipe not found"


def test_update_recipe_image_success(client: TestClient):
    """Test successful image upload with base64 data."""
    # Create recipe first
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    mock_storage_url = "https://supabase.co/storage/v1/object/public/recipe-images/recipe_1_test.png"

    with patch("app.api.recipes.is_storage_configured", return_value=True):
        with patch("app.api.recipes.StorageService") as MockStorageService:
            mock_storage = MagicMock()
            mock_storage.upload_image_from_base64 = AsyncMock(return_value=mock_storage_url)
            mock_storage.delete_image = AsyncMock(return_value=True)
            MockStorageService.return_value = mock_storage

            response = client.patch(
                f"/api/v1/recipes/{recipe_id}/image",
                json={"image_base64": TEST_BASE64},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == recipe_id
    assert data["image_url"] == mock_storage_url
    # Verify base64 upload method was called
    mock_storage.upload_image_from_base64.assert_called_once_with(TEST_BASE64, recipe_id)


def test_update_recipe_image_deletes_old_image(client: TestClient):
    """Test that updating image deletes the old image first."""
    # Create recipe with an existing image_url
    create_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Test Recipe",
            "yield_quantity": 1,
            "yield_unit": "portion",
            "image_url": "https://supabase.co/storage/v1/object/public/recipe-images/old_image.png",
        },
    )
    recipe_id = create_response.json()["id"]

    mock_storage_url = "https://supabase.co/storage/v1/object/public/recipe-images/new_image.png"

    with patch("app.api.recipes.is_storage_configured", return_value=True):
        with patch("app.api.recipes.StorageService") as MockStorageService:
            mock_storage = MagicMock()
            mock_storage.upload_image_from_base64 = AsyncMock(return_value=mock_storage_url)
            mock_storage.delete_image = AsyncMock(return_value=True)
            MockStorageService.return_value = mock_storage

            response = client.patch(
                f"/api/v1/recipes/{recipe_id}/image",
                json={"image_base64": TEST_BASE64},
            )

    assert response.status_code == 200
    # Verify delete was called with old image URL
    mock_storage.delete_image.assert_called_once_with(
        "https://supabase.co/storage/v1/object/public/recipe-images/old_image.png"
    )


def test_update_recipe_image_storage_error(client: TestClient):
    """Test that storage errors return 502."""
    from app.domain.storage_service import StorageError

    # Create recipe first
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    with patch("app.api.recipes.is_storage_configured", return_value=True):
        with patch("app.api.recipes.StorageService") as MockStorageService:
            mock_storage = MagicMock()
            mock_storage.upload_image_from_base64 = AsyncMock(
                side_effect=StorageError("Invalid base64 data")
            )
            mock_storage.delete_image = AsyncMock(return_value=True)
            MockStorageService.return_value = mock_storage

            response = client.patch(
                f"/api/v1/recipes/{recipe_id}/image",
                json={"image_base64": "invalid-base64"},
            )

    assert response.status_code == 502
    assert "Invalid base64 data" in response.json()["detail"]


def test_update_recipe_image_missing_base64(client: TestClient):
    """Test that updating image without base64 returns 422."""
    # Create recipe first
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/recipes/{recipe_id}/image",
        json={},
    )

    assert response.status_code == 422  # Pydantic validation error - missing required field


def test_create_recipe_with_image_url(client: TestClient):
    """Test creating a recipe with an optional image_url."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Recipe with Image",
            "yield_quantity": 1,
            "yield_unit": "portion",
            "image_url": "https://example.com/recipe-image.png",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Recipe with Image"
    assert data["image_url"] == "https://example.com/recipe-image.png"


def test_create_recipe_without_image_url(client: TestClient):
    """Test creating a recipe without image_url (defaults to null)."""
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Recipe without Image",
            "yield_quantity": 1,
            "yield_unit": "portion",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Recipe without Image"
    assert data["image_url"] is None


def test_update_recipe_image_url_via_patch(client: TestClient):
    """Test updating recipe image_url via regular PATCH endpoint."""
    # Create recipe first
    create_response = client.post(
        "/api/v1/recipes",
        json={"name": "Test Recipe", "yield_quantity": 1, "yield_unit": "portion"},
    )
    recipe_id = create_response.json()["id"]

    # Update image_url via PATCH
    response = client.patch(
        f"/api/v1/recipes/{recipe_id}",
        json={"image_url": "https://example.com/direct-image.png"},
    )
    assert response.status_code == 200
    assert response.json()["image_url"] == "https://example.com/direct-image.png"


def test_fork_recipe_does_not_copy_image(client: TestClient):
    """Test that forking a recipe does not copy the image_url."""
    # Create recipe with image
    create_response = client.post(
        "/api/v1/recipes",
        json={
            "name": "Recipe with Image",
            "yield_quantity": 1,
            "yield_unit": "portion",
            "image_url": "https://example.com/original-image.png",
        },
    )
    original = create_response.json()

    # Fork the recipe
    fork_response = client.post(f"/api/v1/recipes/{original['id']}/fork")
    assert fork_response.status_code == 201
    forked = fork_response.json()

    # Forked recipe should not have the original's image
    # (Each fork should generate its own image if desired)
    assert forked["image_url"] is None
