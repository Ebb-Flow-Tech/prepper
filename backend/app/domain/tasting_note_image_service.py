"""TastingNoteImage service - manages tasting note images."""

from sqlmodel import Session, select

from app.models import TastingNoteImage


class TastingNoteImageService:
    """Service for managing tasting note images."""

    def __init__(self, session: Session):
        """Initialize service with database session."""
        self.session = session

    def add_images(self, tasting_note_id: int, image_urls: list[str]) -> list[TastingNoteImage]:
        """
        Add multiple images to a tasting note in batch.

        Args:
            tasting_note_id: Tasting Note ID
            image_urls: List of image URLs

        Returns:
            List of created TastingNoteImage instances
        """
        if not image_urls:
            return []

        images = [
            TastingNoteImage(tasting_note_id=tasting_note_id, image_url=url)
            for url in image_urls
        ]
        for image in images:
            self.session.add(image)
        self.session.commit()
        for image in images:
            self.session.refresh(image)
        return images

    def add_image(self, tasting_note_id: int, image_url: str) -> TastingNoteImage:
        """
        Add an image to a tasting note.

        Args:
            tasting_note_id: Tasting Note ID
            image_url: URL of the image

        Returns:
            Created TastingNoteImage instance
        """
        image = TastingNoteImage(
            tasting_note_id=tasting_note_id,
            image_url=image_url,
        )
        self.session.add(image)
        self.session.commit()
        self.session.refresh(image)
        return image

    def get_tasting_note_images(self, tasting_note_id: int) -> list[TastingNoteImage]:
        """
        Get all images for a tasting note.

        Args:
            tasting_note_id: Tasting Note ID

        Returns:
            List of TastingNoteImage instances
        """
        statement = select(TastingNoteImage).where(
            TastingNoteImage.tasting_note_id == tasting_note_id
        )
        return self.session.exec(statement).all()

    def get_image(self, image_id: int) -> TastingNoteImage | None:
        """
        Get a single image by ID.

        Args:
            image_id: Image ID

        Returns:
            TastingNoteImage instance or None if not found
        """
        return self.session.get(TastingNoteImage, image_id)

    def delete_image(self, image_id: int) -> bool:
        """
        Delete an image.

        Args:
            image_id: Image ID to delete

        Returns:
            True if deleted, False if not found
        """
        image = self.session.get(TastingNoteImage, image_id)
        if not image:
            return False

        self.session.delete(image)
        self.session.commit()

        return True

    def get_images_by_ids(self, image_ids: list[int]) -> list[TastingNoteImage]:
        """
        Get multiple images by their IDs.

        Args:
            image_ids: List of image IDs

        Returns:
            List of TastingNoteImage instances
        """
        if not image_ids:
            return []
        statement = select(TastingNoteImage).where(TastingNoteImage.id.in_(image_ids))
        return self.session.exec(statement).all()

    def delete_images_by_ids(self, image_ids: list[int]) -> int:
        """
        Delete multiple images by their IDs.

        Args:
            image_ids: List of image IDs to delete

        Returns:
            Number of images deleted
        """
        if not image_ids:
            return 0

        statement = select(TastingNoteImage).where(TastingNoteImage.id.in_(image_ids))
        images = self.session.exec(statement).all()

        for image in images:
            self.session.delete(image)

        self.session.commit()
        return len(images)
