# Frontend Implementation Plan

A step-by-step guide to building the Recipe Builder frontend based on `frontend-blueprint.md`.

---

## Phase 1: Project Setup

### Step 1.1: Clean Up & Initialize

**Goal**: Fresh Next.js project with proper configuration

- [ ] Remove stale `node_modules/` and `.next/` directories
- [ ] Initialize new Next.js 15 project with TypeScript and Tailwind CSS
- [ ] Verify project runs with `npm run dev`

**Commands**:
```bash
cd frontend
rm -rf node_modules .next src public
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-turbopack
```

**Expected files**:
```
frontend/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
```

---

### Step 1.2: Configure Environment & API Client

**Goal**: Set up connection to FastAPI backend

- [ ] Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`
- [ ] Create `src/lib/api.ts` with typed fetch wrapper
- [ ] Add error handling utilities

**Key file**: `src/lib/api.ts`
```typescript
// Base API client with:
// - Automatic JSON parsing
// - Error handling
// - Type-safe request/response
```

---

### Step 1.3: Define TypeScript Types

**Goal**: Type definitions matching backend models

- [ ] Create `src/types/index.ts` with interfaces for:
  - `Ingredient` (id, name, base_unit, cost_per_base_unit, is_active)
  - `Recipe` (id, name, instructions_raw, instructions_structured, yield_quantity, yield_unit, cost_price, selling_price_est, status)
  - `RecipeIngredient` (id, recipe_id, ingredient_id, quantity, unit, sort_order, ingredient)
  - `CostingResult` (total_batch_cost, cost_per_portion, breakdown[])
  - `InstructionStep` (order, text, timer_seconds?, temperature_c?)

---

## Phase 2: Layout Shell

### Step 2.1: Three-Column Layout Structure

**Goal**: Basic layout matching blueprint wireframe

- [ ] Update `src/app/layout.tsx` with app metadata
- [ ] Create `src/app/page.tsx` with three-column grid
- [ ] Add responsive breakpoints (mobile stacks, tablet/desktop side-by-side)

**Layout structure**:
```
┌────────────────────────────────────────────────────────────────────┐
│ TopAppBar                                                          │
├───────────────┬───────────────────────────────┬────────────────────┤
│ LeftPanel     │         RecipeCanvas          │ RightPanel         │
│ (260-320px)   │         (flex-1)              │ (260-320px)        │
└───────────────┴───────────────────────────────┴────────────────────┘
```

**Files to create**:
- `src/components/layout/AppShell.tsx` - Main layout wrapper
- `src/components/layout/TopAppBar.tsx` - Header with recipe info
- `src/components/layout/LeftPanel.tsx` - Recipes list container
- `src/components/layout/RightPanel.tsx` - Ingredients palette container
- `src/components/layout/RecipeCanvas.tsx` - Central workspace

---

### Step 2.2: Top App Bar

**Goal**: Header displaying current recipe info

- [ ] App name/logo (left)
- [ ] Current recipe name (inline-editable text)
- [ ] Yield display (editable popover)
- [ ] Status dropdown (Draft/Active/Archived)
- [ ] Cost per portion (read-only)
- [ ] Est. selling price (editable)

**Interactions**:
- Recipe name: Click to edit, blur/Enter to save via `PATCH /recipes/{id}`
- Yield: Popover with quantity + unit inputs
- Status: Dropdown triggers `PATCH /recipes/{id}`

---

## Phase 3: Data Layer & State Management

### Step 3.1: API Hooks

**Goal**: React hooks for data fetching and mutations

- [ ] Create `src/lib/hooks/useRecipes.ts`
  - `useRecipes()` - List all recipes
  - `useRecipe(id)` - Single recipe with ingredients
  - `useCreateRecipe()` - POST mutation
  - `useUpdateRecipe()` - PATCH mutation
  - `useDeleteRecipe()` - DELETE mutation

- [ ] Create `src/lib/hooks/useIngredients.ts`
  - `useIngredients()` - List all active ingredients
  - `useCreateIngredient()` - POST mutation

- [ ] Create `src/lib/hooks/useRecipeIngredients.ts`
  - `useAddIngredient()` - POST to recipe
  - `useUpdateRecipeIngredient()` - PATCH quantity/unit
  - `useRemoveIngredient()` - DELETE
  - `useReorderIngredients()` - POST reorder

- [ ] Create `src/lib/hooks/useCosting.ts`
  - `useCosting(recipeId)` - GET costing breakdown

**State strategy**: Start with React Query (TanStack Query) for:
- Automatic caching
- Background refetching
- Optimistic updates
- Loading/error states

---

### Step 3.2: Application State

**Goal**: Client-side state for UI interactions

- [ ] Create `src/lib/store.ts` or use React Context for:
  - `selectedRecipeId` - Currently focused recipe
  - `isEditingName` - Inline edit states
  - `instructionsTab` - "freeform" | "steps"

---

## Phase 4: Left Panel - Recipes List

### Step 4.1: Recipe List Component

**Goal**: Scrollable list of recipes with selection

- [ ] Create `src/components/recipe/RecipeList.tsx`
- [ ] Create `src/components/recipe/RecipeCard.tsx`
  - Name (bold)
  - Yield subtitle
  - Status chip
  - Click to select

**API calls**:
- On mount: `GET /recipes`
- On click: Set `selectedRecipeId`, fetch `GET /recipes/{id}`

---

### Step 4.2: Recipe Search

**Goal**: Filter recipes by name

- [ ] Add search input above recipe list
- [ ] Client-side filtering (MVP)
- [ ] Debounced input (300ms)

---

### Step 4.3: Create Recipe Button

**Goal**: "+ New Recipe" button

- [ ] Button in panel header
- [ ] On click: `POST /recipes` with defaults:
  ```json
  { "name": "Untitled Recipe", "yield_quantity": 10, "yield_unit": "portion", "status": "draft" }
  ```
- [ ] Auto-select new recipe

---

## Phase 5: Right Panel - Ingredients Palette

### Step 5.1: Ingredient List Component

**Goal**: Draggable ingredients list

- [ ] Create `src/components/ingredient/IngredientList.tsx`
- [ ] Create `src/components/ingredient/IngredientCard.tsx`
  - Drag handle icon
  - Name (bold)
  - Unit + cost subtitle
  - Draggable for DnD

**API calls**:
- On mount: `GET /ingredients`

---

### Step 5.2: Ingredient Search

**Goal**: Filter ingredients by name

- [ ] Add search input above ingredient list
- [ ] Client-side filtering (MVP)

---

### Step 5.3: Create Ingredient Form

**Goal**: Inline form to add new ingredients

- [ ] "+ New Ingredient" button reveals inline form
- [ ] Fields: name, base_unit (dropdown), cost_per_base_unit
- [ ] On submit: `POST /ingredients`
- [ ] Collapse form on success

---

## Phase 6: Recipe Canvas - Ingredients Section

### Step 6.1: Recipe Ingredients List

**Goal**: Editable list of ingredients in current recipe

- [ ] Create `src/components/recipe/RecipeIngredientsList.tsx`
- [ ] Create `src/components/recipe/RecipeIngredientRow.tsx`
  - Drag handle (reorder)
  - Ingredient name (read-only)
  - Quantity input (numeric)
  - Unit dropdown
  - Line cost (calculated)
  - Delete button

**Interactions**:
- Quantity change: Debounced `PATCH /recipes/{id}/ingredients/{ri_id}`
- Unit change: `PATCH /recipes/{id}/ingredients/{ri_id}`
- Delete: `DELETE /recipes/{id}/ingredients/{ri_id}`

---

### Step 6.2: Drag-and-Drop from Palette

**Goal**: Add ingredients by dragging from right panel

- [ ] Install drag-and-drop library (e.g., `@dnd-kit/core`)
- [ ] Make ingredient cards draggable
- [ ] Make recipe ingredients section a drop zone
- [ ] On drop: `POST /recipes/{id}/ingredients` with:
  ```json
  { "ingredient_id": "<id>", "quantity": 1, "unit": "<base_unit>" }
  ```

---

### Step 6.3: Reorder Ingredients

**Goal**: Drag to reorder within recipe

- [ ] Enable vertical drag-and-drop reordering
- [ ] On drop: `POST /recipes/{id}/ingredients/reorder` with ordered IDs

---

### Step 6.4: Cost Summary

**Goal**: Display batch and portion costs

- [ ] Add footer to ingredients section:
  - Total batch cost: $XX.XX
  - Cost per portion: $X.XX
- [ ] Fetch from `GET /recipes/{id}/costing`
- [ ] Refresh on ingredient add/update/remove

---

## Phase 7: Recipe Canvas - Instructions Section

### Step 7.1: Tab Toggle

**Goal**: Switch between Freeform and Steps views

- [ ] Create `src/components/recipe/Instructions.tsx`
- [ ] Tab toggle: "Freeform" | "Steps"
- [ ] Persist tab choice in local state

---

### Step 7.2: Freeform Tab

**Goal**: Multiline textarea for raw instructions

- [ ] Create `src/components/recipe/InstructionsFreeform.tsx`
- [ ] Textarea bound to `recipe.instructions_raw`
- [ ] Debounced save: `PATCH /recipes/{id}` with `{ instructions_raw: "..." }`
- [ ] "Format into steps" button

**Format button**:
- Calls `POST /recipes/{id}/instructions/parse`
- On success: Saves structured result, switches to Steps tab

---

### Step 7.3: Steps Tab

**Goal**: Editable structured instruction steps

- [ ] Create `src/components/recipe/InstructionsSteps.tsx`
- [ ] Create `src/components/recipe/InstructionStepCard.tsx`
  - Step number
  - Text field (multiline)
  - Timer input (mm:ss)
  - Temperature input (°C)
  - Drag handle
  - Delete button

**Interactions**:
- Edit any field: Update local JSON, debounced `PATCH /recipes/{id}` with full `instructions_structured`
- Reorder: Drag-and-drop, renumber, save
- Delete: Remove step, renumber, save

---

## Phase 8: Polish & UX

### Step 8.1: Loading States

- [ ] Skeleton loaders for recipe and ingredient lists
- [ ] Spinner overlay on recipe canvas during fetch
- [ ] Disabled states when no recipe selected

---

### Step 8.2: Error Handling

- [ ] Toast/snackbar for API errors
- [ ] Retry button for critical failures
- [ ] Optimistic UI with rollback on error

---

### Step 8.3: Empty States

- [ ] "No recipe selected" placeholder in canvas
- [ ] "No recipes yet" + create button in left panel
- [ ] "No ingredients" guidance in right panel

---

### Step 8.4: Responsive Design

- [ ] iPad landscape (primary target): Three-column
- [ ] Desktop: Three-column with wider panels
- [ ] Tablet portrait: Collapsible side panels
- [ ] Mobile: Stack with tab navigation (future)

---

## Phase 9: Testing & Documentation

### Step 9.1: Component Tests

- [ ] Set up Vitest or Jest
- [ ] Unit tests for API hooks
- [ ] Component tests for key interactions

---

### Step 9.2: Integration Tests

- [ ] E2E tests with Playwright or Cypress
- [ ] Happy path: Create recipe, add ingredients, write instructions, view costing

---

### Step 9.3: Documentation

- [ ] Update `docs/changelog.md` with frontend progress
- [ ] Create `frontend/README.md` with setup instructions
- [ ] Document component architecture

---

## Implementation Order (Recommended)

| Order | Phase | Estimated Effort |
|-------|-------|------------------|
| 1 | Phase 1: Project Setup | 1-2 hours |
| 2 | Phase 2: Layout Shell | 2-3 hours |
| 3 | Phase 3: Data Layer | 3-4 hours |
| 4 | Phase 4: Recipes List | 2-3 hours |
| 5 | Phase 5: Ingredients Palette | 2-3 hours |
| 6 | Phase 6: Recipe Ingredients | 4-5 hours |
| 7 | Phase 7: Instructions | 3-4 hours |
| 8 | Phase 8: Polish | 2-3 hours |
| 9 | Phase 9: Testing | 3-4 hours |

**Total estimated effort**: 22-31 hours

---

## Dependencies to Install

```bash
npm install @tanstack/react-query    # Data fetching & caching
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities  # Drag and drop
npm install sonner                   # Toast notifications
npm install lucide-react             # Icons
npm install clsx tailwind-merge      # Utility for className merging
```

---

## Notes

- **No authentication** - Single shared workspace per blueprint
- **Autosave everywhere** - No explicit save buttons
- **Optimistic UI** - Update immediately, revert on failure
- **Mobile is deferred** - Focus on iPad landscape first

---

*Blueprint reference: `docs/plans/frontend-blueprint.md`*
