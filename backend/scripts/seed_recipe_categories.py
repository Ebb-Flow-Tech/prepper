"""Seed script for recipe_categories table.

Seeds the recipe_categories table with default recipe categories if empty.
Run with: python -m scripts.seed_recipe_categories
"""

from sqlmodel import Session, select

from app.database import engine
from app.models.recipe_category import RecipeCategory


DEFAULT_RECIPE_CATEGORIES = [
    {
        "name": "Appetizers",
        "description": "Starters and small bites to begin a meal",
    },
    {
        "name": "Soups",
        "description": "Hot and cold soups, bisques, and broths",
    },
    {
        "name": "Salads",
        "description": "Fresh salads and composed dishes",
    },
    {
        "name": "Main Courses",
        "description": "Primary dishes featuring proteins and starches",
    },
    {
        "name": "Vegetarian",
        "description": "Plant-based and meat-free main courses",
    },
    {
        "name": "Seafood",
        "description": "Fish, shellfish, and ocean-based proteins",
    },
    {
        "name": "Pasta",
        "description": "Pasta dishes and noodle-based recipes",
    },
    {
        "name": "Grains & Legumes",
        "description": "Rice, quinoa, beans, and legume-based dishes",
    },
    {
        "name": "Sauces & Condiments",
        "description": "Sauces, dressings, and flavor enhancers",
    },
    {
        "name": "Breads & Baked Goods",
        "description": "Breads, pastries, and baked items",
    },
    {
        "name": "Desserts",
        "description": "Sweet treats and dessert recipes",
    },
    {
        "name": "Beverages",
        "description": "Drinks, cocktails, and smoothies",
    },
    {
        "name": "Breakfast",
        "description": "Morning dishes and breakfast specialties",
    },
    {
        "name": "Side Dishes",
        "description": "Vegetables, starches, and accompaniments",
    },
    {
        "name": "Comfort Food",
        "description": "Classic and warming comfort food recipes",
    },
]


def seed_recipe_categories() -> None:
    """Seed recipe_categories table if empty."""
    with Session(engine) as session:
        # Check if table has any rows
        existing = session.exec(select(RecipeCategory).limit(1)).first()
        if existing:
            print("Recipe categories table is not empty, skipping seed.")
            return

        # Seed recipe categories
        for category_data in DEFAULT_RECIPE_CATEGORIES:
            category = RecipeCategory(
                name=category_data["name"],
                description=category_data["description"],
            )
            session.add(category)

        session.commit()
        print(f"Seeded {len(DEFAULT_RECIPE_CATEGORIES)} recipe categories.")


if __name__ == "__main__":
    seed_recipe_categories()
