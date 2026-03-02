#!/usr/bin/env python3
"""Seed script for ingredients table.

Seeds the ingredients table with realistic culinary ingredients if empty.
Includes supplier pricing and category assignments.

Run with: python -m scripts.seed_ingredients
"""

import sys
from pathlib import Path
from datetime import datetime

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select

from app.database import engine
from app.models.ingredient import Ingredient
from app.models.supplier import Supplier
from app.models.supplier_ingredient import SupplierIngredient
from app.models.category import Category


# Comprehensive ingredient data organized by category
INGREDIENTS_DATA = [
    # Proteins
    {
        "name": "Chicken Breast",
        "category": "Proteins",
        "base_unit": "kg",
        "cost_per_base_unit": 12.50,
        "is_halal": True,
        "suppliers": [
            {
                "supplier_name": "Golden Poultry",
                "sku": "CB-001",
                "pack_size": 5.0,
                "pack_unit": "kg",
                "price_per_pack": 62.50,
                "currency": "SGD",
                "is_preferred": True,
                "source": "manual",
            }
        ],
    },
    {
        "name": "Beef Chuck",
        "category": "Proteins",
        "base_unit": "kg",
        "cost_per_base_unit": 18.00,
        "is_halal": False,
        "suppliers": [
            {
                "supplier_name": "Prime Beef Co",
                "sku": "BC-001",
                "pack_size": 10.0,
                "pack_unit": "kg",
                "price_per_pack": 180.00,
                "currency": "SGD",
                "is_preferred": True,
                "source": "manual",
            }
        ],
    },
    {
        "name": "Salmon Fillet",
        "category": "Proteins",
        "base_unit": "kg",
        "cost_per_base_unit": 24.50,
        "is_halal": True,
        "suppliers": [
            {
                "supplier_name": "Fresh Seafood",
                "sku": "SF-001",
                "pack_size": 2.5,
                "pack_unit": "kg",
                "price_per_pack": 61.25,
                "currency": "SGD",
                "is_preferred": True,
                "source": "manual",
            }
        ],
    },
    {
        "name": "Ground Pork",
        "category": "Proteins",
        "base_unit": "kg",
        "cost_per_base_unit": 14.00,
        "is_halal": False,
        "suppliers": [],
    },
    {
        "name": "Eggs",
        "category": "Proteins",
        "base_unit": "pcs",
        "cost_per_base_unit": 0.80,
        "is_halal": True,
        "suppliers": [
            {
                "supplier_name": "Farm Fresh Eggs",
                "sku": "EGG-001",
                "pack_size": 30.0,
                "pack_unit": "pcs",
                "price_per_pack": 24.00,
                "currency": "SGD",
                "is_preferred": True,
                "source": "manual",
            }
        ],
    },
    # Vegetables
    {
        "name": "Tomato",
        "category": "Vegetables",
        "base_unit": "kg",
        "cost_per_base_unit": 3.50,
        "is_halal": True,
        "suppliers": [
            {
                "supplier_name": "Local Farm Produce",
                "sku": "TOM-001",
                "pack_size": 5.0,
                "pack_unit": "kg",
                "price_per_pack": 17.50,
                "currency": "SGD",
                "is_preferred": True,
                "source": "manual",
            }
        ],
    },
    {
        "name": "Onion",
        "category": "Vegetables",
        "base_unit": "kg",
        "cost_per_base_unit": 2.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Garlic",
        "category": "Vegetables",
        "base_unit": "kg",
        "cost_per_base_unit": 6.50,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Bell Pepper",
        "category": "Vegetables",
        "base_unit": "kg",
        "cost_per_base_unit": 5.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Broccoli",
        "category": "Vegetables",
        "base_unit": "kg",
        "cost_per_base_unit": 4.50,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Carrot",
        "category": "Vegetables",
        "base_unit": "kg",
        "cost_per_base_unit": 2.50,
        "is_halal": True,
        "suppliers": [],
    },
    # Fruits
    {
        "name": "Lemon",
        "category": "Fruits",
        "base_unit": "kg",
        "cost_per_base_unit": 4.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Lime",
        "category": "Fruits",
        "base_unit": "kg",
        "cost_per_base_unit": 4.50,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Banana",
        "category": "Fruits",
        "base_unit": "kg",
        "cost_per_base_unit": 3.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Apple",
        "category": "Fruits",
        "base_unit": "kg",
        "cost_per_base_unit": 4.50,
        "is_halal": True,
        "suppliers": [],
    },
    # Dairy
    {
        "name": "Butter",
        "category": "Dairy",
        "base_unit": "kg",
        "cost_per_base_unit": 16.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Milk",
        "category": "Dairy",
        "base_unit": "l",
        "cost_per_base_unit": 3.50,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Cheese",
        "category": "Dairy",
        "base_unit": "kg",
        "cost_per_base_unit": 22.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Cream",
        "category": "Dairy",
        "base_unit": "l",
        "cost_per_base_unit": 8.50,
        "is_halal": True,
        "suppliers": [],
    },
    # Grains
    {
        "name": "White Rice",
        "category": "Grains",
        "base_unit": "kg",
        "cost_per_base_unit": 3.50,
        "is_halal": True,
        "suppliers": [
            {
                "supplier_name": "Premium Rice Mills",
                "sku": "RICE-001",
                "pack_size": 25.0,
                "pack_unit": "kg",
                "price_per_pack": 87.50,
                "currency": "SGD",
                "is_preferred": True,
                "source": "manual",
            }
        ],
    },
    {
        "name": "Pasta",
        "category": "Grains",
        "base_unit": "kg",
        "cost_per_base_unit": 4.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Bread Flour",
        "category": "Grains",
        "base_unit": "kg",
        "cost_per_base_unit": 2.50,
        "is_halal": True,
        "suppliers": [],
    },
    # Spices
    {
        "name": "Black Pepper",
        "category": "Spices",
        "base_unit": "g",
        "cost_per_base_unit": 0.15,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Cumin",
        "category": "Spices",
        "base_unit": "g",
        "cost_per_base_unit": 0.08,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Paprika",
        "category": "Spices",
        "base_unit": "g",
        "cost_per_base_unit": 0.12,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Salt",
        "category": "Spices",
        "base_unit": "kg",
        "cost_per_base_unit": 1.00,
        "is_halal": True,
        "suppliers": [],
    },
    # Oils & Fats
    {
        "name": "Olive Oil",
        "category": "Oils Fats",
        "base_unit": "l",
        "cost_per_base_unit": 15.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Vegetable Oil",
        "category": "Oils Fats",
        "base_unit": "l",
        "cost_per_base_unit": 4.50,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Sesame Oil",
        "category": "Oils Fats",
        "base_unit": "l",
        "cost_per_base_unit": 18.00,
        "is_halal": True,
        "suppliers": [],
    },
    # Sauces & Condiments
    {
        "name": "Soy Sauce",
        "category": "Sauces Condiments",
        "base_unit": "l",
        "cost_per_base_unit": 5.50,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Fish Sauce",
        "category": "Sauces Condiments",
        "base_unit": "l",
        "cost_per_base_unit": 6.00,
        "is_halal": False,
        "suppliers": [],
    },
    {
        "name": "Vinegar",
        "category": "Sauces Condiments",
        "base_unit": "l",
        "cost_per_base_unit": 3.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Tomato Sauce",
        "category": "Sauces Condiments",
        "base_unit": "kg",
        "cost_per_base_unit": 4.50,
        "is_halal": True,
        "suppliers": [],
    },
    # Beverages
    {
        "name": "Coffee Beans",
        "category": "Beverages",
        "base_unit": "kg",
        "cost_per_base_unit": 18.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "Black Tea",
        "category": "Beverages",
        "base_unit": "kg",
        "cost_per_base_unit": 12.00,
        "is_halal": True,
        "suppliers": [],
    },
    {
        "name": "White Wine",
        "category": "Beverages",
        "base_unit": "l",
        "cost_per_base_unit": 15.00,
        "is_halal": False,
        "suppliers": [],
    },
]


def get_category_id(session: Session, category_name: str) -> int | None:
    """Get category ID by name (case-insensitive)."""
    category = session.exec(
        select(Category).where(
            Category.name.ilike(category_name)
        )
    ).first()
    return category.id if category else None


def get_or_create_supplier(session: Session, supplier_name: str) -> Supplier:
    """Get existing supplier by name or create a new one."""
    existing = session.exec(
        select(Supplier).where(Supplier.name == supplier_name)
    ).first()
    if existing:
        return existing
    supplier = Supplier(name=supplier_name)
    session.add(supplier)
    session.flush()
    return supplier


def seed_ingredients() -> None:
    """Seed ingredients table if empty."""
    with Session(engine) as session:
        # Check if table has any rows
        existing = session.exec(select(Ingredient).limit(1)).first()
        if existing:
            print("Ingredients table is not empty, skipping seed.")
            return

        # Get category mappings
        category_ids = {}
        for category_name in set(ing["category"] for ing in INGREDIENTS_DATA):
            cat_id = get_category_id(session, category_name)
            if cat_id:
                category_ids[category_name] = cat_id
            else:
                print(f"Warning: Category '{category_name}' not found")

        # Seed ingredients
        created_count = 0
        supplier_link_count = 0
        for ing_data in INGREDIENTS_DATA:
            category_id = category_ids.get(ing_data["category"])

            ingredient = Ingredient(
                name=ing_data["name"],
                base_unit=ing_data["base_unit"],
                cost_per_base_unit=ing_data["cost_per_base_unit"],
                is_halal=ing_data["is_halal"],
                category_id=category_id,
                source="manual",
                is_active=True,
            )
            session.add(ingredient)
            session.flush()  # Get the ingredient ID
            created_count += 1

            # Create supplier-ingredient links
            for sup_data in ing_data.get("suppliers", []):
                supplier = get_or_create_supplier(session, sup_data["supplier_name"])
                si = SupplierIngredient(
                    ingredient_id=ingredient.id,
                    supplier_id=supplier.id,
                    sku=sup_data.get("sku"),
                    pack_size=sup_data["pack_size"],
                    pack_unit=sup_data["pack_unit"],
                    price_per_pack=sup_data["price_per_pack"],
                    currency=sup_data.get("currency", "SGD"),
                    is_preferred=sup_data.get("is_preferred", False),
                    source=sup_data.get("source", "manual"),
                )
                session.add(si)
                supplier_link_count += 1

        session.commit()
        print(f"Seeded {created_count} ingredients with {supplier_link_count} supplier links.")

        # Print summary
        print("\nIngredients by category:")
        for category_name in sorted(set(ing["category"] for ing in INGREDIENTS_DATA)):
            count = sum(1 for ing in INGREDIENTS_DATA if ing["category"] == category_name)
            print(f"  {category_name}: {count}")


if __name__ == "__main__":
    seed_ingredients()
