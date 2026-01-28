import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatTimer(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseTimer(value: string): number {
  const parts = value.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return parseInt(value, 10) || 0;
}

interface ParsedIngredientLine {
  quantity: number;
  unit: string;
  ingredientText: string;
  note?: string;
}

const COMMON_UNITS = [
  'g', 'kg', 'mg', 'oz', 'lb', 'ml', 'l', 'cl', 'dl',
  'c', 'cup', 'cups', 'tbsp', 'tsp', 'pint', 'quart',
  'clove', 'cloves', 'stick', 'sticks', 'slice', 'slices',
  'piece', 'pieces', 'whole', 'pinch', 'dash', 'bunch',
  'head', 'bulb', 'can', 'jar', 'package', 'sheet',
];

export function parseIngredientLine(line: string): ParsedIngredientLine | null {
  const trimmed = line.trim();

  // Skip empty lines and headers (lines ending with :)
  if (!trimmed || trimmed.endsWith(':')) {
    return null;
  }

  // Extract note in parentheses if present
  const noteMatch = trimmed.match(/\(([^)]+)\)/);
  const note = noteMatch ? noteMatch[1].trim() : undefined;
  const textWithoutNote = trimmed.replace(/\s*\([^)]*\)\s*/, ' ').trim();

  // Try to extract quantity and unit
  // Matches: "500", "1/2", "0.5", "1.5c", "500g", "1/2 cup", etc.
  const quantityUnitMatch = textWithoutNote.match(
    /^([0-9/.\s]+)(?:\s*([a-zA-Z]+))?\s+(.+)$/
  );

  if (!quantityUnitMatch) {
    // No quantity found, treat entire line as ingredient (e.g., "salt to taste")
    return {
      quantity: 1,
      unit: '',
      ingredientText: textWithoutNote,
      note,
    };
  }

  const quantityStr = quantityUnitMatch[1].replace(/\s+/g, '');
  let unit = (quantityUnitMatch[2] || '').toLowerCase();
  const ingredientText = quantityUnitMatch[3].trim();

  // Convert fraction to decimal
  let quantity = 0;
  if (quantityStr.includes('/')) {
    const [num, denom] = quantityStr.split('/').map(Number);
    quantity = num / denom;
  } else {
    quantity = parseFloat(quantityStr);
  }

  if (isNaN(quantity) || quantity <= 0) {
    return null;
  }

  // Normalize unit to base form
  if (unit) {
    // Plural to singular
    if (unit === 'cups') unit = 'c';
    if (unit === 'tbsps') unit = 'tbsp';
    if (unit === 'tsps') unit = 'tsp';
    if (unit === 'cloves') unit = 'clove';
    if (unit === 'sticks') unit = 'stick';
    if (unit === 'slices') unit = 'slice';
    if (unit === 'pieces') unit = 'piece';

    // Check if it's a valid unit
    if (!COMMON_UNITS.includes(unit)) {
      // If not a known unit, might be part of ingredient name
      unit = '';
    }
  }

  return {
    quantity,
    unit,
    ingredientText,
    note,
  };
}

export function fuzzyMatchIngredient(
  searchText: string,
  ingredients: Array<{ id: number; name: string; [key: string]: unknown }>
): { id: number; name: string; [key: string]: unknown } | null {
  if (!searchText || !ingredients.length) {
    return null;
  }

  const search = searchText.toLowerCase().trim();

  // Exact match (case-insensitive)
  let match = ingredients.find(
    (ing) => ing.name.toLowerCase() === search
  );
  if (match) return match;

  // Starts with match
  match = ingredients.find((ing) =>
    ing.name.toLowerCase().startsWith(search)
  );
  if (match) return match;

  // Contains match - find best match
  const matches = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(search)
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    // Return the shortest match (most specific)
    return matches.reduce((best, current) =>
      current.name.length < best.name.length ? current : best
    );
  }

  // Partial match - check if search is part of ingredient name
  // or ingredient name is part of search
  const partialMatches = ingredients.filter((ing) => {
    const ingName = ing.name.toLowerCase();
    const searchLower = search.toLowerCase();
    const words = searchLower.split(/\s+/);
    return words.some((word) => ingName.includes(word));
  });

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  return null;
}

export function parseIngredientsText(text: string): ParsedIngredientLine[] {
  const lines = text.split('\n');
  const parsed: ParsedIngredientLine[] = [];

  for (const line of lines) {
    const parsed_line = parseIngredientLine(line);
    if (parsed_line) {
      parsed.push(parsed_line);
    }
  }

  return parsed;
}
