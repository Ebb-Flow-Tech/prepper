# Frontend Blueprint (Prepper)

Last updated: 2025-01-02

## Product Shape
- Single "recipe canvas" experience: one active recipe centered; ingredients and instructions support that context with drag-and-drop, inline edits, autosave, and immediate costing feedback.
- Principles: clarity, immediacy, reversibility. No auth, no save buttons; edits debounce → API; optimistic UX with toasts for feedback.
- Supplier integration: ingredients link to suppliers with per-supplier pricing; recipe ingredients track their supplier source and unit price.

## Stack & Runtime
- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4.
- State/query: TanStack Query for server state; lightweight `AppProvider` context for UI state (selected recipe, instructions tab).
- Interaction: `@dnd-kit` for drag-and-drop (ingredients → recipe, sorting steps/rows), Sonner for toasts, Lucide icons.
- Env: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1` in `src/lib/api.ts`).

## Application Layout (src/components/layout)
- `AppShell.tsx`: wraps app in `DndContext` + drag overlay; composes `TopAppBar`, `LeftPanel`, `RecipeCanvas`, `RightPanel`.
- `TopAppBar.tsx`: shows/edits name, yield, status, selling price; pulls recipe + costing; inline edit with debounced saves and Select for status; cost per portion pill.
- `LeftPanel.tsx`: recipe list with search and “New” button; selects recipe via context; shows status badges; handles empty/error/loading states.
- `RecipeCanvas.tsx`: droppable area for ingredients; shows empty state if no recipe; renders `RecipeIngredientsList` + `Instructions` for selected recipe; highlights on drag-over.
- `RightPanel.tsx`: ingredient palette with search, inline create form, draggable cards (base unit + cost).

## Recipe Workspace (src/components/recipe)
- `RecipeIngredientsList.tsx`: fetches recipe ingredients; sortable via dnd-kit; debounced quantity updates; unit select; supplier select; unit price edit; remove; cost summary with tooltip; recalculates costing. Handlers: `handleQuantityChange`, `handleUnitChange`, `handleUnitPriceChange`, `handleSupplierChange`.
- `RecipeIngredientRow.tsx`: sortable row with grip, name, supplier dropdown, qty input (500ms debounce), unit select, unit price input (500ms debounce), base unit display, line cost display, delete. Fetches ingredient suppliers to populate supplier dropdown.
- `Instructions.tsx`: tabbed freeform vs structured steps. Freeform textarea autosaves (`updateRecipe`) after 800ms; "Format into steps" triggers parse → saves structured → switches tab.
- `InstructionsSteps.tsx`: structured step editor; draggable reorder with order renumbering; add/delete steps; saves full steps payload on change.
- `InstructionStepCard.tsx`: per-step editor with drag handle, textarea, timer (mm:ss parsing), temperature (°C); debounced saves.

## UI Kit (src/components/ui)
- `Button`, `Input`, `Select`, `Textarea`, `Badge`, `Skeleton`: Tailwind-styled primitives with size/variant props and focus states; dark-mode aware.
- `Card`, `CardHeader`, `CardTitle`, `CardContent`: composable card components for list items (ingredients, recipes).
- `GroupSection`, `PageHeader`, `SearchInput`, `MasonryGrid`: layout primitives for pages and lists.

## State & Data Flow
- App context (`src/lib/store.tsx`): `selectedRecipeId`, `instructionsTab`; exposed via `useAppState`.
- React Query hooks (`src/lib/hooks/*`):
  - Recipes: list, detail, create, update, status, delete with invalidations of `['recipes']` and `['recipe', id]`.
  - Ingredients: list/create/update/deactivate invalidating `['ingredients']`. Includes ingredient-supplier hooks: `useIngredientSuppliers`, `useAddIngredientSupplier`, `useUpdateIngredientSupplier`, `useRemoveIngredientSupplier`.
  - Recipe ingredients: list/add/update/remove/reorder invalidating both ingredients and costing caches. Update supports `quantity`, `unit`, `base_unit`, `unit_price`, `supplier_id`.
  - Instructions: update raw, parse (LLM), update structured; invalidates recipe cache.
  - Costing: fetch/recompute (no retry on 404) invalidating costing + recipe.
  - Suppliers: list/create via `useSuppliers`, `useCreateSupplier`.
  - Tastings: session CRUD (`useTastingSessions`, `useTastingSession`, `useCreateTastingSession`, `useUpdateTastingSession`, `useDeleteTastingSession`), notes CRUD (`useSessionNotes`, `useAddNoteToSession`, `useUpdateTastingNote`, `useDeleteTastingNote`), recipe history (`useRecipeTastingNotes`, `useRecipeTastingSummary`).
- API client (`src/lib/api.ts`): thin fetch wrapper with JSON, error surfacing via `ApiError`; endpoints mirror backend routes for recipes, ingredients, instructions, costing, suppliers, ingredient-suppliers, and tasting sessions/notes.

## Types (src/types/index.ts)
- Core models: `Recipe`, `Ingredient`, `RecipeIngredient` (includes `base_unit`, `unit_price`, `supplier_id`), `InstructionsStructured` (array of `InstructionStep`), `CostingResult` with breakdown.
- Supplier models: `Supplier`, `IngredientSupplierEntry` (with pack size, price, currency, preferred flag).
- Tasting models: `TastingSession`, `TastingNote`, `TastingNoteWithRecipe`, `RecipeTastingSummary`, `TastingSessionStats`, `TastingDecision`.
- Requests: create/update recipe, create/update ingredient, add/update/reorder recipe ingredients (with `base_unit`, `unit_price`, `supplier_id`), parse instructions, supplier CRUD, ingredient-supplier CRUD, tasting session/note CRUD.

## Styling & Theming
- `src/app/globals.css`: Tailwind @import, CSS variables for light/dark backgrounds, custom scrollbars, focus outlines; fonts from `next/font` (Geist sans/mono).
- Dark mode via `prefers-color-scheme`; components use neutral palettes and border tokens.

## Key UX Behaviors
- Autosave with debounce on text/number inputs; minimal buttons (save/cancel only for some inline edits).
- Drag-and-drop flows: palette → canvas adds ingredient with preferred supplier's pricing (or ingredient defaults); sortable rows/steps maintain order via backend reorder APIs.
- Supplier-aware costing: when adding ingredient to recipe, uses preferred supplier's `cost_per_unit` and `pack_unit`; recipe ingredient rows allow changing supplier which updates `unit_price` and `base_unit`.
- Feedback: Sonner toasts on successes/errors; skeletons and empty/error states across panels; cost tooltip explains per-portion math.

## Extensibility Notes
- Add new recipe/ingredient fields by updating types, API client, hooks invalidations, and relevant UI editors.
- If adding new server data, prefer new TanStack Query hooks with explicit `queryKey`s; keep `AppProvider` limited to UI state.
- Costing depends on recipe ingredient `unit_price` and recipe yield; ensure recalculation invalidates `['costing', recipeId]`.
- Supplier pricing flows: ingredient → suppliers (with pack sizes/prices) → recipe ingredient (snapshot of unit_price, base_unit, supplier_id).
