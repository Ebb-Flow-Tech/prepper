# Frontend Blueprint (Prepper)

Last updated: 2024-11-27

## Product Shape
- Single “recipe canvas” experience: one active recipe centered; ingredients and instructions support that context with drag-and-drop, inline edits, autosave, and immediate costing feedback.
- Principles: clarity, immediacy, reversibility. No auth, no save buttons; edits debounce → API; optimistic UX with toasts for feedback.

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
- `RecipeIngredientsList.tsx`: fetches recipe ingredients; sortable via dnd-kit; debounced quantity updates; unit select; remove; cost summary with tooltip; recalculates costing.
- `RecipeIngredientRow.tsx`: sortable row with grip, name, qty input (500ms debounce), unit select, line cost display, delete.
- `Instructions.tsx`: tabbed freeform vs structured steps. Freeform textarea autosaves (`updateRecipe`) after 800ms; “Format into steps” triggers parse → saves structured → switches tab.
- `InstructionsSteps.tsx`: structured step editor; draggable reorder with order renumbering; add/delete steps; saves full steps payload on change.
- `InstructionStepCard.tsx`: per-step editor with drag handle, textarea, timer (mm:ss parsing), temperature (°C); debounced saves.

## UI Kit (src/components/ui)
- `Button`, `Input`, `Select`, `Textarea`, `Badge`, `Skeleton`: Tailwind-styled primitives with size/variant props and focus states; dark-mode aware.

## State & Data Flow
- App context (`src/lib/store.tsx`): `selectedRecipeId`, `instructionsTab`; exposed via `useAppState`.
- React Query hooks (`src/lib/hooks/*`):
  - Recipes: list, detail, create, update, status, delete with invalidations of `['recipes']` and `['recipe', id]`.
  - Ingredients: list/create/update/deactivate invalidating `['ingredients']`.
  - Recipe ingredients: list/add/update/remove/reorder invalidating both ingredients and costing caches.
  - Instructions: update raw, parse (LLM), update structured; invalidates recipe cache.
  - Costing: fetch/recompute (no retry on 404) invalidating costing + recipe.
- API client (`src/lib/api.ts`): thin fetch wrapper with JSON, error surfacing via `ApiError`; endpoints mirror backend recipes/ingredients/instructions/costing routes.

## Types (src/types/index.ts)
- Core models: `Recipe`, `Ingredient`, `RecipeIngredient`, `InstructionsStructured` (array of `InstructionStep`), `CostingResult` with breakdown.
- Requests: create/update recipe, create/update ingredient, add/update/reorder recipe ingredients, parse instructions.

## Styling & Theming
- `src/app/globals.css`: Tailwind @import, CSS variables for light/dark backgrounds, custom scrollbars, focus outlines; fonts from `next/font` (Geist sans/mono).
- Dark mode via `prefers-color-scheme`; components use neutral palettes and border tokens.

## Key UX Behaviors
- Autosave with debounce on text/number inputs; minimal buttons (save/cancel only for some inline edits).
- Drag-and-drop flows: palette → canvas adds ingredient with default qty/unit; sortable rows/steps maintain order via backend reorder APIs.
- Feedback: Sonner toasts on successes/errors; skeletons and empty/error states across panels; cost tooltip explains per-portion math.

## Extensibility Notes
- Add new recipe/ingredient fields by updating types, API client, hooks invalidations, and relevant UI editors.
- If adding new server data, prefer new TanStack Query hooks with explicit `queryKey`s; keep `AppProvider` limited to UI state.
- Costing depends on ingredient base costs and recipe yield; ensure recalculation invalidates `['costing', recipeId]`.
