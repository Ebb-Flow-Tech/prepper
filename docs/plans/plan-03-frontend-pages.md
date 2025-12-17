# Plan 03: Frontend - New Pages

**Status**: Draft
**Priority**: Medium-High
**Dependencies**: Plan 01 (Ingredient enhancements), Plan 02 (Recipe extensions)

---

## Overview

Expand the frontend from a single recipe canvas to a multi-page application with dedicated views for ingredients, recipes, R&D, and finance. Uses Pinterest-style masonry layouts for visual browsing.

---

## Navigation Structure

```
/                       → Recipe Canvas (current, default)
/ingredients            → Ingredients Library (new)
/recipes                → Recipes Gallery (new)
/recipes/[id]           → Individual Recipe Page (new)
/rnd                    → R&D Workspace (new)
/finance                → Finance Reporting (new)
```

### Top Navigation Update

```tsx
// components/layout/TopNav.tsx
<nav>
  <Link href="/">Canvas</Link>
  <Link href="/ingredients">Ingredients</Link>
  <Link href="/recipes">Recipes</Link>
  <Link href="/rnd">R&D</Link>
  <Link href="/finance">Finance</Link>
</nav>
```

---

## 1. Ingredients Page (`/ingredients`)

### Goal
Browse and manage the full ingredient library with visual grouping and filtering.

### Layout
**Pinterest-style masonry grid** with cards grouped by default by **Supplier**.

```
┌─────────────────────────────────────────────────────────┐
│ [Search...] [Group by: Supplier ▼] [Filter: Category ▼] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ── ABC Foods ──────────────────────────────────────    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Tomato  │ │ Onion   │ │ Garlic  │ │ Carrot  │       │
│  │ $2.50/kg│ │ $1.20/kg│ │ $8.00/kg│ │ $1.50/kg│       │
│  │ [Veg]   │ │ [Veg]   │ │ [Veg]   │ │ [Veg]   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                         │
│  ── FoodHub ────────────────────────────────────────    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ Chicken │ │ Salmon  │ │ Beef    │                   │
│  │ $6.00/kg│ │ $18/kg  │ │ $12/kg  │                   │
│  │ [Protein│ │ [Protein│ │ [Protein│                   │
│  └─────────┘ └─────────┘ └─────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Grouping Options
- **Supplier** (default) — Group by preferred supplier
- **Category** — Group by food category
- **Master Ingredient** — Show variants under masters
- **None** — Flat alphabetical list

### Ingredient Card

```tsx
interface IngredientCardProps {
  ingredient: Ingredient;
  showSupplier?: boolean;
  showCategory?: boolean;
}

// Card displays:
// - Name
// - Unit cost (from preferred supplier)
// - Category badge
// - Master ingredient link (if variant)
// - Quick actions: Edit, View recipes using this
```

### Features
- **Search**: Filter by name (debounced)
- **Inline create**: Click "+" to add new ingredient
- **Click to expand**: Show full supplier list, all recipes using this
- **Drag to canvas**: Drag ingredient card to recipe canvas (if open in split view)

### Technical Implementation

```tsx
// app/ingredients/page.tsx
export default function IngredientsPage() {
  const { data: ingredients } = useIngredients();
  const [groupBy, setGroupBy] = useState<'supplier' | 'category' | 'master' | 'none'>('supplier');
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => groupIngredients(ingredients, groupBy), [ingredients, groupBy]);

  return (
    <div className="p-6">
      <Toolbar search={search} onSearch={setSearch} groupBy={groupBy} onGroupBy={setGroupBy} />
      <MasonryGrid>
        {Object.entries(grouped).map(([group, items]) => (
          <GroupSection key={group} title={group}>
            {items.map(ing => <IngredientCard key={ing.id} ingredient={ing} />)}
          </GroupSection>
        ))}
      </MasonryGrid>
    </div>
  );
}
```

---

## 2. Recipes Page (`/recipes`)

### Goal
Browse all recipes with visual filtering by outlet, status, and cost range.

### Layout
**Pinterest-style masonry grid** grouped by default by **Outlet/Brand**.

```
┌─────────────────────────────────────────────────────────────────┐
│ [Search...] [Group by: Outlet ▼] [Status: All ▼] [Cost: $0-$50] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ── Crimson Sun ─────────────────────────────────────────────   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │ 🍝 Carbonara   │ │ 🥗 Caesar     │ │ 🍰 Tiramisu   │         │
│  │               │ │               │ │               │         │
│  │ $4.20/portion │ │ $3.80/portion │ │ $2.50/portion │         │
│  │ [Active] ●●●  │ │ [Active] ●●   │ │ [Draft] ●     │         │
│  │ ABC, FMH      │ │ ABC           │ │ ABC, FMH, XYZ │         │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
│                                                                 │
│  ── The Butcher's Heart ─────────────────────────────────────   │
│  ┌───────────────┐ ┌───────────────┐                           │
│  │ 🥩 Ribeye     │ │ 🍔 Wagyu Burger│                          │
│  │ $18.50/portion│ │ $12.00/portion│                           │
│  └───────────────┘ └───────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recipe Card

```tsx
interface RecipeCardProps {
  recipe: Recipe;
}

// Card displays:
// - Name + emoji/icon
// - Cost per portion (range if multi-supplier)
// - Status badge (Draft/Active/Archived)
// - BOM depth indicator (● = direct only, ●● = 1 sub-recipe, ●●● = 2+ levels)
// - Supplier icons (mini logos of suppliers involved)
// - Click → navigate to /recipes/[id]
```

### Grouping Options
- **Outlet** (default)
- **Status** (Draft, Active, Archived)
- **Category** (if we add recipe categories)
- **Author**
- **None**

### Features
- **Cost range filter**: Slider for min-max cost per portion
- **Supplier filter**: Show only recipes using specific supplier
- **BOM visualization**: Icons showing sub-recipe depth
- **Quick actions**: Duplicate, Archive, Open in Canvas

---

## 3. Individual Recipe Page (`/recipes/[id]`)

### Goal
Detailed view of a single recipe with full costing breakdown, instructions, and relationships.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Recipes                                    [Edit] [⋮] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CARBONARA                              [Active] [Edit] │   │
│  │  Yield: 4 portions                                      │   │
│  │  Author: Chef Marco  •  Last updated: Dec 15, 2024      │   │
│  │  Outlets: Crimson Sun, The Loft                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  COSTING                │  │  INGREDIENTS                │  │
│  │                         │  │                             │  │
│  │  Batch: $16.80          │  │  • Spaghetti    400g  $2.40 │  │
│  │  Per portion: $4.20     │  │  • Guanciale    200g  $8.00 │  │
│  │                         │  │  • Eggs         4     $1.60 │  │
│  │  ┌─────────────────┐    │  │  • Pecorino     100g  $4.80 │  │
│  │  │ Range: $3.80-4.60│   │  │                             │  │
│  │  │ (by supplier)   │    │  │  Sub-recipes:               │  │
│  │  └─────────────────┘    │  │  • Pasta Dough (0.5 batch)  │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  INSTRUCTIONS (SOP)                                     │   │
│  │                                                         │   │
│  │  1. Bring large pot of salted water to boil             │   │
│  │  2. Cook spaghetti until al dente (8 min) ⏱️            │   │
│  │  3. Meanwhile, cook guanciale until crispy              │   │
│  │  4. Whisk eggs with pecorino                            │   │
│  │  5. Combine pasta with guanciale, remove from heat      │   │
│  │  6. Add egg mixture, toss quickly                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  RELATED RECIPES        │  │  RELATED INGREDIENTS        │  │
│  │                         │  │                             │  │
│  │  Uses this recipe:      │  │  Also used in:              │  │
│  │  • Carbonara Bake       │  │  Guanciale → Amatriciana    │  │
│  │                         │  │  Pecorino → Cacio e Pepe    │  │
│  │  Similar recipes:       │  │  Eggs → Tiramisu            │  │
│  │  • Cacio e Pepe         │  │                             │  │
│  │  • Amatriciana          │  │                             │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Features
- **Costing range**: Show min-max based on supplier price variations
- **BOM expansion**: Click sub-recipe to expand inline or navigate
- **Edit mode**: Toggle to edit instructions, ingredients
- **Print/Export**: Generate PDF for kitchen printing
- **Related recipes**: Show recipes that use this as sub-recipe + recipes sharing ingredients

---

## 4. R&D Page (`/rnd`)

### Goal
A digital workspace for chefs to experiment with dish ideas — search/find ingredients, sketch out recipes, and iterate without affecting production menus.

### Key Insight: "Finalization" is Implicit

Rather than a rigid status field, a recipe is considered "finalized" when it's **linked via FK to an Atlas menu item**. This keeps the system flexible:
- Recipes in R&D = not linked to any Atlas menu item
- Recipes in production = linked to Atlas menu item(s)

This approach allows chefs to freely experiment without worrying about formal status transitions.

### Data Model Notes
- No new model required — uses existing `Recipe` model
- "R&D mode" is a **view filter**, not a data distinction
- Optional: Add `is_experimental: bool` flag for explicit tagging, but not required

### Features

```
┌─────────────────────────────────────────────────────────────────┐
│  R&D WORKSPACE                                    [+ New Idea]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  INGREDIENT SEARCH                                      │   │
│  │  [Search ingredients...                              ]  │   │
│  │                                                         │   │
│  │  Drag ingredients below to sketch a dish idea           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MY EXPERIMENTS (not linked to Atlas)                   │   │
│  │                                                         │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │ Carbonara   │ │ Carbonara   │ │ New Dessert │       │   │
│  │  │ v2 (cheap)  │ │ v3 (premium)│ │ Idea        │       │   │
│  │  │ $3.10       │ │ $6.80       │ │ $?.??       │       │   │
│  │  │ [Edit]      │ │ [Edit]      │ │ [Edit]      │       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  COMPARE VARIANTS                                       │   │
│  │                                                         │   │
│  │  Select recipes to compare side-by-side:                │   │
│  │  □ Carbonara v1  □ Carbonara v2  □ Carbonara v3        │   │
│  │                                          [Compare →]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RECENT TASTING SESSIONS                                │   │
│  │                                                         │   │
│  │  Dec 15: Carbonara variants  [View Notes]               │   │
│  │  Dec 10: New dessert menu    [View Notes]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### R&D-Specific Features
- **Ingredient search/drag**: Quickly add ingredients to a new recipe idea
- **Cost estimation**: Real-time costing as ingredients are added
- **Variant comparison**: Side-by-side view of recipe variants (cost, ingredients, notes)
- **Tasting session links**: Quick access to recent tasting feedback
- **"Promote to production"**: When ready, link to Atlas menu item (outside Prepper)

---

## 5. Finance Page (`/finance`)

### Goal
Reporting dashboard showing sales data (from Atlas POS) combined with COGS from recipes.

### Depends On
- Plan 04: Atlas integration (for sales data)
- Plan 02: Outlet attribution (for filtering)

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  FINANCE REPORTING                    [Date: Dec 1-15] [Export] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │ Total Sales   │ │ Total COGS    │ │ Gross Margin  │         │
│  │ $45,230       │ │ $15,820       │ │ 65.0%         │         │
│  │ ↑ 12% vs LM   │ │ ↑ 8% vs LM    │ │ ↑ 2pp vs LM   │         │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SALES + COGS BY RECIPE                                 │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Recipe          Sold    Revenue    COGS    Margin      │   │
│  │  Carbonara       120     $2,160    $504     76.7%       │   │
│  │  Ribeye           45     $1,575    $833     47.1%       │   │
│  │  Caesar           98     $1,470    $372     74.7%       │   │
│  │  ...                                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MARGIN BANDWIDTH                                       │   │
│  │                                                         │   │
│  │  [Chart showing margin range per recipe based on        │   │
│  │   supplier price variations - best/worst case]          │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Features
- **Date range picker**: Filter by period
- **Outlet filter**: View by brand/location
- **COGS bandwidth**: Show margin range based on supplier price variations
- **Export**: CSV/PDF for finance team

---

## Shared Components Needed

### Masonry Grid

```tsx
// components/ui/MasonryGrid.tsx
import Masonry from 'react-masonry-css';

export function MasonryGrid({ children }: { children: React.ReactNode }) {
  return (
    <Masonry
      breakpointCols={{ default: 4, 1100: 3, 700: 2, 500: 1 }}
      className="masonry-grid"
      columnClassName="masonry-column"
    >
      {children}
    </Masonry>
  );
}
```

### Group Section

```tsx
// components/ui/GroupSection.tsx
export function GroupSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4 border-b pb-2">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
```

---

## Implementation Order

1. **Navigation**: Add top nav with page links
2. **Ingredients Page**: Lower dependency, validates masonry pattern
3. **Recipes Page**: Needs outlet data from Plan 02
4. **Individual Recipe Page**: Needs sub-recipe data
5. **R&D Page**: Pending requirements clarification
6. **Finance Page**: Needs Atlas integration (Plan 04)

---

## Resolved Questions

1. **R&D Page**: ✅ Clarified — a workspace for experimentation. Recipes are "finalized" implicitly when linked to Atlas menu item via FK. No rigid status transitions needed.
2. **Recipe images**: ✅ Optional images supported — both dish-level hero image AND per-step images for instructions.

## Recipe Images (Data Model Addition)

```python
# In Recipe model
class Recipe(SQLModel, table=True):
    # ... existing fields ...

    # NEW: Optional images
    image_url: str | None = None  # Hero image for the dish

# In structured instructions (JSONB)
# Each step can optionally have an image:
{
    "order": 1,
    "text": "Sear the steak on high heat",
    "timer_seconds": 180,
    "image_url": "https://..."  # Optional step image
}
```

### Image Storage Notes
- Images likely stored in Supabase Storage or similar
- Frontend handles upload, stores URL in recipe
- Consider image optimization (Next.js Image component)

## Open Questions

1. **Mobile**: Should these pages be mobile-responsive or desktop-only?
2. **Routing**: Use Next.js App Router or keep current structure?
3. **Image upload**: Where should images be stored? (Supabase Storage, Cloudinary, etc.)

---

## Acceptance Criteria

- [ ] Top navigation allows switching between pages
- [ ] Ingredients page shows masonry grid grouped by supplier
- [ ] Recipes page shows masonry grid grouped by outlet
- [ ] Individual recipe page shows full details with costing
- [ ] Finance page shows sales + COGS summary (after Atlas integration)
- [ ] All pages support search and filtering
