"""Seed script for allergens table.

Seeds the allergens table with the Big 9 + Sesame allergens if empty.
Run with: python -m scripts.seed_allergens
"""

from sqlmodel import Session, select

from app.database import engine
from app.models import Allergen  # Import from models package to configure all relationships


MAJOR_ALLERGENS = [
    "Milk",
    "Eggs",
    "Fish",
    "Shellfish",
    "Tree Nuts",
    "Peanuts",
    "Wheat",
    "Soybeans",
    "Sesame",
]


def seed_allergens() -> None:
    """Seed allergens table if empty."""
    with Session(engine) as session:
        # Check if table has any rows
        existing = session.exec(select(Allergen).limit(1)).first()
        if existing:
            print("Allergens table is not empty, skipping seed.")
            return

        # Seed allergens
        for name in MAJOR_ALLERGENS:
            allergen = Allergen(name=name)
            session.add(allergen)

        session.commit()
        print(f"Seeded {len(MAJOR_ALLERGENS)} allergens.")


if __name__ == "__main__":
    seed_allergens()
