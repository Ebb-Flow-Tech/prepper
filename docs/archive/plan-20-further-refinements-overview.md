# Plan 20: Further Refinements — Overview

## Context

This plan reorganises the top navigation from a flat list into grouped dropdown menus, collapses previously standalone routes into tabs within their parent group pages, adds two new content sections, and introduces a product-level tagging system for supplier ingredients.

Work is split into three sequential parts. Complete and verify each before starting the next.

---

## New Top Bar Structure

All sub-items within a group become **tabs on a single page** — they no longer live at their own top-level routes.

| Group | Tab | Content / Previously at |
|-------|-----|--------------------------|
| **Drafts** | Draft Menus | `/menu-sketch` (unchanged, only one sub-item) |
| **Recipes** | Recipes | `/recipes` (existing recipes tab) |
| **Recipes** | Menus | `/recipes` menus tab — content from `/menu` |
| **Ingredients** | Products | `/ingredients` products tab — new (Part 2) |
| **Ingredients** | Ingredients | `/ingredients` ingredients tab (existing) |
| **Ingredients** | Tags | `/ingredients` categories tab, **renamed** from Categories |
| **Ingredients** | Suppliers | `/ingredients` suppliers tab — content from `/suppliers` |
| **Ingredients** | Allergens | `/ingredients` allergens tab (existing) |
| **R&D** | Tastings | `/rnd` tastings tab — content from `/tastings` |
| **R&D** | Pipelines | `/rnd` pipelines tab (existing rnd content) |
| **Reports** | Finance | `/finance` (only one sub-item, direct link) |
| **Settings** | Users | `/settings` users tab — new (Part 2) |
| **Settings** | Outlets | `/settings` outlets tab — content from `/outlets` |
| **Settings** | Admin | `/settings` admin tab — content from `/admin/users` |
| **Settings** | Design | `/settings` design tab — content from `/design-system` |

> Detail pages (`/outlets/[id]`, `/suppliers/[id]`, etc.) keep their existing routes and are still reachable via in-page navigation.

---

## Parts Summary

### Part 1 — Top Bar Re-routing
- Rebuild `TopNav.tsx` with grouped dropdown navigation
- Modify `/recipes` page: add a Menus tab (embed existing `/menu` content)
- Modify `/ingredients` page: add a Suppliers tab (embed existing `/suppliers` content); rename Categories tab → Tags
- Modify `/rnd` page: add a Tastings tab (embed existing `/tastings` content); existing rnd content becomes the Pipelines tab
- Create `/settings` page with four tabs: Outlets (embed `/outlets` content), Admin (embed `/admin/users` content), Design (embed `/design-system` content), Users (stub — to be built in Part 2)
- No new data, no new components beyond tab wiring

### Part 2 — New Content Tabs
- **Products tab** on `/ingredients`: paginated table sourced from `supplier_ingredients`; columns: Product Name, Ingredient (tag/category), SKU, Supplier, Unit, Price — omit Tags column for now; clickable cells navigate to their detail pages
- **Users tab** on `/settings`: table showing name, email, role (admin/non-admin), manager flag for all users
- No new database tables or migrations

### Part 3 — Product Tags
- New DB tables: `supplier_ingredients_tags` and `supplier_ingredients_supplier_ingredients_tag` (many-to-many); modelled after the existing `categories` implementation
- Alembic migrations for both tables
- Backend CRUD REST endpoints + unit tests
- Frontend: add Tags column to the Products tab; modal to manage tags per supplier ingredient

---

## Critical Files

| File | Parts |
|------|-------|
| `frontend/src/components/layout/TopNav.tsx` | 1 |
| `frontend/src/app/recipes/page.tsx` | 1 |
| `frontend/src/app/ingredients/page.tsx` | 1, 2 |
| `frontend/src/app/rnd/page.tsx` | 1 |
| `frontend/src/app/settings/page.tsx` | 1 (new), 2 |
| `backend/app/models/supplier_ingredient_tag.py` | 3 (new) |
| `backend/app/domain/supplier_ingredient_tag_service.py` | 3 (new) |
| `backend/app/api/supplier_ingredient_tags.py` | 3 (new) |
| `backend/alembic/versions/<migration>.py` | 3 (new) |
| `frontend/src/lib/hooks/useSupplierIngredientTags.ts` | 3 (new) |
| `frontend/src/lib/api.ts` | 2, 3 |
