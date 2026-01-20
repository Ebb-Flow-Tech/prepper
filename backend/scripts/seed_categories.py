"""Seed script for categories table.

Seeds the categories table with default food categories if empty.
Run with: python -m scripts.seed_categories
"""

from sqlmodel import Session, select

from app.database import engine
from app.models import Category  # Import from models package to configure all relationships


FOOD_CATEGORIES = [
    "Proteins",
    "Vegetables",
    "Fruits",
    "Dairy",
    "Grains",
    "Spices",
    "Oils Fats",
    "Sauces Condiments",
    "Beverages",
    "Other",
]


def seed_categories() -> None:
    """Seed categories table if empty."""
    with Session(engine) as session:
        # Check if table has any rows
        existing = session.exec(select(Category).limit(1)).first()
        if existing:
            print("Categories table is not empty, skipping seed.")
            return

        # Seed categories
        for name in FOOD_CATEGORIES:
            category = Category(name=name)
            session.add(category)

        session.commit()
        print(f"Seeded {len(FOOD_CATEGORIES)} categories.")


if __name__ == "__main__":
    seed_categories()
