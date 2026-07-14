# Plan 24: Menu Feedback (Jordan Discussion — Apr 2026)

Source: https://www.notion.so/Feedback-as-per-discussion-with-Jordan-341ca9b8c2ee8020aec6f603848bfd99

---

## Essentials (DO FIRST)

### 1. Navbar: Create top-level `Menu` item with two sub-tabs

**Context:** Currently `/menu-sketch` is labelled "Drafts" in the nav and "Recipe Menus" is hidden as a tab under the Recipes page. Jordan wants a clear top-level `Menu` entry replacing `Drafts`, with two distinct areas.

**Changes:**
- `frontend/src/components/layout/TopNav.tsx` — rename "Drafts" nav entry to `Menu`, pointing to `/menu`
- `frontend/src/app/menu/page.tsx` — turn into a two-tab hub:
  - **Draft Menus** → renders `/menu-sketch` list (quick brainstorm canvas)
  - **Recipe Menus** → renders the current `MenuPage` (recipe-linked menus with actual recipes/costing)
- `frontend/src/app/recipes/page.tsx` — remove the "Menus" tab since it moves out
- `frontend/src/lib/store.tsx` — remove `menus` from the `RecipeTab` type

---

### 2. Menu sketch editor: Default to edit mode

**Context:** `previewMode` is initialised `true` at line 779 of `menu-sketch/[id]/page.tsx`. Should default to `false`.

**Changes:**
- `frontend/src/app/menu-sketch/[id]/page.tsx:779` — change `useState(true)` → `useState(false)`

---

### 3. Menu sketch editor: Unsaved changes indicator

**Context:** There is a Save button but no dirty-state tracking. Users don't know if they have unsaved work.

**Changes:**
- Add `isDirty` boolean state; set `true` on any edit to sections/notes/name, reset `false` on successful save
- Render a small "Unsaved changes" indicator in the top bar (beside menu name or near the Save button), consistent with how the recipe canvas surfaces `canvasHasUnsavedChanges`

---

### 4. Edit mode: Remove collapsible description

**Context:** Description is hidden behind a `descOpen` toggle (lines 232, 349, 410, 518). This adds friction for users filling in dish details.

**Changes:**
- `frontend/src/app/menu-sketch/[id]/page.tsx` — remove `descOpen` state and the `ChevronDown/Up` toggle button from both `ListDishRow` and `CardDishRow`; always render the description textarea unconditionally

---

### 5. Edit mode: Link existing recipes to a dish

**Context:** Users should be able to search the recipe database and attach an existing recipe to a dish entry (to pre-populate name and ingredients). "Add new dish" does NOT create a recipe record — it only adds a dish to this menu sketch.

**Changes:**
- Add a "Search recipes" async combobox inside each dish row (edit mode): queries the existing `useRecipes` hook, filters by typed name, allows clicking to populate `dish.name` and optionally `dish.ingredients`
- Store an optional `recipe_id?: number` on `SketchDish` (frontend-only JSON field; no backend schema change needed)
- "Add new dish" button behaviour unchanged

---

### 6. Edit mode: Rename "Ingredients" → "Key ingredients"

**Changes:**
- `frontend/src/app/menu-sketch/[id]/page.tsx` — update all label instances of `"Ingredients"` in dish rows to `"Key ingredients"`

---

### 7. Preview mode: Description directly below dish name

**Context:** Description should always appear immediately under the dish name in preview (when non-empty), not shifted or conditionally repositioned.

**Changes:**
- `frontend/src/app/menu-sketch/[id]/page.tsx` — in the preview dish block (~lines 120–140), ensure description renders immediately after dish name

---

### 8. Preview mode: Display field toggles

**Context:** Users want to show/hide display fields without deleting data. Toggle-able fields: description, ingredients, cost margins, comments.

**Changes:**
- Add `displayOptions` state: `{ description: boolean, ingredients: boolean, costMargins: boolean, comments: boolean }` defaulting all `true`
- Add a "Display" button / gear dropdown in preview mode's top bar with checkboxes per field
- Conditionally render each field in preview based on `displayOptions`

---

### Implementation Order (recommended)
1. Items 2, 6, 7 — trivial one-liners
2. Item 4 — remove collapsible description
3. Items 3, 8 — unsaved indicator + display toggles
4. Item 5 — recipe search combobox
5. Item 1 — navbar restructure (most impactful, do last once inner pages are stable)

---

## Delighters (separate commit)

### D1. Edit mode: Highlight tickbox per dish

**Changes:**
- Add `is_highlight?: boolean` to `SketchDish` type (`frontend/src/types/index.ts`)
- Render a "Highlight" checkbox in each dish row (edit mode)
- Persisted in `sections` JSON — no backend schema change

---

### D2. Edit mode: Dish icon/tag selector (collapsible dropdown)

**Changes:**
- Add `icons?: string[]` to `SketchDish` type (values: `signature | spicy | vegetarian | seafood | beef | pork | nuts`)
- Collapsible "Tags" section inside each dish row with 7 checkboxes
- Stored in `SketchDish.icons` within `sections` JSON

---

### D3. Preview mode: Show icons beside dish name

**Changes:**
- Map each icon key to a Lucide icon (or emoji fallback)
- Render active icons inline to the right of the dish name in preview

---

### D4. Preview mode: Colour-code highlighted dishes

**Changes:**
- If `is_highlight === true`, apply an accent background to the dish row in preview (e.g. amber/orange tint)
