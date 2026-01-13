"""Storage service for handling file uploads to Supabase Storage."""

import base64
import uuid
from datetime import datetime

import httpx

from app.config import get_settings


class StorageError(Exception):
    """Error during storage operations."""

    pass


class StorageService:
    """Service for uploading and managing files in Supabase Storage."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._validate_config()

    def _validate_config(self) -> None:
        """Validate that Supabase configuration is present."""
        if not self.settings.supabase_url or not self.settings.supabase_key:
            raise StorageError("Supabase configuration is missing")

    def _get_headers(self) -> dict[str, str]:
        """Get headers for Supabase API requests."""
        return {
            "Authorization": f"Bearer {self.settings.supabase_key}",
            "apikey": self.settings.supabase_key,
        }

    async def upload_image_from_base64(
        self, base64_data: str, recipe_id: int
    ) -> str:
        """
        Upload a base64-encoded image to Supabase Storage.

        Args:
            base64_data: The base64-encoded image data (without data URL prefix)
            recipe_id: The recipe ID to use in the filename

        Returns:
            The public URL of the uploaded image in Supabase Storage
        """
        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"recipe_{recipe_id}_{timestamp}_{unique_id}.png"

        # Decode base64 to bytes
        try:
            image_data = base64.b64decode(base64_data)
        except Exception as e:
            raise StorageError(f"Invalid base64 data: {str(e)}")

        # Upload to Supabase Storage
        upload_url = (
            f"{self.settings.supabase_url}/storage/v1/object/"
            f"{self.settings.supabase_bucket}/{filename}"
        )

        async with httpx.AsyncClient() as client:
            try:
                upload_response = await client.post(
                    upload_url,
                    headers={
                        **self._get_headers(),
                        "Content-Type": "image/png",
                    },
                    content=image_data,
                    timeout=60.0,
                )
                upload_response.raise_for_status()
            except httpx.HTTPStatusError as e:
                # Log the actual response body for debugging
                error_detail = e.response.text if e.response else "No response body"
                raise StorageError(
                    f"Failed to upload to Supabase: {e.response.status_code} - {error_detail}"
                )
            except httpx.HTTPError as e:
                raise StorageError(f"Failed to upload to Supabase: {str(e)}")

        # Return the public URL
        public_url = (
            f"{self.settings.supabase_url}/storage/v1/object/public/"
            f"{self.settings.supabase_bucket}/{filename}"
        )
        return public_url

    async def delete_image(self, image_url: str) -> bool:
        """
        Delete an image from Supabase Storage.

        Args:
            image_url: The full public URL of the image to delete

        Returns:
            True if deletion was successful
        """
        # Extract filename from URL
        prefix = (
            f"{self.settings.supabase_url}/storage/v1/object/public/"
            f"{self.settings.supabase_bucket}/"
        )
        if not image_url.startswith(prefix):
            return False

        filename = image_url[len(prefix) :]

        delete_url = (
            f"{self.settings.supabase_url}/storage/v1/object/"
            f"{self.settings.supabase_bucket}/{filename}"
        )

        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(
                    delete_url,
                    headers=self._get_headers(),
                    timeout=30.0,
                )
                return response.status_code in (200, 204)
            except httpx.HTTPError:
                return False


def is_storage_configured() -> bool:
    """Check if Supabase storage is configured."""
    settings = get_settings()
    return bool(settings.supabase_url and settings.supabase_key)
