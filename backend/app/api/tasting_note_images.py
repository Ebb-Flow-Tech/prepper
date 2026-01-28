"""Tasting note images API routes."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import get_session
from app.models import TastingNoteImage
from app.domain.tasting_note_image_service import TastingNoteImageService
from app.domain.tasting_note_service import TastingNoteService
from app.domain.ingredient_tasting_note_service import IngredientTastingNoteService
from app.domain.storage_service import StorageService, StorageError, is_storage_configured

router = APIRouter()


class ImageWithIdRequest(BaseModel):
    """Image with ID for update operations."""

    id: int | None  # null for new images, number for existing
    data: str | None = None  # base64 string (only for new images)
    image_url: str | None = None  # for existing images
    removed: bool = False  # marked for deletion


class UpdateTastingNoteImagesRequest(BaseModel):
    """Request body for updating tasting note images (add/remove in one call)."""

    images: list[ImageWithIdRequest]


@router.get("/{tasting_note_id}", response_model=list[TastingNoteImage])
def get_tasting_note_images(
    tasting_note_id: int,
    session: Session = Depends(get_session),
):
    """Get all images for a tasting note."""
    service = TastingNoteImageService(session)
    images = service.get_tasting_note_images(tasting_note_id)
    return images


@router.get("/ingredient/{ingredient_tasting_note_id}", response_model=list[TastingNoteImage])
def get_ingredient_tasting_note_images(
    ingredient_tasting_note_id: int,
    session: Session = Depends(get_session),
):
    """Get all images for an ingredient tasting note."""
    service = TastingNoteImageService(session)
    images = service.get_ingredient_tasting_note_images(ingredient_tasting_note_id)
    return images


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tasting_note_image(
    image_id: int,
    session: Session = Depends(get_session),
):
    """Delete a tasting note image from both storage and database."""
    service = TastingNoteImageService(session)
    image = service.get_image(image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    # Delete from storage first (if configured)
    if is_storage_configured():
        try:
            storage_service = StorageService()
            await storage_service.delete_image(image.image_url)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete image from storage: {str(e)}",
            )

    # Then delete from database
    service.delete_image(image_id)


@router.post("/sync/recipe/{tasting_note_id}", response_model=list[TastingNoteImage], status_code=status.HTTP_200_OK)
async def sync_tasting_note_images(
    tasting_note_id: int,
    data: UpdateTastingNoteImagesRequest,
    session: Session = Depends(get_session),
):
    """
    Sync tasting note images: add new images, keep existing, delete marked ones.

    - Images with id: null are treated as new and uploaded
    - Images with id: number and removed: true are deleted (from both storage and database)
    - Images with id: number and removed: false are kept (no action)
    - Existing images are never re-uploaded
    """
    # Verify tasting note exists
    tasting_note_service = TastingNoteService(session)
    tasting_note = tasting_note_service.get(tasting_note_id)
    if not tasting_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )

    image_service = TastingNoteImageService(session)

    # Collect image IDs marked for deletion
    image_ids_to_delete = [img.id for img in data.images if img.id is not None and img.removed]

    if image_ids_to_delete:
        try:
            # Fetch all images in batch
            images_to_delete = image_service.get_images_by_ids(image_ids_to_delete)

            # Delete from storage in parallel (if configured)
            if is_storage_configured():
                storage_service = StorageService()
                delete_tasks = [
                    storage_service.delete_image(img.image_url) for img in images_to_delete
                ]
                await asyncio.gather(*delete_tasks, return_exceptions=True)

            # Delete from database in batch
            image_service.delete_images_by_ids(image_ids_to_delete)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete images: {str(e)}",
            )

    # Collect new images (id is null)
    new_images = [img for img in data.images if img.id is None]

    # Validate that new images have data
    for img in new_images:
        if not img.data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="New images (id: null) must include base64 data",
            )

    if new_images:
        # Check if storage is configured
        if not is_storage_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image storage is not configured",
            )

        try:
            storage_service = StorageService()
            # Upload all images in parallel
            upload_tasks = [
                storage_service.upload_image_from_base64(
                    img.data, tasting_note_id, folder="tasting-note-images"
                )
                for img in new_images
            ]
            image_urls = await asyncio.gather(*upload_tasks, return_exceptions=True)

            # Check for errors in uploads
            failed_uploads = [url for url in image_urls if isinstance(url, Exception)]
            if failed_uploads:
                raise StorageError(f"Failed to upload {len(failed_uploads)} image(s)")

            # Add all uploaded images to database in batch
            image_service.add_images(tasting_note_id=tasting_note_id, image_urls=image_urls)
        except (StorageError, Exception) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload images: {str(e)}",
            )

    # Return all current images for this note
    all_images = image_service.get_tasting_note_images(tasting_note_id)
    return all_images


@router.post("/sync/ingredient/{ingredient_tasting_note_id}", response_model=list[TastingNoteImage], status_code=status.HTTP_200_OK)
async def sync_ingredient_tasting_note_images(
    ingredient_tasting_note_id: int,
    data: UpdateTastingNoteImagesRequest,
    session: Session = Depends(get_session),
):
    """
    Sync ingredient tasting note images: add new images, keep existing, delete marked ones.

    - Images with id: null are treated as new and uploaded
    - Images with id: number and removed: true are deleted (from both storage and database)
    - Images with id: number and removed: false are kept (no action)
    - Existing images are never re-uploaded
    """
    # Verify ingredient tasting note exists
    ingredient_tasting_service = IngredientTastingNoteService(session)
    ingredient_tasting_note = ingredient_tasting_service.get(ingredient_tasting_note_id)
    if not ingredient_tasting_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingredient tasting note not found",
        )

    image_service = TastingNoteImageService(session)

    # Collect image IDs marked for deletion
    image_ids_to_delete = [img.id for img in data.images if img.id is not None and img.removed]

    if image_ids_to_delete:
        try:
            # Fetch all images in batch
            images_to_delete = image_service.get_images_by_ids(image_ids_to_delete)

            # Delete from storage in parallel (if configured)
            if is_storage_configured():
                storage_service = StorageService()
                delete_tasks = [
                    storage_service.delete_image(img.image_url) for img in images_to_delete
                ]
                await asyncio.gather(*delete_tasks, return_exceptions=True)

            # Delete from database in batch
            image_service.delete_images_by_ids(image_ids_to_delete)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete images: {str(e)}",
            )

    # Collect new images (id is null)
    new_images = [img for img in data.images if img.id is None]

    # Validate that new images have data
    for img in new_images:
        if not img.data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="New images (id: null) must include base64 data",
            )

    if new_images:
        # Check if storage is configured
        if not is_storage_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image storage is not configured",
            )

        try:
            storage_service = StorageService()
            # Upload all images in parallel
            upload_tasks = [
                storage_service.upload_image_from_base64(
                    img.data, ingredient_tasting_note_id, folder="ingredient-tasting-note-images"
                )
                for img in new_images
            ]
            image_urls = await asyncio.gather(*upload_tasks, return_exceptions=True)

            # Check for errors in uploads
            failed_uploads = [url for url in image_urls if isinstance(url, Exception)]
            if failed_uploads:
                raise StorageError(f"Failed to upload {len(failed_uploads)} image(s)")

            # Add all uploaded images to database in batch
            image_service.add_images(ingredient_tasting_note_id=ingredient_tasting_note_id, image_urls=image_urls)
        except (StorageError, Exception) as e:
            print("E",e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload images: {str(e)}",
            )

    # Return all current images for this ingredient tasting note
    all_images = image_service.get_ingredient_tasting_note_images(ingredient_tasting_note_id)
    return all_images
