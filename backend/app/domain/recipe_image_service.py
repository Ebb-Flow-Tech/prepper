"""RecipeImage service - manages recipe images and ordering."""

from sqlmodel import Session, select

from app.models import RecipeImage, RecipeImageCreate, RecipeImageUpdate


class RecipeImageService:
    """Service for managing recipe images."""

    def __init__(self, session: Session):
        """Initialize service with database session."""
        self.session = session

    def add_image(self, recipe_id: int, image_url: str) -> RecipeImage:
        """
        Add an image to a recipe (new images go to the end).

        Args:
            recipe_id: Recipe ID
            image_url: URL of the image

        Returns:
            Created RecipeImage instance
        """
        # Get all images for this recipe to find next order
        statement = select(RecipeImage).where(RecipeImage.recipe_id == recipe_id)
        images = self.session.exec(statement).all()
        next_order = len(images)

        # If this is the first image, make it main
        is_main = next_order == 0

        image = RecipeImage(
            recipe_id=recipe_id,
            image_url=image_url,
            is_main=is_main,
            order=next_order,
        )
        self.session.add(image)
        self.session.commit()
        self.session.refresh(image)
        return image

    def get_recipe_images(self, recipe_id: int) -> list[RecipeImage]:
        """
        Get all images for a recipe, ordered by sequence.

        Args:
            recipe_id: Recipe ID

        Returns:
            List of RecipeImage instances sorted by order
        """
        statement = (
            select(RecipeImage)
            .where(RecipeImage.recipe_id == recipe_id)
            .order_by(RecipeImage.order)
        )
        return self.session.exec(statement).all()

    def get_image(self, image_id: int) -> RecipeImage | None:
        """
        Get a single image by ID.

        Args:
            image_id: Image ID

        Returns:
            RecipeImage instance or None if not found
        """
        return self.session.get(RecipeImage, image_id)

    def delete_image(self, image_id: int) -> bool:
        """
        Delete an image and reorder remaining images.

        Args:
            image_id: Image ID to delete

        Returns:
            True if deleted, False if not found
        """
        image = self.session.get(RecipeImage, image_id)
        if not image:
            return False

        recipe_id = image.recipe_id
        self.session.delete(image)
        self.session.commit()

        # Reorder remaining images
        self._reorder_images(recipe_id)

        return True

    def reorder_images(self, recipe_id: int, image_orders: list[dict]) -> list[RecipeImage]:
        """
        Reorder images for a recipe.

        Args:
            recipe_id: Recipe ID
            image_orders: List of dicts with 'id' and 'order' keys

        Returns:
            Updated list of RecipeImage instances in new order
        """
        # Update each image's order
        for item in image_orders:
            image = self.session.get(RecipeImage, item["id"])
            if image and image.recipe_id == recipe_id:
                image.order = item["order"]
                self.session.add(image)

        self.session.commit()

        # Return reordered images
        return self.get_recipe_images(recipe_id)

    def set_main_image(self, recipe_id: int, image_id: int) -> RecipeImage | None:
        """
        Set an image as the main image for a recipe.

        Args:
            recipe_id: Recipe ID
            image_id: Image ID to set as main

        Returns:
            Updated RecipeImage instance or None if not found
        """
        # Unset current main image
        statement = select(RecipeImage).where(
            RecipeImage.recipe_id == recipe_id,
            RecipeImage.is_main == True,
        )
        main_images = self.session.exec(statement).all()
        for main_image in main_images:
            main_image.is_main = False
            self.session.add(main_image)

        # Set new main image
        image = self.session.get(RecipeImage, image_id)
        if image and image.recipe_id == recipe_id:
            image.is_main = True
            self.session.add(image)
            self.session.commit()
            self.session.refresh(image)
            return image

        self.session.commit()
        return None

    def _reorder_images(self, recipe_id: int) -> None:
        """
        Reorder all images for a recipe sequentially.

        Args:
            recipe_id: Recipe ID
        """
        images = self.get_recipe_images(recipe_id)
        for idx, image in enumerate(images):
            image.order = idx
            self.session.add(image)
        self.session.commit()
