# Plan 08: Menu Management System

**Status**: Complete
**Priority**: High
**Dependencies**: Existing recipe, outlet, and user authentication systems
**Owner**: Chefs & Managers
**Completed**: March 2026

---

## Overview

Implement a comprehensive menu management system for training and staff reference. Managers can build structured menus with sections and recipes, assign them to outlets, and control publication. Staff can preview menus with collapsible sections for easy reference during service.

---

## Goal

Enable managers to:
1. **Create organized menus** with sections (Appetizers, Mains, Desserts, etc.)
2. **Link recipes to menu items** with pricing, notes, and highlights
3. **Control publication and visibility** by outlet access rules
4. **Version menus** with fork functionality for testing updates
5. **Manage staff access** through role-based permissions (admin/manager/staff)

Enable staff to:
1. **Browse accessible menus** by outlet
2. **Preview menu structure** with collapsible sections
3. **View pricing, allergens, and key highlights** for training

---

## Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Menu CRUD** | Create, read, update, soft-delete menus | Done |
| **Menu Sections** | Group recipes into ordered sections | Done |
| **Menu Items** | Link recipes with pricing, notes, highlights, substitutions | Done |
| **Outlet Assignment** | Assign menus to outlets and their children | Done |
| **Menu Forking** | Version menus (includes all sections & items) | Done |
| **Manager Role** | `is_manager` field on User; controls edit access | Done |
| **Publication Control** | Toggle `is_published` flag per menu | Done |
| **Soft Delete** | Deactivate menus with `is_active` flag + restore | Done |
| **Outlet Hierarchy** | Child outlets inherit parent's menus | Done |
| **Access Control** | Enforce role-based and outlet-based access | Done |

---

## Data Model

### Database Tables

```python
# backend/app/models/menu.py

class Menu(SQLModel, table=True):
    id: int = Field(primary_key=True)
    name: str = Field(max_length=255, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: int = Field(foreign_key="user.id")
    is_published: bool = Field(default=False)
    is_active: bool = Field(default=True)
    version_no: int = Field(default=1)

class MenuSection(SQLModel, table=True):
    id: int = Field(primary_key=True)
    name: str = Field(max_length=255)
    menu_id: int = Field(foreign_key="menu.id", index=True)
    order_no: int = Field(default=0)
    created_at: datetime
    updated_at: datetime

class MenuItem(SQLModel, table=True):
    id: int = Field(primary_key=True)
    recipe_id: int = Field(foreign_key="recipe.id", index=True)
    section_id: int = Field(foreign_key="menu_section.id", index=True)
    order_no: int = Field(default=0)
    display_price: float | None = None       # Optional price override
    additional_info: str | None = None       # Internal notes (max 500)
    key_highlights: str | None = None        # Marketing/training highlights (max 500)
    substitution: str | None = None          # Available substitutions (max 500)
    created_at: datetime
    updated_at: datetime

class MenuOutlet(SQLModel, table=True):
    id: int = Field(primary_key=True)
    menu_id: int = Field(foreign_key="menu.id", index=True)
    outlet_id: int = Field(foreign_key="outlet.id", index=True)
    created_at: datetime
```

### User Model Update

```python
# backend/app/models/user.py
class User(SQLModel, table=True):
    # ... existing fields ...
    is_manager: bool = Field(default=False)  # Controls menu editing access
```

### Migrations

- `c9d0e1f2g3h4_add_is_manager_and_create_menu_tables.py` — Creates all menu tables + `is_manager` on User
- `d0e1f2g3h4i5_add_substitution_to_menu_items.py` — Adds `substitution` field to menu_items

---

## API Endpoints

### `/menus` — Menu Management

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/menus` | GET | List all accessible menus (with `include_archived` param) | Admin + Managers (by outlet) + Staff (by outlet) |
| `/menus` | POST | Create new menu | Admin + Manager |
| `/menus/{menu_id}` | GET | Get menu with sections and items | Admin + Accessible outlet users |
| `/menus/{menu_id}` | PATCH | Update menu (name, sections, items, outlets) | Admin + Menu creator (if manager) |
| `/menus/{menu_id}/delete` | PATCH | Soft delete menu (set `is_active=false`) | Admin + Menu creator (if manager) |
| `/menus/{menu_id}/restore` | PATCH | Restore archived menu | Admin + Menu creator (if manager) |
| `/menus/{menu_id}/fork` | POST | Fork menu with new version_no | Admin + Manager |

**Access Control Logic:**
- **Admin**: Can access all menus
- **Manager**: Can create/edit menus; can only access menus assigned to their accessible outlets
- **Staff**: Can only view (GET) menus from their accessible outlets
- **Outlet Hierarchy**: If menu is assigned to parent outlet, all children can access it

**Response Format:**

```json
{
  "id": 1,
  "name": "Casa Main Menu",
  "created_by": 5,
  "is_published": true,
  "is_active": true,
  "version_no": 1,
  "created_at": "2026-02-24T10:00:00",
  "updated_at": "2026-02-24T10:00:00",
  "sections": [
    {
      "id": 1,
      "name": "Appetizers",
      "order_no": 1,
      "items": [
        {
          "id": 1,
          "recipe_id": 42,
          "recipe_name": "Escargot",
          "order_no": 1,
          "display_price": 12.50,
          "additional_info": "Can be made vegan",
          "key_highlights": "House specialty, gluten-free option",
          "substitution": "Can substitute with mushrooms"
        }
      ]
    }
  ],
  "outlets": [
    {
      "id": 1,
      "outlet_id": 10
    }
  ]
}
```

### `/menu-outlets` — Menu-Outlet Assignments

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/menu-outlets/{outlet_id}` | GET | Get all menus accessible to outlet | Admin + Outlet users |

### `/menu-items` — Menu Item Queries

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/menu-items/{section_id}` | GET | Get items in section (ordered by `order_no`, then `name`) | Admin + Accessible outlet users |

---

## Frontend

### Routes & Pages

| Route | Component | Access | Status |
|-------|-----------|--------|--------|
| `/menu` | MenuListPage | All | Done |
| `/menu/new` | MenuBuilderPage | Manager + Admin | Done |
| `/menu/edit/[id]` | MenuBuilderPage | Manager + Admin (creator/access) | Done |
| `/menu/preview/[id]` | MenuPreviewPage | All (access check) | Done |
| `/admin/users` | UserManagementPage | Admin | Done |

### Menu List Page (`/menu`)

- Displays menus as grid cards with name, version, status
- "Create New Menu" button (admin/manager only)
- Archive/restore buttons
- View and Edit navigation
- "Show archived" toggle
- Skeleton loaders and empty state

### Menu Builder Component (`/components/menu/MenuBuilder.tsx`)

**Used in**: `/menu/new` and `/menu/edit/[id]`

Features:
- Create and edit modes
- Drag-and-drop reordering via `dnd-kit` for sections and items
- Visual feedback with opacity changes during dragging
- Grip handles for drag affordance
- Section management (add/remove/edit name)
- Item management (add/remove/edit price, notes, highlights, substitution)
- Editable textareas for `additional_info` and `key_highlights`
- Allergen display per item
- Outlet selection for assignment
- Card/list view toggle
- Recipe validation

### Menu Preview Page (`/menu/preview/[id]`)

- Read-only display of menu structure
- Expandable/collapsible sections
- Card and list view modes
- Shows recipe names, images, prices, allergens
- Back link to menu list

### Navigation

- "Menu" link in TopNav at `/menu` with `UtensilsCrossed` icon
- Visible to authenticated users
- Mobile hamburger menu support

### App State

- `isManager` field in `useAppState()` context
- Persisted via localStorage
- Set during login/logout flow

---

## Implementation Steps

### Phase 1: Data Layer & API

- [x] Create menu.py models (Menu, MenuSection, MenuItem, MenuOutlet)
- [x] Update user.py with `is_manager` field
- [x] Create Alembic migration for new tables
- [x] Create menu_service.py with CRUD logic
- [x] Implement access control helpers (outlet hierarchy, role checks)
- [x] Create `/menus` endpoints (GET, POST, PATCH)
- [x] Create `/menus/{id}/fork` endpoint
- [x] Create `/menus/{id}/restore` endpoint
- [x] Create `/menu-outlets` and `/menu-items` query endpoints
- [x] Write comprehensive test cases for all endpoints (40+ tests)

### Phase 2: Frontend — List & Preview

- [x] Create `/menu` page with MenuListPage component
- [x] Create `/menu/preview/[id]` page with MenuPreviewPage component
- [x] Build menu cards for list display
- [x] Add "Edit" / "View" buttons (conditional on role)
- [x] Add menu link to top navbar with UtensilsCrossed icon
- [x] Implement outlet accessibility checks on both pages

### Phase 3: Frontend — Menu Builder & Editor

- [x] Build MenuBuilder component with section management
- [x] Implement drag-reorder for sections and items via dnd-kit
- [x] Build recipe picker within sections
- [x] Implement per-item editing (price, notes, highlights, substitution)
- [x] Create `/menu/new` page using MenuBuilder
- [x] Create `/menu/edit/[id]` page using MenuBuilder
- [x] Implement fork functionality
- [x] Implement soft delete and restore (PATCH /delete, PATCH /restore)

### Phase 4: User Management & Permissions

- [x] Update `/admin/users` page with `is_manager` column
- [x] Add toggle for `is_manager` role
- [x] Implement user management UI
- [x] Add role-based button visibility (edit/fork only for managers)
- [x] Test outlet hierarchy enforcement (child outlets see parent menus)

### Phase 5: Testing & Polish

- [x] Backend test suite passing (40+ tests)
- [x] Access control tests verify 403 on unauthorized access
- [x] Outlet hierarchy access tests confirm child outlet inheritance
- [x] Fork functionality preserves all sections and items
- [x] UI: skeleton loaders, error handling, empty states

---

## Resolved Questions

1. **Should menus track version history like recipes?** — Using simple `version_no` with fork. No tree-based history needed for menus.
2. **Can staff/customers export menus?** — Deferred. Not in current scope.
3. **Should menu pricing override recipe costing?** — Yes. `display_price` on MenuItem optionally overrides recipe cost.
4. **Multi-outlet menu assignment** — Child outlets inherit parent menus (read-only inheritance, no override).
5. **Menu analytics** — Deferred as future feature.

---

## Acceptance Criteria

### Menu CRUD
- [x] Managers can create new menus with sections and items
- [x] Menus display in list with publication status
- [x] Menus can be edited (sections, items, ordering)
- [x] Menus can be soft-deleted and restored
- [x] Menus can be forked (version_no increments, all sections/items copied)

### Access Control
- [x] Admins can see/edit all menus
- [x] Managers can create/edit only their own menus
- [x] Staff can only view menus from their accessible outlets
- [x] Outlet hierarchy enforced: child outlets inherit parent menus
- [x] Attempting access to inaccessible menu returns 403

### Menu Builder UI
- [x] Managers can drag-reorder sections within a menu
- [x] Managers can add/remove sections
- [x] Managers can drag-reorder items within a section
- [x] Managers can add/remove items and select recipes
- [x] Managers can set per-item pricing, notes, highlights, substitutions
- [x] Outlet selector for menu assignment
- [x] Fork button creates new menu with version_no += 1

### Menu Preview
- [x] Sections are collapsible/expandable
- [x] Items display recipe name, price, highlights, allergens
- [x] Staff view is read-only with no edit buttons
- [x] Card and list view modes supported

### User Management
- [x] Admin can toggle `is_manager` role for users
- [x] Admin can manage users via `/admin/users` page
- [x] Manager role enables "New Menu" button and edit access

### Testing
- [x] All endpoints have comprehensive test coverage (40+ tests)
- [x] Access control tests verify 403 on unauthorized access
- [x] Outlet hierarchy access tests confirm child outlet inheritance
- [x] Fork functionality preserves all sections and items
- [x] Substitution field validation included

---

## Deviations from Original Plan

| Area | Planned | Implemented |
|------|---------|-------------|
| Price field | `price` | `display_price` (clearer naming) |
| Item metadata | price, notes, highlights | + `substitution` field (max 500 chars) |
| Routes | `/menus/*` | `/menu/*` (singular) |
| Restore | Not planned | `PATCH /menus/{id}/restore` added |
| View modes | Single view | Card and list toggle on preview |
| Timestamps | Only on Menu | Added `created_at`/`updated_at` on all models |
