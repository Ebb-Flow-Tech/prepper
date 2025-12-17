# Plan 03: Frontend - New Pages

**Completed**: 2025-12-17
**Status**: Implemented

---

## Summary

Expanded the frontend from a single recipe canvas to a multi-page application with five dedicated views:

- `/` — Recipe Canvas (existing)
- `/ingredients` — Ingredients Library (new)
- `/recipes` — Recipes Gallery (new)
- `/recipes/[id]` — Individual Recipe Page (new)
- `/rnd` — R&D Workspace (new)
- `/finance` — Finance Reporting placeholder (new)

---

## Implementation Details

### 1. Top Navigation (`TopNav.tsx`)

**File**: `frontend/src/components/layout/TopNav.tsx`

Created a persistent top navigation bar that appears on all pages. Features:
- Logo and app name linking to home
- Five navigation links with active state highlighting
- Icons for each section (using lucide-react)
- Responsive design: icons only on mobile, icons + labels on desktop

**Integration**: Added to root layout (`app/layout.tsx`) so it appears on all pages.

```tsx
// Navigation structure
const NAV_ITEMS = [
  { href: '/', label: 'Canvas', icon: ChefHat },
  { href: '/ingredients', label: 'Ingredients', icon: Package },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/rnd', label: 'R&D', icon: FlaskConical },
  { href: '/finance', label: 'Finance', icon: DollarSign },
];
```

---

### 2. Shared UI Components

Created reusable components for the new pages:

| Component | File | Purpose |
|-----------|------|---------|
| `Card` | `ui/Card.tsx` | Card container with header, title, content, footer sub-components |
| `MasonryGrid` | `ui/MasonryGrid.tsx` | Pinterest-style responsive grid using `react-masonry-css` |
| `GroupSection` | `ui/GroupSection.tsx` | Section with title, count badge, and grid children |
| `PageHeader` | `ui/PageHeader.tsx` | Page title, description, and action buttons |
| `SearchInput` | `ui/SearchInput.tsx` | Search input with icon and clear button |

**Library Added**: `react-masonry-css` for masonry grid layout

---

### 3. Ingredients Page (`/ingredients`)

**Files**:
- `frontend/src/app/ingredients/page.tsx`
- `frontend/src/components/ingredients/IngredientCard.tsx`

**Features**:
- Grid display of all ingredients with card layout
- Search by name (debounced)
- Group by: None, Unit type, or Status (Active/Archived)
- Toggle to show/hide archived ingredients
- Each card shows: name, cost per unit, unit badge
- Placeholder for image upload (button visible but disabled)
- Quick action buttons on hover: Edit, Archive

**Why this approach**: The plan specified grouping by Supplier as default, but since supplier data isn't populated in the current types/API, we defaulted to simpler grouping options that work with existing data. This can be enhanced when Plan 01's supplier types are integrated into the frontend.

---

### 4. Recipes Gallery (`/recipes`)

**Files**:
- `frontend/src/app/recipes/page.tsx`
- `frontend/src/components/recipes/RecipeCard.tsx`

**Features**:
- Grid display of all recipes with clickable cards
- Search by name
- Filter by status: All, Draft, Active, Archived
- Group by: None or Status
- Each card shows: name, yield, status badge, cost per portion
- Placeholder for recipe image
- Click navigates to `/recipes/[id]`

**Why this approach**: The plan specified grouping by Outlet, but since outlet data isn't available in the Recipe type yet, we used Status as the default grouping. This aligns with the most useful filter for kitchen operations and can be enhanced when outlets are integrated.

---

### 5. Individual Recipe Page (`/recipes/[id]`)

**File**: `frontend/src/app/recipes/[id]/page.tsx`

**Layout**:
```
┌─────────────────────────────────────┐
│ ← Back to Recipes        [Edit btn] │
├─────────────────────────────────────┤
│ [Image placeholder] Recipe Name     │
│                     Yield, Status   │
│                     Created/Updated │
├─────────────────────────────────────┤
│  COSTING        │  INGREDIENTS      │
│  Batch cost     │  • Item 1         │
│  Per portion    │  • Item 2         │
│  Margin         │  ...              │
├─────────────────────────────────────┤
│  INSTRUCTIONS                       │
│  1. Step one                        │
│  2. Step two (with timer/temp)      │
│  ...                                │
└─────────────────────────────────────┘
```

**Features**:
- Full recipe details with costing breakdown
- Ingredients list with quantities
- Structured instructions with timers and temperatures
- Falls back to raw instructions if no structured steps
- "Edit in Canvas" button links back to home with recipe selected
- Placeholder for hero image

**Why this approach**: This is a read-focused view complementing the Canvas which is edit-focused. Users can browse recipes and their costs without the overhead of the drag-and-drop canvas.

---

### 6. R&D Workspace (`/rnd`)

**File**: `frontend/src/app/rnd/page.tsx`

**Features**:
- **Ingredient Search**: Quick search to find ingredients for experimentation
- **My Experiments**: Shows all draft recipes (treating "draft" as "experimental")
- **Compare Variants**: Placeholder for side-by-side comparison (coming soon)
- **Tasting Sessions**: Placeholder for tasting notes (coming soon)
- Link to Canvas for creating new experiments

**Why this approach**: Per the plan, "finalization" is implicit — a recipe is experimental if it's not linked to an Atlas menu item. Since Atlas integration isn't built yet, we use `status === 'draft'` as a proxy for "experimental" recipes.

---

### 7. Finance Page (`/finance`)

**File**: `frontend/src/app/finance/page.tsx`

**Status**: Placeholder only (blocked by Atlas integration)

**Features**:
- Summary cards (Total Sales, COGS, Gross Margin) — placeholder values
- Sales + COGS by Recipe table — skeleton rows
- Margin Bandwidth chart — placeholder
- Clear notice that Atlas integration is required

**Why placeholder**: The Finance page requires sales data from Atlas POS (Plan 04). This placeholder establishes the UI structure and navigation while clearly communicating the dependency.

---

## Layout Changes

### Root Layout (`app/layout.tsx`)

Modified to include:
- `TopNav` component for global navigation
- Flex container structure: `TopNav` + `main` content area
- Content area fills remaining height (`flex-1 overflow-hidden`)

### AppShell Changes

- Removed redundant `h-screen` (now handled by root layout)
- Changed to `h-full` to fill parent container

### TopAppBar Changes

- Removed logo and "Prepper" text (now in TopNav)
- Reduced height from `h-16` to `h-14`
- Removed left margin from recipe name section

---

## Files Created

```
frontend/src/
├── app/
│   ├── ingredients/
│   │   └── page.tsx
│   ├── recipes/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── rnd/
│   │   └── page.tsx
│   └── finance/
│       └── page.tsx
├── components/
│   ├── layout/
│   │   └── TopNav.tsx
│   ├── ingredients/
│   │   ├── IngredientCard.tsx
│   │   └── index.ts
│   ├── recipes/
│   │   ├── RecipeCard.tsx
│   │   └── index.ts
│   └── ui/
│       ├── Card.tsx
│       ├── MasonryGrid.tsx
│       ├── GroupSection.tsx
│       ├── PageHeader.tsx
│       └── SearchInput.tsx
```

## Files Modified

- `frontend/src/app/layout.tsx` — Added TopNav, restructured layout
- `frontend/src/components/layout/AppShell.tsx` — Height adjustment
- `frontend/src/components/layout/TopAppBar.tsx` — Removed logo, height adjustment
- `frontend/src/components/layout/index.ts` — Export TopNav
- `frontend/src/components/ui/index.ts` — Export new components

---

## Design Decisions

### 1. No Masonry Grid Used (Yet)

The `MasonryGrid` component was created but not used in the final implementation. The standard CSS grid with `GroupSection` provided better visual consistency. Masonry can be enabled later for pages where variable-height content makes sense.

### 2. Image Placeholders

All image upload functionality shows as disabled placeholder buttons. This follows the decision to use Supabase Storage for images but skip implementation for now.

### 3. Responsive Design

- TopNav: Icons only on mobile, icons + labels on tablet+
- Page layouts: Single column on mobile, multi-column on larger screens
- Search/filter toolbars: Stack vertically on mobile, horizontal on desktop

### 4. Status as Default Grouping

For recipes, Status grouping is more useful than alphabetical for kitchen operations. Active recipes at the top, drafts for experiments, archived for reference.

---

## Future Enhancements

When Plan 01/02 types are integrated into frontend:

1. **Ingredients page**: Add grouping by Supplier, Category, Master Ingredient
2. **Recipes page**: Add grouping by Outlet, filter by supplier
3. **Recipe detail**: Add sub-recipes section, outlet badges, author info
4. **R&D page**: Implement variant comparison functionality
5. **Finance page**: Integrate with Atlas for real sales data

---

## Testing

Build verified with `npm run build` — all new pages compile successfully.

Routes generated:
- `○ /ingredients` (static)
- `○ /recipes` (static)
- `ƒ /recipes/[id]` (dynamic)
- `○ /rnd` (static)
- `○ /finance` (static)
