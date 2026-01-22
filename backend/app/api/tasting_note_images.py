"""Tasting note images API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api.deps import get_session
from app.models import TastingNoteImage
from app.domain.tasting_note_image_service import TastingNoteImageService
from app.domain.tasting_note_service import TastingNoteService
from app.domain.storage_service import StorageService, StorageError, is_storage_configured

router = APIRouter()


class AddTastingNoteImageRequest(BaseModel):
    """Request body for adding an image to a tasting note."""

    image_base64: str


class AddMultipleTastingNoteImagesRequest(BaseModel):
    """Request body for adding multiple images to a tasting note."""

    images: list[str]  # Array of base64-encoded images


class ImageWithIdRequest(BaseModel):
    """Image with ID for update operations."""

    id: int | None  # null for new images, number for existing
    data: str  # base64 string
    image_url: str | None = None  # for existing images
    removed: bool = False  # marked for deletion


class UpdateTastingNoteImagesRequest(BaseModel):
    """Request body for updating tasting note images (add/remove in one call)."""

    images: list[ImageWithIdRequest]


@router.post("/{tasting_note_id}", response_model=TastingNoteImage, status_code=status.HTTP_201_CREATED)
async def add_tasting_note_image(
    tasting_note_id: int,
    data: AddTastingNoteImageRequest,
    session: Session = Depends(get_session),
):
    """
    Upload a base64-encoded image for a tasting note.

    1. Uploads the image to Supabase Storage
    2. Creates a TastingNoteImage database record with the URL
    """
    # Verify tasting note exists
    tasting_note_service = TastingNoteService(session)
    tasting_note = tasting_note_service.get(tasting_note_id)
    if not tasting_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )

    # Check if storage is configured
    if not is_storage_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured",
        )

    # Upload to Supabase
    try:
        storage_service = StorageService()
        image_url = await storage_service.upload_image_from_base64(
            data.image_base64, tasting_note_id, folder="tasting-note-images"
        )
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}",
        )

    # Create database record
    image_service = TastingNoteImageService(session)
    image = image_service.add_image(tasting_note_id, image_url)
    return image


@router.post("/batch/{tasting_note_id}", response_model=list[TastingNoteImage], status_code=status.HTTP_201_CREATED)
async def add_multiple_tasting_note_images(
    tasting_note_id: int,
    data: AddMultipleTastingNoteImagesRequest,
    session: Session = Depends(get_session),
):
    """
    Upload multiple base64-encoded images for a tasting note.

    1. Uploads each image to Supabase Storage
    2. Creates TastingNoteImage database records with the URLs
    """
    # Verify tasting note exists
    tasting_note_service = TastingNoteService(session)
    tasting_note = tasting_note_service.get(tasting_note_id)
    if not tasting_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )

    # Check if storage is configured
    if not is_storage_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured",
        )

    # Upload all images and create database records
    storage_service = StorageService()
    image_service = TastingNoteImageService(session)

    for image_base64 in data.images:
        try:
            image_url = await storage_service.upload_image_from_base64(
                image_base64, tasting_note_id, folder="tasting-note-images"
            )
            image_service.add_image(tasting_note_id, image_url)
        except StorageError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image: {str(e)}",
            )

    # Fetch all images for this note to return fully populated objects
    created_images = image_service.get_tasting_note_images(tasting_note_id)
    return created_images


@router.get("/{tasting_note_id}", response_model=list[TastingNoteImage])
def get_tasting_note_images(
    tasting_note_id: int,
    session: Session = Depends(get_session),
):
    """Get all images for a tasting note."""
    service = TastingNoteImageService(session)
    images = service.get_tasting_note_images(tasting_note_id)
    return images


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tasting_note_image(
    image_id: int,
    session: Session = Depends(get_session),
):
    """Delete a tasting note image."""
    service = TastingNoteImageService(session)
    success = service.delete_image(image_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )


@router.post("/sync/{tasting_note_id}", response_model=list[TastingNoteImage], status_code=status.HTTP_200_OK)
async def sync_tasting_note_images(
    tasting_note_id: int,
    data: UpdateTastingNoteImagesRequest,
    session: Session = Depends(get_session),
):
    """
    Sync tasting note images: add new images, keep existing, delete marked ones.

    - Images with id: null are treated as new and uploaded
    - Images with id: number and removed: true are deleted
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

    # Delete marked images (id is not null and removed is true)
    for img in data.images:
        if img.id is not None and img.removed:
            try:
                image_service.delete_image(img.id)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to delete image {img.id}: {str(e)}",
                )

    # Upload new images (id is null)
    if not is_storage_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured",
        )

    storage_service = StorageService()
    for img in data.images:
        if img.id is None:  # New image
            try:
                image_url = await storage_service.upload_image_from_base64(
                    img.data, tasting_note_id, folder="tasting-note-images"
                )
                image_service.add_image(tasting_note_id, image_url)
            except StorageError as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to upload image: {str(e)}",
                )

    # Return all current images for this note
    all_images = image_service.get_tasting_note_images(tasting_note_id)
    return all_images
