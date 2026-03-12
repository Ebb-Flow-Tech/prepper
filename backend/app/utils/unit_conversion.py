"""Unit conversion utilities for the costing engine."""

# Conversion factors to base units
# Mass: base unit is grams (g)
# Volume: base unit is milliliters (ml)
# Count: base unit is pieces (pcs)

MASS_CONVERSIONS = {
    "g": 1.0,
    "kg": 1000.0,
    "mg": 0.001,
    "oz": 28.3495,
    "lb": 453.592,
}

VOLUME_CONVERSIONS = {
    "ml": 1.0,
    "l": 1000.0,
    "tsp": 4.92892,
    "tbsp": 14.7868,
    "cup": 236.588,
    "fl_oz": 29.5735,
}

COUNT_CONVERSIONS = {
    "pcs": 1.0,
    "dozen": 12.0,
}


def get_unit_category(unit: str) -> str | None:
    """Determine the category of a unit (mass, volume, count)."""
    unit_lower = unit.lower()
    if unit_lower in MASS_CONVERSIONS:
        return "mass"
    if unit_lower in VOLUME_CONVERSIONS:
        return "volume"
    if unit_lower in COUNT_CONVERSIONS:
        return "count"
    return None


def convert_to_base_unit(
    quantity: float, from_unit: str, to_base_unit: str
) -> float | None:
    """
    Convert a quantity from one unit to the ingredient's base unit.

    Returns None if units are incompatible or unknown.

    Cross-category note: volume ↔ mass conversions are supported using
    density = 1 g/ml (so 1 ml = 1 g, 1 l = 1 kg).
    """
    from_unit_lower = from_unit.lower()
    to_base_lower = to_base_unit.lower()

    # Same unit - no conversion needed
    if from_unit_lower == to_base_lower:
        return quantity

    # Check if both units are in the same category
    from_category = get_unit_category(from_unit_lower)
    to_category = get_unit_category(to_base_lower)

    if from_category is None or to_category is None:
        # Unknown unit - return original quantity
        return quantity

    if from_category != to_category:
        # Allow volume <-> mass conversion using density = 1 g/ml
        if (from_category == "volume" and to_category == "mass") or (
            from_category == "mass" and to_category == "volume"
        ):
            if from_category == "volume":
                # quantity in volume units -> convert to ml -> treat as grams
                in_ml = quantity * VOLUME_CONVERSIONS[from_unit_lower]
                to_factor = MASS_CONVERSIONS.get(to_base_lower, 1.0)
                return in_ml / to_factor
            else:
                # quantity in mass units -> convert to g -> treat as ml
                in_g = quantity * MASS_CONVERSIONS[from_unit_lower]
                to_factor = VOLUME_CONVERSIONS.get(to_base_lower, 1.0)
                return in_g / to_factor
        # Truly incompatible units (e.g., mass to count)
        return None

    # Get conversion maps based on category
    if from_category == "mass":
        conversions = MASS_CONVERSIONS
    elif from_category == "volume":
        conversions = VOLUME_CONVERSIONS
    else:
        conversions = COUNT_CONVERSIONS

    # Convert: from_unit -> standard base -> to_base_unit
    from_factor = conversions.get(from_unit_lower, 1.0)
    to_factor = conversions.get(to_base_lower, 1.0)

    # Convert to standard base, then to target base unit
    standard_quantity = quantity * from_factor
    return standard_quantity / to_factor
