# Frontend API Fix

## 1. Structured Instructions Payload Mismatch

**Date**: 2025-12-03

**Issue**: 422 Unprocessable Entity when saving instruction steps

**Symptoms**:
- Browser console: `Failed to load resource: the server responded with a status of 422`
- Endpoint: `PATCH /api/v1/recipes/{id}/instructions/structured`

**Root Cause**:

The frontend was wrapping the payload in an extra layer:

```typescript
// Before (incorrect)
body: JSON.stringify({ instructions_structured: structured })
// Sent: { "instructions_structured": { "steps": [...] } }

// After (correct)
body: JSON.stringify(structured)
// Sends: { "steps": [...] }
```

The backend's `InstructionsStructured` Pydantic model expects `{ steps: [...] }` directly at the request body root, not nested inside another object.

**File Changed**: `frontend/src/lib/api.ts`

**Diff**:
```diff
 export async function updateStructuredInstructions(
   recipeId: number,
   structured: InstructionsStructured
 ): Promise<Recipe> {
   return fetchApi<Recipe>(`/recipes/${recipeId}/instructions/structured`, {
     method: 'PATCH',
-    body: JSON.stringify({ instructions_structured: structured }),
+    body: JSON.stringify(structured),
   });
 }
```

**Deployment**: Requires frontend redeploy to Vercel

---

## 2. Recipe Delete from List

**Date**: 2025-12-03

**Feature**: Quick delete for recipes in the left panel

**Design**: Hover-reveal trash icon with "click twice to confirm" pattern

- Trash icon (🗑️) appears on hover, hidden by default
- First click: icon turns red, indicating "armed" state
- Second click within 2 seconds: executes delete
- Auto-resets after 2 seconds if not confirmed
- Clears selection if the deleted recipe was currently selected

**File Changed**: `frontend/src/components/layout/LeftPanel.tsx`

**Key Changes**:
- Added `Trash2` icon import from lucide-react
- Added `useDeleteRecipe` hook import
- Updated `RecipeCard` component with `onDelete` prop and confirmation state
- Added `handleDelete` function with toast feedback

**UX Rationale**: Click-twice-to-confirm is more forgiving than modal dialogs but still prevents accidents. The 2-second timeout ensures users can't accidentally delete by double-clicking.

---

## 3. Double-Click to Create Ingredient

**Date**: 2025-12-03

**Feature**: Double-click anywhere in the ingredients panel to open the new ingredient form

**Design**: Event delegation with data attributes for precise targeting

- Double-click on empty space, list background, or empty state opens form
- Does NOT trigger when double-clicking on an existing ingredient card
- Updated hint text: "Drag to add to recipe • Double-click to create new"

**File Changed**: `frontend/src/components/layout/RightPanel.tsx`

**Key Changes**:
- Added `onDoubleClick` handler to ingredient list container
- Added `data-ingredient-card` attribute to `DraggableIngredientCard`
- Added `data-ingredient-list` attribute to list containers
- Uses `.closest()` for robust event target detection

**UX Rationale**: Reduces friction for rapid ingredient entry — no need to reach for the "New" button each time. Data attributes provide stable selectors that won't break if CSS classes change
