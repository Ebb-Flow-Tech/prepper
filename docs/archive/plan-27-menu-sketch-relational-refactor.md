# Plan 27: Menu Sketch Relational Refactor

**Status**: ✅ Complete
**Priority**: High
**Dependencies**: Existing `menus_sketch` table, `recipes` table (for fork logic), `tasting_sessions` infrastructure
**Owner**: Engineering

---

## Overview

The current Menu Sketch system stores sections and dishes as a nested JSON blob on `menus_sketch`. This plan replaces that JSON with proper relational tables (`menu_sketch_section`, `menu_sketch_section_item`, `menu_sketch_section_item_comments`), enabling:

- Per-dish tasting feedback and comments
- Auto-versioning of dishes when edited after receiving tasting feedback
- Linking menu items to the `recipes` table for cost propagation
- Soft-delete on `menus_sketch` (status → `archived`)
- Creation of tasting sessions from a menu, using selected dishes

The change requires a **DB migration, backend service + API additions, and a significant frontend overhaul** of the menu sketch pages.

---

## Flows (For Context)

| Flow | Steps |
|------|-------|
| **Brand new menu** | 1. User creates menu (from 'Draft Menu' tab) → 2. User types section name + Enter → section saved → 3. User types dish name + Enter → dish saved (recipe created, version = 1) |
| **Add items to tasting session** | 1. User checks dishes → 2. Clicks "Create Tasting Session" → session created with selected dishes |
| **Editing dish (no feedback)** | Edit dish → updates same recipe in DB |
| **Editing dish (with feedback)** | Edit dish → new recipe forked (version +1, root_id = old recipe_id) |

> **Terminology**: Use "Dish" instead of "Recipe" in all frontend UI copy to reduce confusion.

---

## Phase 1: Database Migration

### 1.1 Modify `menus_sketch`

| Change | Detail |
|--------|--------|
| Remove `sections` | JSON column dropped (data will be migrated if needed, or dropped as part of the refactor) |
| Remove `comments` | JSON column dropped (comments move to `menu_sketch_section_item_comments`) |
| Add `status` | `VARCHAR`, values: `draft` / `archived`, default `draft` |
| Add `root` | `INTEGER`, nullable FK → `menus_sketch.id` (previous version pointer) |

> Note: `notes` column is kept as-is (menu-wide rich text).

### 1.2 New Table: `menu_sketch_section`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `name` | VARCHAR | Section display name |
| `menu_sketch_id` | INTEGER FK → `menus_sketch.id` | Cascade delete |
| `order_no` | INTEGER | Display order within menu |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### 1.3 New Table: `menu_sketch_section_item`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `menu_sketch_section_id` | INTEGER FK → `menu_sketch_section.id` | Cascade delete |
| `recipe_id` | INTEGER FK → `recipes.id`, nullable | Optional — links to `recipes` table |
| `name` | VARCHAR | Dish display name (can diverge from recipe name) |
| `sales_price` | NUMERIC(10,2), nullable | |
| `cost_price` | NUMERIC(10,2), nullable | |
| `margin` | NUMERIC(10,2), nullable | Stored (calculated from sales/cost) |
| `description` | TEXT, nullable | Menu description — NOT the recipe description |
| `is_highlight` | BOOLEAN | Default `false` |
| `icons` | JSON | Array of strings |
| `order_no` | INTEGER | Display order within section |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### 1.4 New Table: `menu_sketch_section_item_comments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `menu_sketch_section_item_id` | INTEGER FK → `menu_sketch_section_item.id` | Cascade delete |
| `text` | TEXT | |
| `resolved` | BOOLEAN | Default `false` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### 1.5 Alembic Migration

- Create migration file: `alembic/versions/<rev>_menu_sketch_relational_refactor.py`
- Sequence: add columns to `menus_sketch` → create `menu_sketch_section` → create `menu_sketch_section_item` → create `menu_sketch_section_item_comments`
- Drop `sections` and `comments` columns from `menus_sketch` (no data migration needed — existing JSON data is treated as legacy)

---

## Phase 2: Backend Models

### 2.1 Update `app/models/menu_sketch.py`

- Remove `sections: list` and `comments: dict` fields from `MenuSketch`
- Add `status: str = Field(default="draft")`
- Add `root: int | None = Field(default=None, foreign_key="menus_sketch.id")`
- Update `MenuSketchRead` to exclude `sections`/`comments`; add `status`, `root`
- Update `MenuSketchUpdate` similarly

### 2.2 New Model File: `app/models/menu_sketch_section.py`

- `MenuSketchSection` (table model)
- `MenuSketchSectionCreate` — fields: `menu_sketch_id`, `name`
- `MenuSketchSectionRead` — all columns
- `MenuSketchSectionUpdate` — `name`, `order_no`

### 2.3 New Model File: `app/models/menu_sketch_section_item.py`

- `MenuSketchSectionItem` (table model)
- `MenuSketchSectionItemCreate` — fields: `menu_sketch_section_id`, `recipe_id` (optional), `name`, `sales_price`, `cost_price`, `description`, `is_highlight`, `icons`
- `MenuSketchSectionItemUpdate` — all fields optional except `recipe_id` (required when patching)
- `MenuSketchSectionItemRead` — all columns

### 2.4 New Model File: `app/models/menu_sketch_section_item_comment.py`

- `MenuSketchSectionItemComment` (table model)
- `MenuSketchSectionItemCommentCreate` — `menu_sketch_section_item_id`, `text`
- `MenuSketchSectionItemCommentUpdate` — `text`
- `MenuSketchSectionItemCommentRead` — all columns

### 2.5 Aggregated Response DTOs

```python
# For GET /menu_sketch_section_item_comments/menu_sketch/{id}
class CommentRead(SQLModel):
    id: int
    text: str
    resolved: bool
    created_at: datetime

class DishCommentsRead(SQLModel):
    menu_sketch_section_item_id: int
    name: str
    comments: list[CommentRead]

class MenuSketchCommentsResponse(SQLModel):
    data: list[DishCommentsRead]
```

---

## Phase 3: Backend Services

### 3.1 Update `app/domain/menu_sketch_service.py`

- Change `delete_sketch()`: soft-delete by setting `status = "archived"` instead of hard delete
- Update `list_sketches()`: filter out `status = "archived"` by default
- Update `fork_sketch()`: set `root` on forked sketch to `original.id`

### 3.2 New Service: `app/domain/menu_sketch_section_service.py`

```python
class MenuSketchSectionService:
    def create_section(data: MenuSketchSectionCreate) -> MenuSketchSection
        # Validate menu_sketch_id exists, create section
    def delete_section(section_id: int) -> bool
        # Hard delete
    def list_sections(menu_sketch_id: int) -> list[MenuSketchSection]
```

### 3.3 New Service: `app/domain/menu_sketch_section_item_service.py`

```python
class MenuSketchSectionItemService:
    def create_item(data: MenuSketchSectionItemCreate) -> MenuSketchSectionItem
        # If recipe_id provided, link recipe; else create blank item

    def update_item(item_id: int, data: MenuSketchSectionItemUpdate) -> MenuSketchSectionItem
        # KEY FORK LOGIC:
        # 1. If recipe_id given AND recipe has feedback (tasting notes exist):
        #    - Fork recipe: new recipe with version+1, root_id = recipe_id
        #    - Update item.recipe_id to new forked recipe id
        #    - Apply name/ingredient updates to forked recipe
        # 2. If recipe_id given AND recipe has NO feedback:
        #    - Update recipe.name directly
        # 3. Update all other item fields (sales_price, cost_price, margin, etc.)

    def delete_item(item_id: int) -> bool
        # Hard delete of item row only; recipe is NOT deleted

    def _recipe_has_feedback(recipe_id: int) -> bool
        # Check if any tasting notes exist for this recipe
```

### 3.4 New Service: `app/domain/menu_sketch_section_item_comment_service.py`

```python
class MenuSketchSectionItemCommentService:
    def get_comments_for_menu(menu_sketch_id: int) -> MenuSketchCommentsResponse
        # JOIN: menus_sketch → menu_sketch_section → menu_sketch_section_item → comments
        # Group by dish, return structured response

    def create_comment(data: MenuSketchSectionItemCommentCreate) -> MenuSketchSectionItemComment
    def update_comment(comment_id: int, data: MenuSketchSectionItemCommentUpdate) -> MenuSketchSectionItemComment
    def resolve_comment(comment_id: int) -> MenuSketchSectionItemComment
        # Sets resolved = True
    def delete_comment(comment_id: int) -> bool
        # Hard delete
```

---

## Phase 4: Backend API Endpoints

### 4.1 Update `app/api/menu_sketches.py`

- Update `DELETE /{sketch_id}` to call soft-delete (set `status = archived`)
- Response model updates for `MenuSketchRead` (remove `sections`/`comments`)

### 4.2 New Router: `app/api/menu_sketch_sections.py`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/menu-sketch-sections` | Create section (validate menu_sketch_id) |
| `DELETE` | `/menu-sketch-sections/{id}` | Hard delete section + cascade items |

### 4.3 New Router: `app/api/menu_sketch_section_items.py`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/menu-sketch-section-items` | Create item |
| `PATCH` | `/menu-sketch-section-items/{id}` | Update item (with fork logic) |
| `DELETE` | `/menu-sketch-section-items/{id}` | Hard delete item (recipe untouched) |

### 4.4 New Router: `app/api/menu_sketch_section_item_comments.py`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/menu-sketch-section-item-comments/menu-sketch/{id}` | Aggregated comments for full menu |
| `POST` | `/menu-sketch-section-item-comments` | Add comment |
| `PATCH` | `/menu-sketch-section-item-comments/{id}` | Update comment text |
| `PATCH` | `/menu-sketch-section-item-comments/resolve/{id}` | Resolve comment |
| `DELETE` | `/menu-sketch-section-item-comments/{id}` | Hard delete comment |

### 4.5 Register Routers in `app/main.py`

```python
from app.api import menu_sketch_sections, menu_sketch_section_items, menu_sketch_section_item_comments

app.include_router(menu_sketch_sections.router, prefix="/api/v1/menu-sketch-sections", tags=["menu-sketch-sections"])
app.include_router(menu_sketch_section_items.router, prefix="/api/v1/menu-sketch-section-items", tags=["menu-sketch-section-items"])
app.include_router(menu_sketch_section_item_comments.router, prefix="/api/v1/menu-sketch-section-item-comments", tags=["menu-sketch-section-item-comments"])
```

---

## Phase 5: Backend Tests

File: `backend/tests/test_menu_sketch_relational.py`

- `test_create_section_validates_menu_sketch_id` — 404 if menu_sketch_id invalid
- `test_delete_section_cascades_items` — items deleted with section
- `test_create_item_without_recipe` — item created without recipe_id
- `test_create_item_with_recipe` — item linked to recipe
- `test_update_item_no_feedback_updates_recipe` — recipe name updated in place
- `test_update_item_with_feedback_forks_recipe` — new recipe version created, item.recipe_id updated
- `test_delete_item_does_not_delete_recipe` — recipe survives item deletion
- `test_get_comments_aggregated_response` — correct nested structure
- `test_resolve_comment` — sets `resolved = true`
- `test_soft_delete_menu_sketch` — status becomes `archived`, not returned in list
- `test_fork_sets_root_id` — forked sketch has `root` pointing to original

---

## Phase 6: Frontend — Types & Hooks

### 6.1 Update `frontend/src/lib/types/index.ts`

Remove `sections: SketchSection[]` and `comments: Record<string, SketchComment[]>` from `MenuSketch`.

Add:
```typescript
interface MenuSketch {
  id: number
  version: number
  name: string
  status: 'draft' | 'archived'
  root: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface MenuSketchSection {
  id: number
  name: string
  menu_sketch_id: number
  order_no: number
  created_at: string
  updated_at: string
}

interface MenuSketchSectionItem {
  id: number
  menu_sketch_section_id: number
  recipe_id: number | null
  name: string
  sales_price: number | null
  cost_price: number | null
  margin: number | null
  description: string | null
  is_highlight: boolean
  icons: string[]
  order_no: number
  created_at: string
  updated_at: string
}

interface MenuSketchSectionItemComment {
  id: number
  menu_sketch_section_item_id: number
  text: string
  resolved: boolean
  created_at: string
  updated_at: string
}

interface DishCommentsRead {
  menu_sketch_section_item_id: number
  name: string
  comments: MenuSketchSectionItemComment[]
}

interface MenuSketchCommentsResponse {
  data: DishCommentsRead[]
}
```

### 6.2 Update `frontend/src/lib/api.ts`

Add endpoints:
- `createMenuSketchSection(data)` → `POST /menu-sketch-sections`
- `deleteMenuSketchSection(id)` → `DELETE /menu-sketch-sections/{id}`
- `createMenuSketchSectionItem(data)` → `POST /menu-sketch-section-items`
- `updateMenuSketchSectionItem(id, data)` → `PATCH /menu-sketch-section-items/{id}`
- `deleteMenuSketchSectionItem(id)` → `DELETE /menu-sketch-section-items/{id}`
- `getMenuSketchComments(menuSketchId)` → `GET /menu-sketch-section-item-comments/menu-sketch/{id}`
- `createMenuSketchComment(data)` → `POST /menu-sketch-section-item-comments`
- `updateMenuSketchComment(id, data)` → `PATCH /menu-sketch-section-item-comments/{id}`
- `resolveMenuSketchComment(id)` → `PATCH /menu-sketch-section-item-comments/resolve/{id}`
- `deleteMenuSketchComment(id)` → `DELETE /menu-sketch-section-item-comments/{id}`

### 6.3 Update `frontend/src/lib/hooks/useMenuSketches.ts`

Add hooks:
- `useMenuSketchSections(menuSketchId)` — list sections for a menu
- `useCreateMenuSketchSection()` — mutation
- `useDeleteMenuSketchSection()` — mutation
- `useMenuSketchSectionItems(sectionId)` — list items for a section
- `useCreateMenuSketchSectionItem()` — mutation
- `useUpdateMenuSketchSectionItem()` — mutation (note: triggers fork on backend)
- `useDeleteMenuSketchSectionItem()` — mutation
- `useMenuSketchComments(menuSketchId)` — aggregated comments view
- `useCreateMenuSketchComment()` — mutation
- `useUpdateMenuSketchComment()` — mutation
- `useResolveMenuSketchComment()` — mutation
- `useDeleteMenuSketchComment()` — mutation

---

## Phase 7: Frontend — Pages & Components

### 7.1 Menu Sketch List Page (`/menu-sketch/page.tsx`)

- No structural change needed — list still shows non-archived sketches
- Rename "Menu" → "Draft Menu" in tab/page heading
- Remove any references to JSON `sections` count

### 7.2 Menu Sketch Detail Page (`/menu-sketch/[id]/page.tsx`)

**Full rewrite of the editor to use relational data:**

- On load: fetch `MenuSketch`, then fetch sections via `useMenuSketchSections`, then for each section fetch items via `useMenuSketchSectionItems`
- **Section creation**: text input + Enter → `useCreateMenuSketchSection()`
- **Dish creation**: text input + Enter within a section → `useCreateMenuSketchSectionItem()` (creates a recipe via `recipe_id` if needed, or name-only item)
- **Dish editing**: inline editable fields for `name`, `sales_price`, `cost_price`, `description`, `is_highlight`, `icons` → debounced `useUpdateMenuSketchSectionItem()`
- **Feedback icon**: add tasting/comment icon per dish; click shows comments panel (reuse/adapt existing `CommentsPanel`)
- **Comments display**: fetch `useMenuSketchComments(menuSketchId)`; per-dish comment count badge; click to open comment thread
- **Dish selection checkboxes**: allow selecting multiple dishes → "Create Tasting Session" button appears → navigates to tasting session creation with pre-selected dishes
- **Auto-versioning notice**: when a dish with feedback is saved, backend silently forks; frontend should invalidate `useMenuSketchSectionItems` cache and optionally show a toast "New version created"
- **Soft delete**: Delete menu → backend sets `status = archived`; frontend navigates back to list

### 7.3 Tasting Session Creation from Menu (`/tastings/new/page.tsx`)

- Accept pre-selected `dish_ids` (menu_sketch_section_item IDs) via URL query param or router state
- Pre-populate the recipes list in the session form from the selected dishes' `recipe_id` values

### 7.4 Comments Panel (Reuse/Update)

Existing `CommentsPanel.tsx` and `DishCommentsModal.tsx` use JSON-based comments. Refactor to use:
- `useMenuSketchComments` for data
- `useCreateMenuSketchComment`, `useResolveMenuSketchComment`, `useDeleteMenuSketchComment` for mutations
- Display per-dish unresolved count badge (orange dot) in edit mode
- Show feedback from tasting sessions alongside menu comments (read-only section for tasting notes)

### 7.5 Updated `MenuBuilder` Component

- Remove all JSON section/dish state management
- Data flows from relational hooks only
- Drag-and-drop reordering now calls `useUpdateMenuSketchSectionItem({ order_no })` on drop

---

## Phase 8: CLAUDE.md + Changelog Updates

- Update `CLAUDE.md` architecture sections:
  - `models/` — add 3 new model files
  - `domain/` — add 3 new service files
  - `api/` — add 3 new router files
  - `hooks/` — update `useMenuSketches.ts` hook list
  - API Structure — add new endpoints
- Update `docs/changelog.md` with summary of changes

---

## Implementation Order

```
1. DB Migration (Phase 1)
2. Backend Models (Phase 2)
3. Backend Services (Phase 3)
4. Backend API + Router Registration (Phase 4)
5. Backend Tests (Phase 5)
6. Frontend Types + API client (Phase 6.1 + 6.2)
7. Frontend Hooks (Phase 6.3)
8. Frontend Pages + Components (Phase 7)
9. CLAUDE.md + Changelog (Phase 8)
```

---

## Open Questions / Notes

| # | Question | Notes |
|---|----------|-------|
| 1 | `ingredients` field on section_item | Notion says "to ask" — not included in item table schema. Recipe ingredients are managed via existing `recipe_ingredients` table if `recipe_id` is set. No separate ingredients column on `menu_sketch_section_item`. |
| 2 | Tasting session creation from menu | URL query params vs router state for passing selected dish IDs — recommend URL query params for shareability |
| 3 | Feedback detection logic | "Has feedback" = at least one `TastingNote` exists for the recipe. Use `tasting_notes` table join. |
| 4 | `margin` calculation | Store computed margin on save, or compute from `sales_price` and `cost_price` on the fly. Recommend storing for performance. |
| 5 | Data migration | Existing JSON `sections`/`comments` data on `menus_sketch` will be dropped. No migration of existing data. |
| 6 | Recipe creation on dish add | When a user types a dish name in the menu and presses Enter, does it auto-create a Recipe? Assumption: yes, creates a recipe with `name` only and links `recipe_id`. |
