# Plan 09: Role-Based Permission Controls

**Status**: In Progress
**Priority**: High
**Dependencies**: User authentication, `is_manager` field, outlet hierarchy
**Owner**: Engineering

---

## Overview

Enforce role-based UI permissions across all frontend pages. Three permission tiers: **Admin** (full access), **Manager** (partial edit), **Non-manager** (read-only). The backend already validates permissions via `get_current_user`; this plan focuses on hiding/showing UI elements to match.

---

## Permission Tiers

| Role | `userType` | `isManager` | Access Level |
|------|-----------|-------------|--------------|
| Admin | `admin` | — | Full CRUD everywhere |
| Manager | `normal` | `true` | Can create/edit recipes, CRUD supplier-ingredient links, manage menus |
| Non-manager | `normal` | `false` | Read-only on most pages, can participate in tastings |

---

## Areas of Permissions

### Outlets

- [ ] `/outlets`
    - [ ] Admins
        - [ ] Can see all outlets
        - [ ] Can edit and archive outlets
        - [ ] Can add new outlet
    - [ ] Non-admins
        - [ ] Can see only assigned outlets
        - [ ] Cannot archive or edit outlets — hoverable options will NOT appear
        - [ ] Cannot add new outlets — Add Outlet button should NOT appear

### Menu

- [x] `/menu`
    - [x] Admin
        - [x] Can add menu
        - [x] Can archive/restore menu
    - [x] Non-admins
        - [x] Managers
            - [x] Can only see menus: the ones they own or the ones in their outlets
            - [x] Can archive/restore menus
        - [x] Non-managers
            - [x] Can only see menus: the ones they own or the ones in their outlets
- [x] `/menu/edit/[id]`
    - [x] Admin, managers
        - [x] Can access
    - [x] Everyone else
        - [x] CANNOT access
- [x] `/menu/view/[id]`
    - [x] Admin, managers, owners
        - [x] Can access
    - [x] Non-admin non-owners and outsiders (not within associated outlets)
        - [x] CANNOT access

### Ingredients

- [ ] `/ingredients`
    - [ ] Ingredients tab
        - [ ] Admins
            - [ ] Can add
            - [ ] Can edit/archive/restore
        - [ ] Non-admins
            - [ ] Readonly — UI to add, archive, restore, edit are NOT there
    - [ ] Categories tab
        - [ ] Admins
            - [ ] Can add
            - [ ] Can edit/archive/restore
        - [ ] Non-admins
            - [ ] Readonly — UI to add, archive, restore, edit are NOT there
    - [ ] Allergens tab
        - [ ] Admins
            - [ ] Can add
            - [ ] Can edit/archive/restore
        - [ ] Non-admins
            - [ ] Readonly — UI to add, archive, restore, edit are NOT there
- [ ] `/ingredients/[id]`
    - [ ] Admins
        - [ ] Can edit everything
    - [ ] Non-admins
        - [ ] Managers
            - [ ] READONLY the ingredient info
            - [ ] Can CRUD suppliers
        - [ ] Non-managers
            - [ ] Everything (ingredients and suppliers) are read only — UI to add, edit and delete are NOT there

### Suppliers

- [ ] `/suppliers`
    - [ ] Admins
        - [ ] Can edit everything
    - [ ] Non-admins
        - [ ] Readonly — UI to add, edit and delete are NOT there
- [ ] `/suppliers/[id]`
    - [ ] Admins
        - [ ] Can CRUD everything
    - [ ] Non-admins
        - [ ] Managers
            - [ ] Readonly — for the supplier info (first tab)
            - [ ] CRUD — ONLY for ingredients
        - [ ] Non-managers
            - [ ] Whole page is readonly

### Recipes

- [ ] `/recipes`
    - [ ] Recipes tab
        - [ ] Admins
            - [ ] Can add
        - [ ] Non-admins
            - [ ] Managers
                - [ ] Can add
            - [ ] Non-managers
                - [ ] Cannot add — "New Recipe" does NOT appear
    - [ ] Category management
        - [ ] Admins
            - [ ] Can CRUD
        - [ ] Non-admins
            - [ ] Readonly
- [ ] `/recipes/[id]`
    - [ ] Canvas tab
        - [ ] Admins/managers — can save
        - [ ] Non-managers — CANNOT save
    - [ ] Overview tab
        - [ ] Admin/managers — can interact with recipe
    - [ ] Ingredients tab
        - [ ] Whole thing readonly
    - [ ] Outlets tab
        - [ ] Admins — can add
        - [ ] Managers — readonly
    - [ ] Instructions
        - [ ] Admins & managers — can add/edit
        - [ ] Non-managers — readonly
    - [ ] Tasting — no change
    - [ ] Iterations — no change
- [ ] `/recipes/new`
    - [ ] Admins — accessible
    - [ ] Non-admins
        - [ ] Managers — accessible
        - [ ] Non-managers — inaccessible

### Tastings

- We assume anyone who has an account can make a tasting session
- No permission changes needed

### R&D

- [ ] Admins + managers — can read + edit + interact
- [ ] Non-managers — readonly for all

### Admin

- [ ] `/admin/users` — only admin users can see this (already implemented)

---

## Implementation Steps

### Phase 1: Outlets

- [ ] `/outlets` — hide Add Outlet button for non-admins
- [ ] `/outlets` — hide edit/archive hover actions for non-admins
- [ ] `/outlets` — filter to assigned outlets only for non-admins
- [ ] `/outlets/[id]` — hide EditableCell, parent outlet selector, Add Recipe button for non-admins

### Phase 2: Ingredients

- [ ] `/ingredients` — Ingredients tab: hide Add, archive, restore, edit UI for non-admins
- [ ] `/ingredients` — Categories tab: hide Add, archive, restore, edit UI for non-admins
- [ ] `/ingredients` — Allergens tab: hide Add, archive, restore, edit UI for non-admins
- [ ] `/ingredients/[id]` — make ingredient fields readonly for non-admins
- [ ] `/ingredients/[id]` — managers: readonly ingredients, CRUD suppliers
- [ ] `/ingredients/[id]` — non-managers: everything readonly

### Phase 3: Suppliers

- [ ] `/suppliers` — hide Add, edit, delete UI for non-admins
- [ ] `/suppliers/[id]` — admins: full CRUD
- [ ] `/suppliers/[id]` — managers: readonly supplier info, CRUD ingredients only
- [ ] `/suppliers/[id]` — non-managers: whole page readonly

### Phase 4: Recipes

- [ ] `/recipes` — hide "New Recipe" for non-managers
- [ ] `/recipes` — category management readonly for non-admins
- [ ] `/recipes/[id]` — Canvas tab: hide save for non-managers
- [ ] `/recipes/[id]` — Overview tab: readonly for non-managers
- [ ] `/recipes/[id]` — Ingredients tab: readonly for all non-admins
- [ ] `/recipes/[id]` — Outlets tab: hide add for non-admins
- [ ] `/recipes/[id]` — Instructions: readonly for non-managers
- [ ] `/recipes/new` — block access for non-managers (redirect)

### Phase 5: R&D

- [ ] `/rnd` — readonly for non-managers
- [ ] `/rnd/r/[recipeId]` — readonly for non-managers

---

## Acceptance Criteria

### Admin (`user_type = 'admin'`)

- [x] Can access `/admin/users`
- [ ] **Outlets**: Can see all outlets, Add Outlet button, edit/archive hover actions
- [ ] **Ingredients**: Can add/edit/archive/restore on all tabs
- [ ] **Ingredients detail**: Can edit ingredient info and CRUD suppliers
- [ ] **Suppliers**: Can add/edit/delete on supplier list
- [ ] **Suppliers detail**: Full CRUD on supplier info and ingredients
- [ ] **Recipes**: Can see "New Recipe" button, can edit category management
- [ ] **Recipes detail**: Can save on canvas, edit overview/instructions, add outlets
- [ ] **Recipes new**: Can access `/recipes/new`
- [ ] **R&D**: Can read, edit, and interact with R&D workspace

### Manager (`user_type = 'normal'`, `is_manager = true`)

- [ ] **Outlets**: Can only see assigned outlets; Add Outlet button is hidden; edit/archive hover actions are hidden
- [ ] **Ingredients**: No add/edit/archive/restore controls on any tab
- [ ] **Ingredients detail**: Ingredient info is readonly; can CRUD suppliers
- [ ] **Suppliers**: No add/edit/delete controls on supplier list
- [ ] **Suppliers detail**: Supplier info is readonly; can CRUD ingredients
- [ ] **Recipes**: Can see "New Recipe" button; category management is readonly
- [ ] **Recipes detail**: Can save on canvas, edit overview/instructions; cannot add outlets
- [ ] **Recipes new**: Can access `/recipes/new`
- [ ] **R&D**: Can read, edit, and interact with R&D workspace
- [ ] **Admin**: Cannot access `/admin/users`

### Non-Manager (`user_type = 'normal'`, `is_manager = false`)

- [ ] **Outlets**: Can only see assigned outlets; Add Outlet button is hidden; edit/archive hover actions are hidden
- [ ] **Ingredients**: No add/edit/archive/restore controls on any tab
- [ ] **Ingredients detail**: Everything is fully readonly (ingredient info and suppliers)
- [ ] **Suppliers**: No add/edit/delete controls on supplier list
- [ ] **Suppliers detail**: Whole page is fully readonly
- [ ] **Recipes**: "New Recipe" button is hidden; category management is readonly
- [ ] **Recipes detail**: Cannot save on canvas; overview/instructions are readonly; cannot add outlets
- [ ] **Recipes new**: Redirected away from `/recipes/new`
- [ ] **R&D**: Readonly workspace; cannot edit or interact with R&D recipe details
- [ ] **Admin**: Cannot access `/admin/users`

---

## End-to-End Testing Instructions

### Prerequisites

1. Start the backend: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0`
2. Start the frontend: `cd frontend && npm run dev`
3. Prepare three test accounts:
   - **Admin**: `user_type = 'admin'` (full access)
   - **Manager**: `user_type = 'normal'`, `is_manager = true` (partial edit)
   - **Non-manager**: `user_type = 'normal'`, `is_manager = false` (read-only)

### Test Matrix

Log in as each role and verify the following. Use ✅ for pass, ❌ for fail.

#### Outlets

| Test Case | Admin | Manager | Non-Manager |
|-----------|-------|---------|-------------|
| `/outlets` — "Add Outlet" button visible | ✅ Yes | ❌ No | ❌ No |
| `/outlets` — hover over outlet card shows edit/archive | ✅ Yes | ❌ No | ❌ No |
| `/outlets` — sees all outlets | ✅ Yes | ❌ Only assigned | ❌ Only assigned |
| `/outlets/[id]` — outlet name is editable | ✅ Yes | ❌ No | ❌ No |
| `/outlets/[id]` — outlet code is editable | ✅ Yes | ❌ No | ❌ No |
| `/outlets/[id]` — outlet type is editable | ✅ Yes | ❌ No | ❌ No |
| `/outlets/[id]` — parent outlet selector visible | ✅ Yes | ❌ No | ❌ No |
| `/outlets/[id]` — "Add Recipe" button visible | ✅ Yes | ❌ No | ❌ No |
| `/outlets/[id]` — recipe edit/delete actions visible | ✅ Yes | ❌ No | ❌ No |

#### Ingredients

| Test Case | Admin | Manager | Non-Manager |
|-----------|-------|---------|-------------|
| `/ingredients` — "Add Ingredient" button visible | ✅ Yes | ❌ No | ❌ No |
| `/ingredients` — archive/restore buttons visible | ✅ Yes | ❌ No | ❌ No |
| `/ingredients` Categories tab — add/edit/archive visible | ✅ Yes | ❌ No | ❌ No |
| `/ingredients` Allergens tab — add/delete visible | ✅ Yes | ❌ No | ❌ No |
| `/ingredients/[id]` — ingredient name editable | ✅ Yes | ❌ No | ❌ No |
| `/ingredients/[id]` — base unit / cost editable | ✅ Yes | ❌ No | ❌ No |
| `/ingredients/[id]` — halal checkbox editable | ✅ Yes | ❌ No | ❌ No |
| `/ingredients/[id]` — archive button visible | ✅ Yes | ❌ No | ❌ No |
| `/ingredients/[id]` — "Add Supplier" button visible | ✅ Yes | ✅ Yes | ❌ No |
| `/ingredients/[id]` — supplier edit/delete visible | ✅ Yes | ✅ Yes | ❌ No |
| `/ingredients/[id]` — reassign category button visible | ✅ Yes | ❌ No | ❌ No |
| `/ingredients/[id]` — allergen add/delete visible | ✅ Yes | ❌ No | ❌ No |

#### Suppliers

| Test Case | Admin | Manager | Non-Manager |
|-----------|-------|---------|-------------|
| `/suppliers` — "Add Supplier" button visible | ✅ Yes | ❌ No | ❌ No |
| `/suppliers` — archive/edit on card visible | ✅ Yes | ❌ No | ❌ No |
| `/suppliers/[id]` — supplier name editable | ✅ Yes | ❌ No | ❌ No |
| `/suppliers/[id]` — address/phone/email editable | ✅ Yes | ❌ No | ❌ No |
| `/suppliers/[id]` — archive button visible | ✅ Yes | ❌ No | ❌ No |
| `/suppliers/[id]` — "Add Ingredient" button visible | ✅ Yes | ✅ Yes | ❌ No |
| `/suppliers/[id]` — ingredient edit/delete visible | ✅ Yes | ✅ Yes | ❌ No |

#### Recipes

| Test Case | Admin | Manager | Non-Manager |
|-----------|-------|---------|-------------|
| `/recipes` — "New Recipe" button visible | ✅ Yes | ✅ Yes | ❌ No |
| `/recipes` — category management is editable | ✅ Yes | ❌ No | ❌ No |
| `/recipes/new` — page accessible | ✅ Yes | ✅ Yes | ❌ Redirected |
| `/recipes/[id]` Canvas — can save/edit | ✅ Yes | ✅ Yes | ❌ No |
| `/recipes/[id]` Overview — fields editable | ✅ Yes | ✅ Yes | ❌ No |
| `/recipes/[id]` Ingredients — readonly | ✅ Yes (editable) | ❌ Readonly | ❌ Readonly |
| `/recipes/[id]` Outlets — "Add Outlet" visible | ✅ Yes | ❌ No | ❌ No |
| `/recipes/[id]` Instructions — editable | ✅ Yes | ✅ Yes | ❌ No |

#### R&D

| Test Case | Admin | Manager | Non-Manager |
|-----------|-------|---------|-------------|
| `/rnd` — fork button visible | ✅ Yes | ✅ Yes | ❌ No |
| `/rnd` — "New Session" button visible | ✅ Yes | ✅ Yes | ❌ No |
| `/rnd` — regenerate summary visible | ✅ Yes | ✅ Yes | ❌ No |
| `/rnd/r/[recipeId]` — action items toggleable | ✅ Yes | ✅ Yes | ❌ No |
| `/rnd/r/[recipeId]` — "Edit in Canvas" vs "View" | ✅ Edit | ✅ Edit | ❌ View |

#### Admin

| Test Case | Admin | Manager | Non-Manager |
|-----------|-------|---------|-------------|
| `/admin/users` — accessible | ✅ Yes | ❌ Redirected | ❌ Redirected |

### Regression Checks

After all permission changes, verify these flows still work for admin:
- [ ] Create a new outlet, edit its fields, archive it, unarchive it
- [ ] Create a new ingredient, add suppliers, archive it
- [ ] Create a new supplier, add ingredients, archive it
- [ ] Create a new recipe, add ingredients, set instructions, add to outlet, fork it
- [ ] Access R&D workspace, fork a recipe, create a tasting session
- [ ] Access admin user management page
