# Plan 20 Part 1: Top Bar Re-routing

## Goal

Restructure the top navigation from a flat item list into grouped dropdown menus. Previously standalone routes become tabs within their parent group pages. No new data or non-trivial components are introduced.

---

## 1. TopNav Redesign

**File:** `frontend/src/components/layout/TopNav.tsx`

Replace `NAV_ITEMS: NavItem[]` with a grouped structure:

```ts
interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: { label: string; href: string; tab?: string; adminOnly?: boolean }[];
}
```

Group definitions:

| Group label | Icon | Sub-items (label → href, optional tab param) |
|-------------|------|-----------------------------------------------|
| Drafts | `NotebookPen` | Draft Menus → `/menu-sketch` |
| Recipes | `BookOpen` | Recipes → `/recipes`, Menus → `/recipes?tab=menus` |
| Ingredients | `Package` | Products → `/ingredients?tab=products`, Ingredients → `/ingredients?tab=ingredients`, Tags → `/ingredients?tab=tags`, Suppliers → `/ingredients?tab=suppliers`, Allergens → `/ingredients?tab=allergens` |
| R&D | `FlaskConical` | Tastings → `/rnd?tab=tastings`, Pipelines → `/rnd?tab=pipelines` |
| Reports | `DollarSign` | Finance → `/finance` |
| Settings | `Settings` | Users → `/settings?tab=users`, Outlets → `/settings?tab=outlets`, Admin → `/settings?tab=admin` *(adminOnly)*, Design → `/settings?tab=design` |

**Rendering behaviour:**
- Each group renders as a button with a down-arrow indicator
- On hover (desktop) or click (mobile), it opens a dropdown showing the sub-items
- A sub-item is "active" when the current pathname starts with the group's primary route AND (if a tab param exists) the current tab query param matches
- Clicking a sub-item navigates to its `href` (including `?tab=` query param)
- Preserve existing unsaved-changes guard logic (`canvasHasUnsavedChanges`)

**Mobile:** keep the existing accordion/flyout pattern but grouped by section.

---

## 2. Recipes Page — Add Menus Tab

**File:** `frontend/src/app/recipes/page.tsx`

- Read `tab` from `useSearchParams()`; default to `recipes`
- Add a `menus` tab that renders the existing `<MenuListPage>` content (currently at `/menu/page.tsx`) inline
- Tab bar: `Recipes | Menus`
- The URL updates to `?tab=menus` on tab switch (use `router.push` or `router.replace`)

> The `/menu` route can remain for direct links but is no longer in the top nav.

---

## 3. Ingredients Page — Add Suppliers Tab + Rename Categories → Tags

**File:** `frontend/src/app/ingredients/page.tsx`

### 3a. Rename tab label

In `INGREDIENT_TABS`:
```ts
// Before
{ id: 'categories', label: 'Categories' }
// After
{ id: 'categories', label: 'Tags' }
```

(The `id` stays `'categories'` to avoid touching store types; only the display label changes.)

### 3b. Add Suppliers tab

- Add `{ id: 'suppliers', label: 'Suppliers' }` to `INGREDIENT_TABS`
- When the suppliers tab is active, render the existing `<SuppliersPage>` content (currently at `/suppliers/page.tsx`) inline
- Tab activation driven by `?tab=` query param (same pattern as the Menus tab above)

> `/suppliers` route remains for direct links and detail page navigation.

### 3c. Tab param sync

Read `searchParams.get('tab')` on mount; set `useAppState().ingredientTab` accordingly. On tab switch, push `?tab=<id>` to the URL.

---

## 4. R&D Page — Add Tastings Tab

**File:** `frontend/src/app/rnd/page.tsx`

- Add tab bar: `Pipelines | Tastings`
- Existing rnd content becomes the **Pipelines** tab
- Tastings tab renders the existing `<TastingsPage>` content (from `/tastings/page.tsx`) inline
- Read/write active tab via `?tab=` query param; default to `pipelines`

> `/tastings` route and all its sub-routes (`/tastings/[id]`, etc.) remain for direct navigation.

---

## 5. Settings Page — New Shell

**File:** `frontend/src/app/settings/page.tsx` *(new file)*

Create a page with four tabs: `Users | Outlets | Admin | Design`

- **Outlets tab:** render the existing `<OutletsPage>` content (from `/outlets/page.tsx`) inline
- **Admin tab:** render the existing `<AdminUsersPage>` content (from `/admin/users/page.tsx`) inline; mark `adminOnly` — non-admin users see a 403/access-denied message
- **Design tab:** render the existing `<DesignSystemPage>` content (from `/design-system/page.tsx`) inline
- **Users tab:** render a stub ("Coming in Part 2") for now
- Active tab driven by `?tab=` query param; default to `users`
- Protect the entire page with `<AuthGuard>`

> `/outlets/[id]` and other detail routes are unaffected.

---

## Verification

1. All existing pages are still accessible via their original routes (no broken links).
2. TopNav renders grouped dropdowns; correct sub-item is highlighted based on pathname + tab param.
3. Renaming Categories → Tags in the Ingredients page tab bar.
4. Suppliers, Tastings, Outlets, Admin, Design content is accessible via its new tab location.
5. `npm run build` and `npm run lint` pass with no errors.
