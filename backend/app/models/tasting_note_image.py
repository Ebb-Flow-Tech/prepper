"""TastingNoteImage model - represents images for tasting notes."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class TastingNoteImageBase(SQLModel):
    """Shared fields for TastingNoteImage."""

    tasting_note_id: int | None = Field(default=None, foreign_key="tasting_notes.id", index=True)
    ingredient_tasting_note_id: int | None = Field(default=None, foreign_key="ingredient_tasting_notes.id", index=True)
    image_url: str


class TastingNoteImage(TastingNoteImageBase, table=True):
    """
    Represents an image for a tasting note.

    Each tasting note can have multiple images with:
    - image_url: Storage location
    """

    __tablename__ = "tasting_note_images"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TastingNoteImageCreate(TastingNoteImageBase):
    """Schema for creating a new tasting note image."""

    pass
