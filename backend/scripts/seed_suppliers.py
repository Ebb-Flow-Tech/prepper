"""Seed script for suppliers table.

Seeds the suppliers table with default suppliers if empty.
Run with: python -m scripts.seed_suppliers
"""

from sqlmodel import Session, select

from app.database import engine
from app.models.supplier import Supplier


DEFAULT_SUPPLIERS = [
    {
        "name": "Fresh Produce Co",
        "address": "123 Market Street, City, State 12345",
        "phone_number": "+1-555-0101",
        "email": "contact@freshproduce.com",
    },
    {
        "name": "Premium Meats Ltd",
        "address": "456 Butcher Lane, City, State 12345",
        "phone_number": "+1-555-0102",
        "email": "orders@premiummeats.com",
    },
    {
        "name": "Artisan Cheese House",
        "address": "789 Dairy Road, City, State 12345",
        "phone_number": "+1-555-0103",
        "email": "sales@artisancheese.com",
    },
    {
        "name": "Organic Grains Import",
        "address": "321 Farm Way, City, State 12345",
        "phone_number": "+1-555-0104",
        "email": "info@organicgrains.com",
    },
    {
        "name": "Spice Trading Company",
        "address": "654 Spice Market, City, State 12345",
        "phone_number": "+1-555-0105",
        "email": "wholesale@spicetrading.com",
    },
    {
        "name": "Local Fish Market",
        "address": "987 Dock Street, City, State 12345",
        "phone_number": "+1-555-0106",
        "email": "daily@localfish.com",
    },
    {
        "name": "Valley Vineyards",
        "address": "111 Wine Road, City, State 12345",
        "phone_number": "+1-555-0107",
        "email": "wholesale@valleyvineyards.com",
    },
    {
        "name": "Bakery Wholesale",
        "address": "222 Grain Plaza, City, State 12345",
        "phone_number": "+1-555-0108",
        "email": "orders@bakerywholesale.com",
    },
    {
        "name": "Premium Olive Oil Co",
        "address": "333 Oil Lane, City, State 12345",
        "phone_number": "+1-555-0109",
        "email": "sales@premiumoliveoil.com",
    },
    {
        "name": "Specialty Herbs Farm",
        "address": "444 Garden Path, City, State 12345",
        "phone_number": "+1-555-0110",
        "email": "fresh@specialtyherbs.com",
    },
]


def seed_suppliers() -> None:
    """Seed suppliers table if empty."""
    with Session(engine) as session:
        # Check if table has any rows
        existing = session.exec(select(Supplier).limit(1)).first()
        if existing:
            print("Suppliers table is not empty, skipping seed.")
            return

        # Seed suppliers
        for supplier_data in DEFAULT_SUPPLIERS:
            supplier = Supplier(
                name=supplier_data["name"],
                address=supplier_data["address"],
                phone_number=supplier_data["phone_number"],
                email=supplier_data["email"],
                is_active=True,
            )
            session.add(supplier)

        session.commit()
        print(f"Seeded {len(DEFAULT_SUPPLIERS)} suppliers.")


if __name__ == "__main__":
    seed_suppliers()
