# Plan 19: Menu Sketch

## Context

The existing `/menu` implementation is a structured, recipe-linked menu builder. This plan adds a **separate, parallel feature** — a lightweight, freeform menu sketching tool for chefs to quickly brainstorm menu layouts without linking to actual recipes. It does **not** touch the existing menu implementation.

The feature lives at `/menu-sketch` and stores layout data as nested JSON (sections → dishes) rather than relational rows.

---

## Overview

### Key use case
Chefs want to quickly sketch out a menu — they may not have time to look at actual recipes. They want a familiar input-driven experience, similar to the existing `/menu/[id]/edit` page, where they can type and build structure rapidly.

### What gets built
1. **New backend table** `menus_sketch` with nested JSON sections
2. **New CRUD API** at `/api/v1/menu-sketches`
3. **List page** `/menu-sketch` — shows all sketches, with a "New Menu" button
4. **Editor page** `/menu-sketch/[id]` — edit/update/fork the current menu sketch, similar to the existing edit menu page but with enter-to-add UX
5. **Nav update** — replace `/menu` with `/menu-sketch` in `TopNav.tsx`

---

## Data Model

### `menus_sketch` table (new)

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | auto-increment |
| `version` | int | starts at 1, incremented on fork |
| `name` | str | default: `"Untitled Menu"` |
| `sections` | JSON | array of `SketchSection` |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### `SketchSection` shape (stored inside `sections` JSON array)

```json
{
  "name": "Starters",
  "dishes": [
    {
      "name": "Soup of the Day",
      "ingredients": ["chicken stock", "cream"],
      "sales_price": 12.0,
      "cost_price": 3.5
    }
  ]
}
```

> `SketchSection` and `SketchDish` are **not** separate tables — they live entirely within the `sections` JSON column.

### `SketchDish` shape (nested inside `SketchSection.dishes`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | dish name |
| `ingredients` | string[] | free-text ingredient list |
| `sales_price` | number | selling price |
| `cost_price` | number | estimated cost price |

---

## Backend

### 1. New model — `backend/app/models/menu_sketch.py`

New file with:
- `MenuSketch` — the table model (`__tablename__ = "menus_sketch"`)
- `MenuSketchCreate` — for POST (name optional, defaults to `"Untitled Menu"`)
- `MenuSketchUpdate` — for PATCH (all fields optional)
- `MenuSketchRead` — response schema (all fields including parsed JSON)

`sections` stored as `TEXT` in SQLite (auto-serialized via `JSON` type). Validated as `list[dict]` via Pydantic.

### 2. New service — `backend/app/domain/menu_sketch_service.py`

Methods:
- `list_sketches() → list[MenuSketch]`
- `get_sketch(id) → MenuSketch | None`
- `create_sketch(data: MenuSketchCreate) → MenuSketch` — initialises `sections` as `[]`
- `update_sketch(id, data: MenuSketchUpdate) → MenuSketch | None`
- `fork_sketch(id) → MenuSketch | None` — copies all fields, increments `version`

### 3. New router — `backend/app/api/menu_sketches.py`

Endpoints (no auth required — "Permissions: None"):

| Method | Path | Description |
|---|---|---|
| `GET` | `/menu-sketches` | List all sketches |
| `GET` | `/menu-sketches/{id}` | Get single sketch |
| `POST` | `/menu-sketches` | Create new sketch |
| `PATCH` | `/menu-sketches/{id}` | Update sketch (name, sections, etc.) |
| `POST` | `/menu-sketches/{id}/fork` | Fork → new version |

### 4. Register router in `backend/app/main.py`

Mount the new router at `/api/v1/menu-sketches`.

### 5. Alembic migration

New migration file creating the `menus_sketch` table.

---

## Frontend

### 1. Types — `frontend/src/types/index.ts`

Add:

```typescript
export interface SketchDish {
  name: string;
  ingredients: string[];
  sales_price: number;
  cost_price: number;
}

export interface SketchSection {
  name: string;
  dishes: SketchDish[];
}

export interface MenuSketch {
  id: number;
  version: number;
  name: string;
  sections: SketchSection[];
  created_at: string;
  updated_at: string;
}
```

### 2. API calls — `frontend/src/lib/api.ts`

Add:
- `getMenuSketches()` → `GET /menu-sketches`
- `getMenuSketch(id)` → `GET /menu-sketches/{id}`
- `createMenuSketch(data?)` → `POST /menu-sketches`
- `updateMenuSketch(id, data)` → `PATCH /menu-sketches/{id}`
- `forkMenuSketch(id)` → `POST /menu-sketches/{id}/fork`

### 3. Hooks — `frontend/src/lib/hooks/useMenuSketches.ts`

TanStack Query hooks:
- `useMenuSketches()` — query for list
- `useMenuSketch(id)` — query for single
- `useCreateMenuSketch()` — mutation, invalidates list
- `useUpdateMenuSketch()` — mutation (no autosave; save is manual)
- `useForkMenuSketch()` — mutation, invalidates list, navigates to new sketch

### 4. List page — `frontend/src/app/menu-sketch/page.tsx`

- Displays all menu sketches in a card/list layout (consistent with other list pages)
- Each card shows: name, version number, last updated
- "New Menu" button → calls `createMenuSketch()` (creates with `version=1`, `name='Untitled Menu'`, `sections=[]`) then navigates to `/menu-sketch/[id]`
- Clicking a card navigates to `/menu-sketch/[id]`

### 5. Editor page — `frontend/src/app/menu-sketch/[id]/page.tsx`

Similar to the existing `/menu/[id]/edit` page, but without recipe-linking. Key UX:

**Top bar:**
- Back arrow → navigates to `/menu-sketch`
- Editable menu name field (click to edit inline)
- Version badge (`v1`, `v2`, …)
- List / Card view toggle (same pattern as existing menu editor)
- "Fork" button → calls `forkMenuSketch`, navigates to new sketch
- "Save" button → manual save only, no autosave

**Add section:**
- A dashed text input sits at the **top** of the sections list (above all sections)
- Placeholder: `"Type a section name and press Enter to add…"`
- On Enter: new section is created with the typed name, input is cleared

**Sections list:**
- Each section shows its name (editable inline) and a dish count badge
- Collapse/expand toggle per section
- `×` button removes the section

**Add dish (per section):**
- A dashed text input sits **inside each section, below the section name**
- Placeholder: `"Type a dish name and press Enter to add…"`
- On Enter: new dish is appended to that section with the typed name, input is cleared

**Dishes within a section (list view):**
- Horizontal row: dish name | ingredients | sale price | cost price | `×`
- Column headers shown when dishes exist

**Dishes within a section (card view):**
- 2-column card grid; each card shows labelled fields stacked: Dish, Ingredients, Sale price, Cost price

**Ingredients field behaviour:**
- Free-text input; comma-separated string displayed while editing
- Array is only parsed from the string on `onBlur` (not on every keystroke) — prevents characters being swallowed mid-type

**Save**: explicit "Save" button in the top bar calls `updateMenuSketch` with the full current `name` + `sections`.

### 6. Nav update — `frontend/src/components/layout/TopNav.tsx`

Change:
```ts
{ href: '/menu', label: 'Menu', icon: UtensilsCrossed },
```
to:
```ts
{ href: '/menu-sketch', label: 'Menu', icon: UtensilsCrossed },
```

No other changes to the nav.

---

## Files to Create

### Backend
- `backend/app/models/menu_sketch.py` — new model file
- `backend/app/domain/menu_sketch_service.py` — new service file
- `backend/app/api/menu_sketches.py` — new router file
- `backend/alembic/versions/<hash>_add_menus_sketch_table.py` — migration

### Frontend
- `frontend/src/app/menu-sketch/page.tsx` — list page
- `frontend/src/app/menu-sketch/[id]/page.tsx` — editor page
- `frontend/src/lib/hooks/useMenuSketches.ts` — query hooks

## Files to Modify

### Backend
- `backend/app/models/__init__.py` — export new models
- `backend/app/domain/__init__.py` — export new service
- `backend/app/main.py` — mount new router

### Frontend
- `frontend/src/types/index.ts` — add new interfaces
- `frontend/src/lib/api.ts` — add new API functions
- `frontend/src/lib/hooks/index.ts` — re-export new hooks
- `frontend/src/components/layout/TopNav.tsx` — update nav href

---

## Out of Scope

- Auth/permissions (spec says "Permissions: None")
- Canva-like drag-and-drop canvas with positioned blocks
- Per-block styling (font, colour, font size)
- Connecting sketch dishes to actual Recipe records
- Export/print to PDF
- Existing `/menu` implementation — leave untouched

---

## Round 2 Feedback (Mar 2026)

Three areas of change applied on top of the Round 1 implementation. No backend changes.

### 1. List page — `frontend/src/app/menu-sketch/page.tsx`

- **Removed** the A4 thumbnail placeholder block (the `h-24` grey box with a paper icon inside each card)
- **Increased** menu name font size: `text-sm font-medium` → `text-base font-semibold` on the card `<h3>`

### 2. Hook — `frontend/src/lib/hooks/useMenuSketches.ts`

`useUpdateMenuSketch.onSuccess` now invalidates **both** the list-level and item-level cache keys so `updated_at` refreshes on the list page after every save:

```ts
onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: [SKETCHES_KEY] });             // added
  queryClient.invalidateQueries({ queryKey: [SKETCHES_KEY, variables.id] });
},
```

### 3. Editor page — `frontend/src/app/menu-sketch/[id]/page.tsx`

#### A. Drag-and-drop reordering (sections + dishes)

Uses the same `@dnd-kit/core` + `@dnd-kit/sortable` pattern already in the project (`MenuBuilder.tsx`).

- One `DndContext` wraps the entire sections list; nested `SortableContext`s handle dishes within each section
- IDs are prefix-based: `section-{i}` for sections, `dish-{sectionIdx}-{dishIdx}` for dishes
- `handleDragEnd` inspects the ID prefix to determine whether a section or dish was dropped, then calls `arrayMove` + `setSections`
- `SectionCard` receives `id` + `sectionIndex` props and calls `useSortable({ id })`; grip handle (`GripVertical`) added to section header
- `DishRow` (list view) and `DishCard` (card view) both receive `id` and call `useSortable({ id })`; grip handle added on the left of each row / top-left of each card
- `transform`, `transition`, and `opacity: 0.5` while dragging applied via inline `style`

#### B. Preview mode

- New `previewMode: boolean` state in the main component (default `false`)
- **Eye / Pencil toggle button** added to the top bar (after the List/Card view group, hidden in preview mode)
- When `previewMode` is `true`, the editor body is replaced by `<MenuSketchPreview sections={sections} />`
- View toggle group is hidden while in preview mode

**`MenuSketchPreview` layout** — for each section:
- Full-width dark header bar with section name
- Dishes rendered in **pairs** (2 per row) in a bordered grid
- Each pair has two rows: one for dish name + sale price + cost price, one for ingredients
- Odd dish (last in section with no pair) → left column only, right column is empty
- Uses `font-mono text-sm` for a structured, print-like feel

Helper `chunk<T>(arr, n)` splits an array into n-sized groups (inline, no external dependency).
