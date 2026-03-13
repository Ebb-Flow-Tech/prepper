/**
 * Unit conversion utilities for the frontend.
 * Mirrors backend logic from backend/app/utils/unit_conversion.py
 *
 * Cross-category mass↔volume conversions use the approximation 1g = 1ml
 * (water density). This is a cooking-practical approximation for liquids.
 */

const MASS_CONVERSIONS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_CONVERSIONS: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  fl_oz: 29.5735,
};

const COUNT_CONVERSIONS: Record<string, number> = {
  pcs: 1,
  dozen: 12,
};

// Cross-category extras shown in the unit dropdown
// For a mass unit, also show these volume units (and vice versa)
const MASS_CROSS_UNITS = ['ml', 'l'] as const;
const VOLUME_CROSS_UNITS = ['g', 'kg'] as const;

type UnitCategory = 'mass' | 'volume' | 'count';

function getUnitCategory(unit: string): UnitCategory | null {
  const lower = unit.toLowerCase();
  if (lower in MASS_CONVERSIONS) return 'mass';
  if (lower in VOLUME_CONVERSIONS) return 'volume';
  if (lower in COUNT_CONVERSIONS) return 'count';
  return null;
}

function getConversionsForCategory(category: UnitCategory): Record<string, number> {
  switch (category) {
    case 'mass': return MASS_CONVERSIONS;
    case 'volume': return VOLUME_CONVERSIONS;
    case 'count': return COUNT_CONVERSIONS;
  }
}

/**
 * Convert a quantity from one unit to another.
 * Same-category conversions are exact. Mass↔volume uses 1g = 1ml.
 * Returns null only for unrecognised units.
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const fromLower = fromUnit.toLowerCase();
  const toLower = toUnit.toLowerCase();

  if (fromLower === toLower) return quantity;

  const fromCategory = getUnitCategory(fromLower);
  const toCategory = getUnitCategory(toLower);

  if (fromCategory === null || toCategory === null) return quantity;

  // Same-category conversion
  if (fromCategory === toCategory) {
    const conversions = getConversionsForCategory(fromCategory);
    const fromFactor = conversions[fromLower] ?? 1;
    const toFactor = conversions[toLower] ?? 1;
    return (quantity * fromFactor) / toFactor;
  }

  // Cross-category mass↔volume: treat 1g = 1ml
  if (
    (fromCategory === 'mass' && toCategory === 'volume') ||
    (fromCategory === 'volume' && toCategory === 'mass')
  ) {
    const fromConversions = getConversionsForCategory(fromCategory);
    const toConversions = getConversionsForCategory(toCategory);
    const fromFactor = fromConversions[fromLower] ?? 1;
    const toFactor = toConversions[toLower] ?? 1;
    // Convert to base unit (g or ml), then across (1g=1ml), then to target unit
    return (quantity * fromFactor) / toFactor;
  }

  return null;
}

/**
 * Convert a unit price from one unit to another (inverse of quantity conversion).
 * E.g. $0.01/g → $10.00/kg (price goes up as unit gets larger).
 * Mass↔volume uses 1g = 1ml.
 */
export function convertUnitPrice(price: number, fromUnit: string, toUnit: string): number | null {
  const fromLower = fromUnit.toLowerCase();
  const toLower = toUnit.toLowerCase();

  if (fromLower === toLower) return price;

  const fromCategory = getUnitCategory(fromLower);
  const toCategory = getUnitCategory(toLower);

  if (fromCategory === null || toCategory === null) return price;

  // Same-category: inverse of quantity conversion
  if (fromCategory === toCategory) {
    const conversions = getConversionsForCategory(fromCategory);
    const fromFactor = conversions[fromLower] ?? 1;
    const toFactor = conversions[toLower] ?? 1;
    return price * (toFactor / fromFactor);
  }

  // Cross-category mass↔volume: treat 1g = 1ml (inverse of quantity)
  if (
    (fromCategory === 'mass' && toCategory === 'volume') ||
    (fromCategory === 'volume' && toCategory === 'mass')
  ) {
    const fromConversions = getConversionsForCategory(fromCategory);
    const toConversions = getConversionsForCategory(toCategory);
    const fromFactor = fromConversions[fromLower] ?? 1;
    const toFactor = toConversions[toLower] ?? 1;
    return price * (toFactor / fromFactor);
  }

  return null;
}

/**
 * Get all units compatible with the given unit.
 * For mass units, also includes ml/l. For volume units, also includes g/kg.
 */
export function getCompatibleUnits(unit: string): string[] {
  const category = getUnitCategory(unit.toLowerCase());
  if (!category) return [unit];
  const same = Object.keys(getConversionsForCategory(category));
  if (category === 'mass') return [...same, ...MASS_CROSS_UNITS];
  if (category === 'volume') return [...same, ...VOLUME_CROSS_UNITS];
  return same;
}
