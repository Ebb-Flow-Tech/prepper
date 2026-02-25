"""Seed script for outlets table.

Seeds the outlets table with default outlets if empty.
Creates a hierarchy with multiple brands and their locations.
Run with: python -m scripts.seed_outlets
"""

from sqlmodel import Session, select

from app.database import engine
from app.models.outlet import Outlet, OutletType


def seed_outlets() -> None:
    """Seed outlets table if empty."""
    with Session(engine) as session:
        # Check if table has any rows
        existing = session.exec(select(Outlet).limit(1)).first()
        if existing:
            print("Outlets table is not empty, skipping seed.")
            return

        brands = [
            {"name": "Central Kitchen", "code": "CK"},
            {"name": "The Brew House", "code": "TBH"},
            {"name": "Artisan Eats", "code": "AE"},
        ]

        locations_per_brand = {
            "CK": [
                {"name": "Downtown Kitchen", "code": "CK-DT"},
                {"name": "Uptown Kitchen", "code": "CK-UT"},
                {"name": "Airport Kitchen", "code": "CK-AP"},
            ],
            "TBH": [
                {"name": "Main Brewery", "code": "TBH-MB"},
                {"name": "Garden Venue", "code": "TBH-GV"},
                {"name": "Riverside Taproom", "code": "TBH-RT"},
            ],
            "AE": [
                {"name": "Central Atelier", "code": "AE-CA"},
                {"name": "Market Kitchen", "code": "AE-MK"},
            ],
        }

        total_outlets = 0

        # Create brands and their locations
        for brand in brands:
            brand_outlet = Outlet(
                name=brand["name"],
                code=brand["code"],
                outlet_type=OutletType.BRAND,
                is_active=True,
            )
            session.add(brand_outlet)
            session.flush()  # Get the brand ID
            total_outlets += 1

            # Create locations for this brand
            for location_data in locations_per_brand[brand["code"]]:
                location = Outlet(
                    name=location_data["name"],
                    code=location_data["code"],
                    outlet_type=OutletType.LOCATION,
                    parent_outlet_id=brand_outlet.id,
                    is_active=True,
                )
                session.add(location)
                total_outlets += 1

        session.commit()
        print(f"Seeded {total_outlets} outlets ({len(brands)} brands + locations).")


if __name__ == "__main__":
    seed_outlets()
