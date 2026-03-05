# Prepper Feedback Implementation Plan (v2)

## Context
User feedback identified UX issues in the recipe builder: confusing "Tags" label, hidden top bar, abbreviated "D&D" label in the wrong location, missing save option in the unsaved changes modal, and a need for auto-converting measurements when changing ingredient units.

---

## Change 1: Rename "Tags" → "Category" in Overview Tab

**File:** `frontend/src/components/layout/tabs/OverviewTab.tsx`

Text replacements across lines 290–404:
| Line | Old | New |
|------|-----|-----|
| 290 | `{/* Tags Section */}` | `{/* Category Section */}` |
| 294 | `Tags` | `Category` |
| 297 | `{/* Current Tags */}` | `{/* Current Categories */}` |
| 322 | `title="Remove tag"` | `title="Remove category"` |
| 331 | `No tags added yet` | `No categories added yet` |
| 336 | `{/* Add Tag Button */}` | `{/* Add Category Button */}` |
| 345 | `Add Tag` | `Add Category` |
| 357 | `Search tags...` | `Search categories...` |
| 393 | `No matching tags` → `No matching categories`, `All tags added` → `All categories added` |
| 400 | `No tags available` | `No categories available` |

---

## Change 2: Add "Save & Leave" to Unsaved Changes Modal

**Why:** Currently users can only "Stay" or "Leave" when they have unsaved canvas changes. They want to save first, then navigate away.

### 2a: Expose canvas save handler via store

**File:** `frontend/src/lib/store.tsx`
- Add to AppState: `canvasSaveHandler: (() => Promise<void>) | null`
- Add to AppState: `setCanvasSaveHandler: (handler: (() => Promise<void>) | null) => void`
- Initialize `canvasSaveHandler: null` in defaults
- Implement setter in store

### 2b: Register save handler from CanvasTab

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`
- On mount (when `canvasTab === 'canvas'`), register `onSubmit` as the canvas save handler via `setCanvasSaveHandler`
- On unmount, clear it: `setCanvasSaveHandler(null)`

### 2c: Replace ConfirmModal with 3-button modal in TopAppBar

**File:** `frontend/src/components/layout/TopAppBar.tsx`
- Replace `<ConfirmModal>` with a custom inline modal (same styling pattern)
- Three buttons:
  - **Stay** (outline) — closes modal, stays on canvas
  - **Save & Leave** (primary) — calls `canvasSaveHandler()`, then switches to pending tab
  - **Leave** (destructive) — switches tab without saving
- Import `canvasSaveHandler` from `useAppState()`

---

## Change 3: Top Bar Open by Default

### 3a: Details panel expanded by default

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`
- Line 1363: `useState(false)` → `useState(true)`

### 3b: Show tabs on new recipe page

**File:** `frontend/src/app/recipes/new/page.tsx`
- Line 17: `showTabs={false}` → `showTabs={true}`

---

## Change 4: Rename "D&D" → "Drag and Drop" & Move to Library

### 4a: Remove from CanvasTab top bar

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`
- Lines 1479–1485: Remove the `<div>` containing the Switch + "D&D" label

### 4b: Add to RightPanel Library header

**File:** `frontend/src/components/layout/RightPanel.tsx`
- In the Library header section (line ~460), add a Switch toggle with "Drag and Drop" label
- Reuse `isDragDropEnabled` and `setIsDragDropEnabled` from `useAppState()` (already used in this file at line 31)
- Import `Switch` component
- Place it in the header bar between the title and the action buttons

---

## Change 5: Auto-Convert Quantity on Unit Change (Staged Ingredient Cards)

**Why:** When a user changes an ingredient's unit in the canvas drop zone (e.g., g → kg), the quantity should auto-convert (e.g., 500 → 0.5). This modifies the staged data.

**Scope:** The staged ingredient cards in the canvas tab (`StagedIngredientCard`, `StagedIngredientListItem`, and table view).

### 5a: Create frontend unit conversion utility

**New file:** `frontend/src/lib/unitConversion.ts`

Mirror the backend logic from `backend/app/utils/unit_conversion.py`:
```ts
const MASS_CONVERSIONS: Record<string, number> = {
  g: 1, kg: 1000, mg: 0.001, oz: 28.3495, lb: 453.592,
};
const VOLUME_CONVERSIONS: Record<string, number> = {
  ml: 1, l: 1000, cl: 10, dl: 100, tsp: 4.92892,
  tbsp: 14.7868, cup: 236.588, fl_oz: 29.5735,
};
const COUNT_CONVERSIONS: Record<string, number> = {
  pcs: 1, dozen: 12,
};

export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null
```

Returns `null` if units are incompatible (different categories). Returns converted quantity otherwise.

Also export `getCompatibleUnits(unit: string): string[]` to filter the dropdown to only show compatible units.

### 5b: Add `unit` field to `StagedIngredient` interface

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`

- Line 44–52: Add `unit: string` to `StagedIngredient` interface
- Line 1827–1835 (new ingredient creation): Set `unit: ingredient.base_unit`
- Line 2062–2070 (drag-drop creation): Set `unit: dragItem.ingredient.base_unit`
- Line 1926–1944 (loading from existing recipe): Set `unit: ri.unit`

### 5c: Add unit change handler

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`

Add `handleIngredientUnitChange` callback (near line 2118):
```ts
const handleIngredientUnitChange = useCallback((id: string, newUnit: string) => {
  setStagedIngredients((prev) =>
    prev.map((item) => {
      if (item.id !== id) return item;
      const converted = convertUnit(item.quantity, item.unit, newUnit);
      return {
        ...item,
        unit: newUnit,
        quantity: converted ?? item.quantity,
      };
    })
  );
}, []);
```

### 5d: Add unit dropdown to `StagedIngredientCard`

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`

In `StagedIngredientCard` (line 190–392):
- Add `onUnitChange: (unit: string) => void` prop
- Replace static `{staged.ingredient.base_unit}` label (line 294) with a `<select>` dropdown
- Show UNIT_OPTIONS filtered to compatible units (same category: mass/volume/count)
- Use `staged.unit` for the value
- Also update cost display references from `staged.ingredient.base_unit` to `staged.unit`

### 5e: Add unit dropdown to `StagedIngredientListItem`

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`

In `StagedIngredientListItem` (line 394–495):
- Add `onUnitChange: (unit: string) => void` prop
- Replace static `{staged.ingredient.base_unit}` (lines 423, 471) with a `<select>` dropdown
- Use `staged.unit` for the value

### 5f: Update table view

- Line 1030: Replace `{staged.ingredient.base_unit}` with `{staged.unit}` and add a select dropdown

### 5g: Update save flow to use `staged.unit`

**File:** `frontend/src/components/layout/tabs/CanvasTab.tsx`

- Lines 2549, 2561, 2575, 2647, 2656: Change unit resolution to use `staged.unit` as the `unit` field
- Keep `base_unit` as `selectedSupplier?.pack_unit ?? staged.ingredient.base_unit` (unchanged — this is the pricing base)

### 5h: Pass `onUnitChange` to components

Update all render sites where `StagedIngredientCard` and `StagedIngredientListItem` are used to pass the new `onUnitChange` prop

---

## Files Summary

| File | Change |
|------|--------|
| `frontend/src/components/layout/tabs/OverviewTab.tsx` | Rename "Tags" → "Category" |
| `frontend/src/lib/store.tsx` | Add `canvasSaveHandler` to store |
| `frontend/src/components/layout/tabs/CanvasTab.tsx` | Add `unit` to StagedIngredient; unit change handler; unit dropdowns on cards/list; register save handler; expand details by default; remove D&D toggle; update save flow |
| `frontend/src/components/layout/TopAppBar.tsx` | 3-button unsaved changes modal |
| `frontend/src/app/recipes/new/page.tsx` | `showTabs={true}` |
| `frontend/src/components/layout/RightPanel.tsx` | Add "Drag and Drop" toggle |
| `frontend/src/lib/unitConversion.ts` | **New** — unit conversion utility (mirrors backend) |

---

## Verification

1. `cd frontend && npm run lint && npm run build` — no build errors
2. Manual tests:
   - `/recipes/[id]` → Overview tab → verify all "Tags" renamed to "Category"
   - `/recipes/[id]` → Canvas tab → make changes → click another tab → verify 3-button modal (Stay / Save & Leave / Leave)
   - `/recipes/new` → verify top bar tabs visible and details panel expanded
   - `/recipes/[id]` → Canvas tab → verify details panel expanded by default
   - Canvas tab → verify D&D toggle is no longer in the collapsible options bar
   - Library panel (right side) → verify "Drag and Drop" toggle present and functional
   - Canvas tab → add ingredient → change unit dropdown on staged card (g → kg) → verify quantity auto-converts (e.g., 500 → 0.5)
   - Canvas tab → change unit to incompatible category (g → ml) → verify dropdown only shows compatible units
   - Canvas tab → save recipe with custom unit → verify correct unit is persisted to backend
3. `cd backend && pytest` — no regressions
