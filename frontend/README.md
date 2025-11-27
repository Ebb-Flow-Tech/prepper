# Prepper Frontend

A Next.js 15 frontend for the Prepper recipe workspace.

## Tech Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS 4** for styling
- **TanStack Query** for data fetching and caching
- **dnd-kit** for drag-and-drop functionality
- **Sonner** for toast notifications
- **Lucide React** for icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Backend API running on `http://localhost:8000`

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page (workspace)
│   └── globals.css        # Global styles
├── components/
│   ├── layout/            # Layout components
│   │   ├── AppShell.tsx   # Main app shell with DnD context
│   │   ├── TopAppBar.tsx  # Header with recipe info
│   │   ├── LeftPanel.tsx  # Recipes list
│   │   ├── RightPanel.tsx # Ingredients palette
│   │   └── RecipeCanvas.tsx # Central workspace
│   ├── recipe/            # Recipe-specific components
│   │   ├── RecipeIngredientsList.tsx
│   │   ├── RecipeIngredientRow.tsx
│   │   ├── Instructions.tsx
│   │   ├── InstructionsSteps.tsx
│   │   └── InstructionStepCard.tsx
│   └── ui/                # Reusable UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Textarea.tsx
│       ├── Badge.tsx
│       └── Skeleton.tsx
├── lib/
│   ├── api.ts             # API client
│   ├── providers.tsx      # React Query + App providers
│   ├── store.tsx          # App state context
│   ├── utils.ts           # Utility functions
│   └── hooks/             # React Query hooks
│       ├── useRecipes.ts
│       ├── useIngredients.ts
│       ├── useRecipeIngredients.ts
│       ├── useCosting.ts
│       └── useInstructions.ts
└── types/
    └── index.ts           # TypeScript type definitions
```

## Features

### Three-Column Layout
- **Left Panel**: Recipe list with search and create functionality
- **Center Canvas**: Active recipe workspace with ingredients and instructions
- **Right Panel**: Ingredient palette with drag-and-drop

### Recipe Management
- Create, update, and delete recipes
- Inline editing for recipe name, yield, and selling price
- Status management (Draft, Active, Archived)

### Ingredient Management
- Create new ingredients with base unit and cost
- Drag ingredients from palette to recipe
- Update quantities and units
- Reorder ingredients within a recipe
- Automatic cost calculation

### Instructions
- **Freeform tab**: Free-text instructions with autosave
- **Steps tab**: Structured steps with timer and temperature fields
- "Format into steps" button (calls LLM parsing endpoint)
- Drag-and-drop reordering of steps

### UX Features
- Optimistic updates with rollback on error
- Debounced autosave (no save buttons)
- Loading skeletons
- Toast notifications for feedback
- Empty states with call-to-action
- Dark mode support

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## API Integration

The frontend connects to the FastAPI backend at the configured API URL. All API calls are made through the `src/lib/api.ts` client and cached via TanStack Query hooks in `src/lib/hooks/`.

### Endpoints Used

- `GET/POST /recipes` - List and create recipes
- `GET/PATCH/DELETE /recipes/{id}` - Recipe CRUD
- `PATCH /recipes/{id}/status` - Update recipe status
- `GET/POST/PATCH/DELETE /recipes/{id}/ingredients` - Recipe ingredients
- `POST /recipes/{id}/ingredients/reorder` - Reorder ingredients
- `POST /recipes/{id}/instructions/raw` - Save raw instructions
- `POST /recipes/{id}/instructions/parse` - Parse instructions via LLM
- `PATCH /recipes/{id}/instructions/structured` - Save structured steps
- `GET /recipes/{id}/costing` - Get cost breakdown
- `GET/POST /ingredients` - List and create ingredients
