/**
 * Unit conversion utilities for the frontend.
 * Mirrors backend logic from backend/app/utils/unit_conversion.py
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
  cl: 10,
  dl: 100,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  fl_oz: 29.5735,
};

const COUNT_CONVERSIONS: Record<string, number> = {
  pcs: 1,
  dozen: 12,
};

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
 * Returns null if units are incompatible (different categories).
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const fromLower = fromUnit.toLowerCase();
  const toLower = toUnit.toLowerCase();

  if (fromLower === toLower) return quantity;

  const fromCategory = getUnitCategory(fromLower);
  const toCategory = getUnitCategory(toLower);

  if (fromCategory === null || toCategory === null) return quantity;
  if (fromCategory !== toCategory) return null;

  const conversions = getConversionsForCategory(fromCategory);
  const fromFactor = conversions[fromLower] ?? 1;
  const toFactor = conversions[toLower] ?? 1;

  const standardQuantity = quantity * fromFactor;
  return standardQuantity / toFactor;
}

/**
 * Convert a unit price from one unit to another (inverse of quantity conversion).
 * E.g. $0.01/g → $10.00/kg (price goes up as unit gets larger).
 * Returns null if units are incompatible (different categories).
 */
export function convertUnitPrice(price: number, fromUnit: string, toUnit: string): number | null {
  const fromLower = fromUnit.toLowerCase();
  const toLower = toUnit.toLowerCase();

  if (fromLower === toLower) return price;

  const fromCategory = getUnitCategory(fromLower);
  const toCategory = getUnitCategory(toLower);

  if (fromCategory === null || toCategory === null) return price;
  if (fromCategory !== toCategory) return null;

  const conversions = getConversionsForCategory(fromCategory);
  const fromFactor = conversions[fromLower] ?? 1;
  const toFactor = conversions[toLower] ?? 1;

  // Inverse of quantity: larger unit = higher price per unit
  return price * (toFactor / fromFactor);
}

/**
 * Get all units compatible with the given unit (same category).
 */
export function getCompatibleUnits(unit: string): string[] {
  const category = getUnitCategory(unit.toLowerCase());
  if (!category) return [unit];
  return Object.keys(getConversionsForCategory(category));
}
