# Plan 08: Menu Management System

**Status**: In Progress
**Priority**: High
**Dependencies**: Existing recipe, outlet, and user authentication systems
**Owner**: Chefs & Managers
**Target Completion**: Early March 2026

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
| **Menu CRUD** | Create, read, update, soft-delete menus | Planned |
| **Menu Sections** | Group recipes into ordered sections | Planned |
| **Menu Items** | Link recipes with pricing, notes, highlights | Planned |
| **Outlet Assignment** | Assign menus to outlets and their children | Planned |
| **Menu Forking** | Version menus (includes all sections & items) | Planned |
| **Manager Role** | New `is_manager` field on User; controls edit access | Planned |
| **Publication Control** | Toggle `is_published` flag per menu | Planned |
| **Soft Delete** | Deactivate menus with `is_active` flag | Planned |
| **Outlet Hierarchy** | Child outlets inherit parent's menus | Planned |
| **Access Control** | Enforce role-based and outlet-based access | Planned |

---

## Data Model

### New Database Tables

```python
# backend/app/models/menu.py

from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship

class Menu(SQLModel, table=True):
    """A menu template with sections and items."""

    id: int = Field(primary_key=True)
    name: str = Field(max_length=255, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    created_by: int = Field(foreign_key="user.id")
    is_published: bool = Field(default=False)
    is_active: bool = Field(default=True)
    version_no: int = Field(default=1)  # For forking

    # Relationships
    sections: list["MenuSection"] = Relationship(back_populates="menu")
    outlets: list["MenuOutlet"] = Relationship(back_populates="menu")
    creator: "User" = Relationship()


class MenuSection(SQLModel, table=True):
    """A section within a menu (e.g., Appetizers, Mains)."""

    id: int = Field(primary_key=True)
    name: str = Field(max_length=255)
    menu_id: int = Field(foreign_key="menu.id", index=True)
    order_no: int = Field(default=0)  # For ordering sections

    # Relationships
    menu: "Menu" = Relationship(back_populates="sections")
    items: list["MenuItem"] = Relationship(back_populates="section")


class MenuItem(SQLModel, table=True):
    """A recipe item on the menu with pricing and metadata."""

    id: int = Field(primary_key=True)
    recipe_id: int = Field(foreign_key="recipe.id", index=True)
    section_id: int = Field(foreign_key="menu_section.id", index=True)
    order_no: int = Field(default=0)  # For ordering items within section
    price: float | None = None  # Optional override; falls back to recipe costing
    additional_info: str | None = None  # Internal notes
    key_highlights: str | None = None  # Marketing/training highlights

    # Relationships
    recipe: "Recipe" = Relationship()
    section: "MenuSection" = Relationship(back_populates="items")


class MenuOutlet(SQLModel, table=True):
    """Link menus to outlets; child outlets inherit parent's menus."""

    id: int = Field(primary_key=True)
    menu_id: int = Field(foreign_key="menu.id", index=True)
    outlet_id: int = Field(foreign_key="outlet.id", index=True)

    # Relationships
    menu: "Menu" = Relationship(back_populates="outlets")
    outlet: "Outlet" = Relationship()
```

### User Model Update

```python
# Update backend/app/models/user.py

class User(SQLModel, table=True):
    """User with added manager role."""

    # ... existing fields ...
    is_manager: bool = Field(default=False)  # NEW: Allows menu editing
```

---

## Database Migrations

**CRITICAL**: Create Alembic migrations for all new tables:

```bash
alembic revision --autogenerate -m "Add menu management tables"
alembic upgrade head
```

---

## API Endpoints

### `/menu` — Menu Management

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/menu` | GET | List all accessible menus | Admin + Managers (by outlet) + Staff (by outlet) |
| `/menu` | POST | Create new menu | Admin + Manager |
| `/menu/{menu_id}` | GET | Get menu with sections and items | Admin + Accessible outlet users |
| `/menu/{menu_id}` | PATCH | Update menu (name, sections, items, outlets) | Admin + Menu creator (if manager) |
| `/menu/{menu_id}/delete` | PATCH | Soft delete menu (set `is_active=false`) | Admin + Menu creator (if manager) |
| `/menu/{menu_id}/fork` | POST | Fork menu with new version_no | Admin + Manager |

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
  "last_updated": "2026-02-24T10:00:00",
  "sections": [
    {
      "id": 1,
      "name": "Appetizers",
      "order_no": 1,
      "items": [
        {
          "id": 1,
          "recipe_id": 42,
          "order_no": 1,
          "price": 12.50,
          "additional_info": "Can be made vegan",
          "key_highlights": "House specialty, gluten-free option"
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

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/menus` | MenuListPage | All | List accessible menus; "New Menu" button for managers |
| `/menus/new` | MenuBuilderPage | Manager + Admin | Create new menu; select outlets |
| `/menus/[id]/edit` | MenuBuilderPage | Manager + Admin (creator/access) | Edit menu sections/items |
| `/menus/[id]/preview` | MenuPreviewPage | All (access check) | View published menu |
| `/admin/users` | UserManagementPage | Admin | Manage users; toggle `is_manager` role; create new users |

### Menu List Page (`/menus`)

```
┌──────────────────────────────────────────────────────┐
│ Menus                                [+ New Menu]    │  ← Button only for managers
├──────────────────────────────────────────────────────┤
│                                                      │
│ Casa Main Menu              Published • Last edited: │
│ [Preview]  [Edit]  [Fork]   Feb 24, 10:00am         │
│                                                      │
│ Tampines Lunch Menu         Draft • Outlet: Tampines│
│ [Preview]  [Edit]  [Fork]                           │
│                                                      │
│ (No menus accessible)  ← Staff with no outlet       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Menu Builder Component

**Used in**: `/menus/new` and `/menus/[id]/edit`

Features:
- Text input for menu name
- Outlet selector (cannot be edited once created)
- Collapsible sections with drag-reorder
- Recipe picker within each section with drag-reorder
- Per-item pricing, additional info, key highlights
- Fork button (copies all sections & items with version_no += 1)
- Save button (PATCH endpoint)
- Discard changes option

```
┌──────────────────────────────────────────────────────┐
│ Menu Builder: Casa Main Menu                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Menu Name: [Casa Main Menu]                          │
│ Outlet: Casa (locked)                                │
│                                                      │
│ Sections:                                            │
│ ┌─ Appetizers  [▼ Collapse]  [⋮ Menu]               │
│ │  • Escargot             $15.00  [⋮ Menu]          │
│ │    Notes: Fresh butter, garlic                    │
│ │    Highlights: House specialty                    │
│ │                                                   │
│ │  • Oysters              $18.50  [⋮ Menu]          │
│ │    Notes: Seasonal selection                      │
│ │    Highlights: Fresh from market                  │
│ │                                                   │
│ │  [+ Add Item to Section]                          │
│ └─────────────────────────────────────────────────   │
│                                                      │
│ ┌─ Mains  [▼ Collapse]  [⋮ Menu]                    │
│ │  • Duck Confit          $28.00  [⋮ Menu]          │
│ │  • Beef Wellington      $35.00  [⋮ Menu]          │
│ │                                                   │
│ │  [+ Add Item to Section]                          │
│ └─────────────────────────────────────────────────   │
│                                                      │
│ [+ Add Section]                                      │
│                                                      │
│ [Publish]  [Save]  [Fork]  [Discard]                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Menu Preview Page (`/menus/[id]/preview`)

```
┌──────────────────────────────────────────────────────┐
│ Casa Main Menu                  [← Back to Menus]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ▼ Appetizers                                         │
│   • Escargot                               $15.00    │
│     Fresh butter, garlic | House specialty          │
│     Allergens: Shellfish, Dairy                      │
│                                                      │
│   • Oysters                                $18.50    │
│     Seasonal selection | Fresh from market          │
│     Allergens: Shellfish                            │
│                                                      │
│ ► Mains                                              │
│                                                      │
│ ► Desserts                                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### User Management Page (`/admin/users`)

Add a column to the existing user table:

```
┌──────────────────────────────────────────────────────┐
│ Users                              [+ Create User]   │
├──────────────────────────────────────────────────────┤
│ Email          │ Username   │ Role      │ Manager?   │
├────────────────┼────────────┼───────────┼────────────┤
│ ronald.sim@... │ ronald     │ Admin     │ Yes [◉]    │
│ manager@...    │ manager    │ Normal    │ Yes [◉]    │
│ chefa@...      │ chefa      │ Normal    │ No  [○]    │
│ staff@...      │ staff      │ Normal    │ No  [○]    │
└──────────────────────────────────────────────────────┘

Create New User Modal:
┌──────────────────────────────────────┐
│ Add New User                         │
├──────────────────────────────────────┤
│                                      │
│ Email: [________________]            │
│ Password: [________________]         │
│ Manager: [○ No] [◉ Yes]             │
│                                      │
│ [Cancel]  [Create]                  │
│                                      │
└──────────────────────────────────────┘
```

### Component: MenuBuilder

```typescript
// frontend/src/components/menu/MenuBuilder.tsx

interface MenuBuilderProps {
  menu?: Menu;  // Undefined for /menus/new, defined for /menus/[id]/edit
  userId: number;
  accessibleOutlets: Outlet[];
  allRecipes: Recipe[];  // Recipes user has access to
  onSave: (data: MenuSavePayload) => Promise<void>;
  onFork?: (menu: Menu) => Promise<void>;
}

function MenuBuilder({ menu, userId, ...props }: MenuBuilderProps) {
  // If menu is undefined, create new menu mode
  // If menu is defined, edit mode with existing sections/items
  // Handles drag-reorder of sections and items
  // Manages outlet selection (locked after creation)
}
```

---

## Implementation Steps

### Phase 1: Data Layer & API (Week 1)

- [ ] Create menu.py models (Menu, MenuSection, MenuItem, MenuOutlet)
- [ ] Update user.py with `is_manager` field
- [ ] Create Alembic migration for new tables
- [ ] Create menu_service.py with CRUD logic
- [ ] Implement access control helpers (outlet hierarchy, role checks)
- [ ] Create `/menu` endpoints (GET, POST, PATCH)
- [ ] Create `/menu/{id}/fork` endpoint
- [ ] Create `/menu-outlets` and `/menu-items` query endpoints
- [ ] Write comprehensive test cases for all endpoints

### Phase 2: Frontend — List & Preview (Week 2)

- [ ] Create `/menus` page with MenuListPage component
- [ ] Create `/menus/[id]/preview` page with MenuPreviewPage component
- [ ] Build MenuCard component for list display
- [ ] Add "Edit" / "Fork" buttons to preview (conditional on role)
- [ ] Add menu link to top navbar (between Outlets and Recipes)
- [ ] Implement outlet accessibility checks on both pages

### Phase 3: Frontend — Menu Builder & Editor (Week 2-3)

- [ ] Build MenuBuilder component with section management
- [ ] Implement drag-reorder for sections and items
- [ ] Build recipe picker modal within sections
- [ ] Implement per-item editing (price, notes, highlights)
- [ ] Create `/menus/new` page using MenuBuilder
- [ ] Create `/menus/[id]/edit` page using MenuBuilder
- [ ] Implement fork functionality in MenuBuilder
- [ ] Implement soft delete (PATCH /delete)

### Phase 4: User Management & Permissions (Week 3)

- [ ] Update `/admin/users` page to show `is_manager` column
- [ ] Add toggle for `is_manager` role
- [ ] Implement create user modal (email, password)
- [ ] Add role-based button visibility (edit/fork only for managers)
- [ ] Test outlet hierarchy enforcement (child outlets see parent menus)

### Phase 5: Testing & Polish (Week 4)

- [ ] Run full test suite; fix any failures
- [ ] Test with sample data (chefs, tastings, test outlets)
- [ ] Verify access control edge cases (outlet hierarchy, role transitions)
- [ ] Test menu forking preserves all data
- [ ] UI polish: responsive design, error handling, loading states

---

## API Design Patterns

### Access Control Middleware

```python
# backend/app/api/deps.py

async def check_menu_access(
    menu_id: int,
    session: Session,
    current_user: User,
) -> Menu:
    """
    Verify user can access menu.
    - Admin: Can access any menu
    - Manager/Staff: Can access if assigned to accessible outlet
    - Raises 403 Forbidden if no access
    """
    menu = session.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=404)

    if current_user.is_admin:
        return menu

    # Check outlet accessibility
    user_outlets = get_accessible_outlets(session, current_user)
    menu_outlets = session.query(MenuOutlet).filter(
        MenuOutlet.menu_id == menu_id
    ).all()

    accessible = any(
        mo.outlet_id in user_outlets
        for mo in menu_outlets
    )

    if not accessible:
        raise HTTPException(status_code=403, detail="Menu not accessible")

    return menu


async def check_menu_edit(
    menu: Menu,
    current_user: User,
) -> None:
    """
    Verify user can edit menu.
    - Admin: Can edit any menu
    - Manager: Can edit if creator
    - Raises 403 if no edit permission
    """
    if current_user.is_admin:
        return

    if not current_user.is_manager:
        raise HTTPException(status_code=403, detail="Only managers can edit menus")

    if menu.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator can edit menu")
```

---

## Open Questions

1. **Should menus track version history like recipes?** Currently using simple `version_no`; could use full recipe-style tree.
2. **Can staff/customers export menus?** (PDF, print-friendly view) — Defer to Phase 2.
3. **Should menu pricing override recipe costing?** Yes, per spec; fallback to recipe if not set.
4. **Multi-outlet menu assignment** — If menu assigned to parent, can children override it? (Keep simple for MVP: inherit only)
5. **Menu analytics** — Track which items are popular? (Future feature)

---

## Acceptance Criteria

### Menu CRUD
- [ ] Managers can create new menus with sections and items
- [ ] Menus display in list with publication status
- [ ] Menus can be edited (sections, items, ordering)
- [ ] Menus can be soft-deleted
- [ ] Menus can be forked (version_no increments, all sections/items copied)

### Access Control
- [ ] Admins can see/edit all menus
- [ ] Managers can create/edit only their own menus
- [ ] Staff can only view menus from their accessible outlets
- [ ] Outlet hierarchy enforced: child outlets inherit parent menus
- [ ] Attempting access to inaccessible menu returns 403

### Menu Builder UI
- [ ] Managers can drag-reorder sections within a menu
- [ ] Managers can add/remove sections
- [ ] Managers can drag-reorder items within a section
- [ ] Managers can add/remove items and select recipes
- [ ] Managers can set per-item pricing, notes, highlights
- [ ] Outlet selector is locked after menu creation
- [ ] Fork button creates new menu with version_no += 1

### Menu Preview
- [ ] Sections are collapsible/expandable
- [ ] Items display recipe name, price, highlights, allergens
- [ ] Staff view is read-only with no edit buttons
- [ ] Publication toggle visible only to managers/admins

### User Management
- [ ] Admin can toggle `is_manager` role for users
- [ ] Admin can create new users with email/password
- [ ] Manager role enables "New Menu" button and edit access

### Testing
- [ ] All endpoints have comprehensive test coverage
- [ ] Access control tests verify 403 on unauthorized access
- [ ] Outlet hierarchy access tests confirm child outlet inheritance
- [ ] Fork functionality preserves all sections and items
