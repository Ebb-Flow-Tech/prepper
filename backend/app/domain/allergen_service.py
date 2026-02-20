"""Allergen domain operations."""

from datetime import datetime

from sqlmodel import Session, select, func

from app.models.allergen import (
    Allergen,
    AllergenCreate,
    AllergenUpdate,
)


class AllergenService:
    """Service for allergen CRUD operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_allergen(self, data: AllergenCreate) -> Allergen:
        """Create a new allergen.

        Raises ValueError if an allergen with the same name already exists
        (case-insensitive check).
        """
        if self._name_exists(data.name):
            raise ValueError(f"Allergen with name '{data.name}' already exists")

        allergen = Allergen.model_validate(data)
        self.session.add(allergen)
        self.session.commit()
        self.session.refresh(allergen)
        return allergen

    def list_allergens(self, active_only: bool = True) -> list[Allergen]:
        """List all allergens.

        Args:
            active_only: If True, only return active (non-deleted) allergens.
        """
        statement = select(Allergen)
        if active_only:
            statement = statement.where(Allergen.is_active == True)
        return list(self.session.exec(statement).all())

    def get_allergen(self, allergen_id: int) -> Allergen | None:
        """Get an allergen by ID."""
        return self.session.get(Allergen, allergen_id)

    def update_allergen(
        self, allergen_id: int, data: AllergenUpdate
    ) -> Allergen | None:
        """Update an allergen's fields.

        Raises ValueError if the new name conflicts with an existing allergen
        (case-insensitive check).
        """
        allergen = self.get_allergen(allergen_id)
        if not allergen:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Check for name uniqueness if name is being updated
        if "name" in update_data and update_data["name"]:
            new_name = update_data["name"]
            if self._name_exists(new_name, exclude_id=allergen_id):
                raise ValueError(f"Allergen with name '{new_name}' already exists")

        for key, value in update_data.items():
            setattr(allergen, key, value)

        allergen.updated_at = datetime.utcnow()
        self.session.add(allergen)
        self.session.commit()
        self.session.refresh(allergen)
        return allergen

    def soft_delete_allergen(self, allergen_id: int) -> Allergen | None:
        """Soft-delete an allergen by setting is_active to False."""
        allergen = self.get_allergen(allergen_id)
        if not allergen:
            return None

        allergen.is_active = False
        allergen.updated_at = datetime.utcnow()
        self.session.add(allergen)
        self.session.commit()
        self.session.refresh(allergen)
        return allergen

    def _name_exists(self, name: str, exclude_id: int | None = None) -> bool:
        """Check if an allergen with the given name exists (case-insensitive).

        Args:
            name: The allergen name to check.
            exclude_id: Optional allergen ID to exclude from the check
                       (useful when updating an allergen).
        """
        statement = select(Allergen).where(
            func.lower(Allergen.name) == name.lower(),
            Allergen.is_active == True,
        )
        if exclude_id is not None:
            statement = statement.where(Allergen.id != exclude_id)

        result = self.session.exec(statement).first()
        return result is not None
