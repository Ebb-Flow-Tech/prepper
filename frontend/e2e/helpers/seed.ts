/**
 * Helpers for reading seed data written by global.setup.ts.
 * Each read* function returns null if the file is missing or invalid — callers
 * should use test.skip() when the data they need is absent.
 */
import fs from 'fs';

export interface SeedUserData {
  recipeId: number;
  sessionId: number;
  ingredientId?: number;
  supplierId?: number;
}

export interface SeedAdminData {
  /** A Passport brand unit UUID the seed user manages — replaces the old local outletId. */
  unitId: string;
  menuId?: number;
}

export interface SeedManagerData {
  menuId: number;
}

export function readSeedUserData(): SeedUserData | null {
  try {
    return JSON.parse(fs.readFileSync('e2e/.auth/seed-user-data.json', 'utf-8'));
  } catch {
    return null;
  }
}

export function readSeedAdminData(): SeedAdminData | null {
  try {
    return JSON.parse(fs.readFileSync('e2e/.auth/seed-admin-data.json', 'utf-8'));
  } catch {
    return null;
  }
}

export function readSeedManagerData(): SeedManagerData | null {
  try {
    return JSON.parse(fs.readFileSync('e2e/.auth/seed-manager-data.json', 'utf-8'));
  } catch {
    return null;
  }
}
