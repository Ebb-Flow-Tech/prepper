import { test as setup, expect } from '@playwright/test';
import fs from 'fs';

const USER_AUTH_FILE = 'e2e/.auth/user.json';
const ADMIN_AUTH_FILE = 'e2e/.auth/admin.json';
const MANAGER_AUTH_FILE = 'e2e/.auth/manager.json';

// Inject auth state directly into localStorage to avoid depending on login UI.
// Each test user must exist in the backend before running tests, AND — since Prepper's access
// is now derived entirely from Passport (fail closed) — each user's Passport projection must be
// seeded in the backend too: an identity_link, an active membership, an entitlement, a brand
// unit with app access, and (for a plain brand user) a unit_app_membership. See
// backend/tests/conftest.py for the exact chain. This harness talks to the live API only; it
// does not write those rows itself, so the backend test environment is responsible for them.
//
//   - Admin user  → org Admin (Manager at every brand via the ladder).
//   - Manager user → holds Manager at ONE brand (brand-scoped; no global flag exists any more).
//   - Normal user  → holds Staff at a brand (read/limited).
//
// Set credentials via env vars:
//   TEST_USER_EMAIL / TEST_USER_PASSWORD
//   TEST_MANAGER_EMAIL / TEST_MANAGER_PASSWORD  (holds Manager at a brand in Passport)
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
//   TEST_API_URL (default: http://localhost:8000/api/v1)

// The stored auth shape carries NO role — it mirrors the app's `StoredAuth` (src/lib/store.tsx).
interface AuthResult {
  userId: string;
  jwt: string;
  refreshToken: string;
  username: string;
  email: string;
}

async function loginViaApi(
  email: string,
  password: string,
  apiUrl: string
): Promise<AuthResult> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      `Login failed for ${email}: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  return {
    userId: data.user.id,
    jwt: data.access_token,
    refreshToken: data.refresh_token,
    username: data.user.username,
    email: data.user.email,
  };
}

/** Seed minimum data required so tests don't skip. Idempotent — safe to run multiple times. */
async function seedUserData(
  jwt: string,
  apiUrl: string,
  userEmail: string
): Promise<{ recipeId: number; sessionId: number; ingredientId: number; supplierId?: number } | null> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };

  // ── 1. Ensure at least one recipe exists ──────────────────────────────────
  const recipesRes = await fetch(`${apiUrl}/recipes?page=1&page_size=1`, { headers });
  const recipesData = await recipesRes.json();
  let recipeId: number;

  if (recipesData.items?.length > 0) {
    recipeId = recipesData.items[0].id;
    console.log(`[seed] Using existing recipe id=${recipeId}`);
  } else {
    const createRes = await fetch(`${apiUrl}/recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'E2E Seed Recipe', status: 'draft' }),
    });
    if (!createRes.ok) {
      console.warn(`[seed] Could not create recipe: ${createRes.status} ${await createRes.text()}`);
      return null;
    }
    const recipe = await createRes.json();
    recipeId = recipe.id;
    console.log(`[seed] Created recipe id=${recipeId}`);
  }

  // ── 2. Ensure at least one tasting session exists ─────────────────────────
  const sessionsRes = await fetch(`${apiUrl}/tasting-sessions?page=1&page_size=1`, { headers });
  const sessionsData = await sessionsRes.json();
  let sessionId: number;

  if ((sessionsData.items?.length ?? 0) === 0) {
    const today = new Date().toISOString().split('T')[0];
    const createRes = await fetch(`${apiUrl}/tasting-sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'E2E Seed Session', date: today, attendees: [userEmail] }),
    });
    if (!createRes.ok) {
      console.warn(`[seed] Could not create tasting session: ${createRes.status}`);
      return null;
    }
    const session = await createRes.json();
    sessionId = session.id;
    console.log(`[seed] Created tasting session id=${sessionId}`);

    // Add recipe to session so tasting note detail tests can run
    const linkRes = await fetch(`${apiUrl}/tasting-sessions/${sessionId}/recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ recipe_id: recipeId }),
    });
    if (linkRes.ok) {
      console.log(`[seed] Linked recipe ${recipeId} to session ${sessionId}`);
    } else {
      console.warn(`[seed] Could not link recipe to session: ${linkRes.status}`);
    }
  } else {
    sessionId = sessionsData.items[0].id;
    console.log(`[seed] Using existing tasting session id=${sessionId}`);
    // Ensure current user is a participant in the existing session
    await fetch(`${apiUrl}/tasting-sessions/${sessionId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ attendees: [userEmail] }),
    });
  }

  // ── 3. Ensure at least one ingredient exists ─────────────────────────────
  const ingrRes = await fetch(`${apiUrl}/ingredients?page=1&page_size=1`, { headers });
  const ingrData = await ingrRes.json();
  let ingredientId: number;

  if (ingrData.items?.length > 0) {
    ingredientId = ingrData.items[0].id;
    console.log(`[seed] Using existing ingredient id=${ingredientId}`);
  } else {
    const createRes = await fetch(`${apiUrl}/ingredients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'E2E Seed Ingredient' }),
    });
    if (!createRes.ok) {
      console.warn(`[seed] Could not create ingredient: ${createRes.status} ${await createRes.text()}`);
      return { recipeId, sessionId, ingredientId: 0 };
    }
    const ing = await createRes.json();
    ingredientId = ing.id;
    console.log(`[seed] Created ingredient id=${ingredientId}`);
  }

  // ── 4. Ensure at least one supplier exists ────────────────────────────────
  const suppliersRes = await fetch(`${apiUrl}/suppliers?page=1&page_size=1`, { headers });
  const suppliersData = await suppliersRes.json();
  let supplierId: number;

  if (suppliersData.items?.length > 0) {
    supplierId = suppliersData.items[0].id;
    console.log(`[seed] Using existing supplier id=${supplierId}`);
  } else {
    const createRes = await fetch(`${apiUrl}/suppliers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'E2E Seed Supplier' }),
    });
    if (!createRes.ok) {
      console.warn(`[seed] Could not create supplier: ${createRes.status} ${await createRes.text()}`);
      return { recipeId, sessionId, ingredientId };
    }
    const supplier = await createRes.json();
    supplierId = supplier.id;
    console.log(`[seed] Created supplier id=${supplierId}`);
  }

  return { recipeId, sessionId, ingredientId, supplierId };
}

interface PassportBrand {
  id: string;
  name: string;
  organization_id: string;
  my_role: 'Manager' | 'Staff' | null;
}

/** Seed admin-only data (a menu at a Passport brand). Idempotent.
 *
 * Structure (brands/outlets) and roles are Passport's now — there is no `/outlets` endpoint and
 * no user role flags to set. The admin is an org Admin, so they hold Manager at every brand of
 * their org via the ladder; we just pick the first brand Passport projects for them and attach a
 * menu to it. Access itself is seeded in the backend (the Passport projection), not here.
 */
async function seedAdminData(
  jwt: string,
  apiUrl: string,
): Promise<{ unitId: string; menuId: number } | null> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };

  // ── 1. Resolve a brand the admin manages (from the Passport projection) ──
  const brandsRes = await fetch(`${apiUrl}/passport/brand-roles/brands`, { headers });
  const brands: PassportBrand[] = brandsRes.ok ? await brandsRes.json() : [];
  if (brands.length === 0) {
    console.warn('[seed] No Passport brands available for the admin — cannot seed a menu.');
    return null;
  }
  const unitId = brands[0].id;
  console.log(`[seed] Using Passport brand unit id=${unitId} (${brands[0].name})`);

  // ── 2. Ensure a menu exists and is associated with that brand unit ───────
  const menusRes = await fetch(`${apiUrl}/menus`, { headers });
  const menus: { id: number }[] = menusRes.ok ? await menusRes.json() : [];
  let menuId: number;

  if (menus.length > 0) {
    menuId = menus[0].id;
    console.log(`[seed] Using existing admin menu id=${menuId}`);
    // Ensure it's associated with the brand unit
    await fetch(`${apiUrl}/menus/${menuId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ unit_ids: [unitId] }),
    });
  } else {
    const createRes = await fetch(`${apiUrl}/menus`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'E2E Seed Menu',
        is_published: false,
        unit_ids: [unitId],
        sections: [],
      }),
    });
    if (!createRes.ok) {
      console.warn(`[seed] Could not create menu: ${createRes.status} ${await createRes.text()}`);
      menuId = 0;
    } else {
      const menu = await createRes.json();
      menuId = menu.id;
      console.log(`[seed] Created admin menu id=${menuId}`);
    }
  }

  // Write menu seed for preview tests (manager project reads this)
  if (menuId) {
    fs.mkdirSync('e2e/.auth', { recursive: true });
    fs.writeFileSync('e2e/.auth/seed-manager-data.json', JSON.stringify({ menuId }, null, 2));
    console.log(`[seed] Wrote seed-manager-data.json: menuId=${menuId}`);
  }

  return { unitId, menuId };
}

setup('authenticate as normal user', async ({ page }) => {
  const apiUrl = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';
  const email = process.env.TEST_USER_EMAIL || 'testuser@prepper.test';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

  const auth = await loginViaApi(email, password, apiUrl);

  // Seed minimum data so detail/canvas tests don't all skip
  const seedData = await seedUserData(auth.jwt, apiUrl, auth.email);
  if (seedData) {
    fs.mkdirSync('e2e/.auth', { recursive: true });
    const userSeedPayload = { ...seedData, userId: auth.userId };
    fs.writeFileSync('e2e/.auth/seed-user-data.json', JSON.stringify(userSeedPayload, null, 2));
    console.log(`[seed] Wrote seed-user-data.json: recipeId=${seedData.recipeId} sessionId=${seedData.sessionId} ingredientId=${seedData.ingredientId}`);
  }

  await page.goto('/');
  await page.evaluate((authData) => {
    localStorage.setItem('prepper_auth', JSON.stringify(authData));
  }, auth);

  // Verify auth works by navigating to a protected page
  await page.goto('/recipes');
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: USER_AUTH_FILE });
});

setup('authenticate as manager user', async ({ page }) => {
  const apiUrl = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';
  const email = process.env.TEST_MANAGER_EMAIL || 'manager@prepper.test';
  const password = process.env.TEST_MANAGER_PASSWORD || 'managerpassword123';

  // This user holds Manager at a brand in Passport (seeded in the backend). Prepper has no local
  // role flag to set, so there is nothing to promote here — just sign in.
  const auth = await loginViaApi(email, password, apiUrl);

  await page.goto('/');
  await page.evaluate((authData) => {
    localStorage.setItem('prepper_auth', JSON.stringify(authData));
  }, auth);

  await page.goto('/menu');
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: MANAGER_AUTH_FILE });
});

setup('authenticate as admin user', async ({ page }) => {
  const apiUrl = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';
  const email = process.env.TEST_ADMIN_EMAIL || 'admin@prepper.test';
  const password = process.env.TEST_ADMIN_PASSWORD || 'adminpassword123';

  const auth = await loginViaApi(email, password, apiUrl);

  // Seed admin-only data: a menu attached to a Passport brand the admin manages
  const adminSeedData = await seedAdminData(auth.jwt, apiUrl);
  if (adminSeedData) {
    fs.mkdirSync('e2e/.auth', { recursive: true });
    fs.writeFileSync('e2e/.auth/seed-admin-data.json', JSON.stringify(adminSeedData, null, 2));
    console.log(`[seed] Wrote seed-admin-data.json: unitId=${adminSeedData.unitId} menuId=${adminSeedData.menuId ?? 'n/a'}`);
  }

  await page.goto('/');
  await page.evaluate((authData) => {
    localStorage.setItem('prepper_auth', JSON.stringify(authData));
  }, auth);

  await page.goto('/recipes');
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
