# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prepper is a **kitchen-first recipe workspace** for chefs and operators. It treats recipes as living objects on a single "recipe canvas" with drag-and-drop ingredients, freeform-to-structured instructions, and automatic costing with wastage tracking. Key principles: clarity, immediacy, reversibility—no save buttons, just autosave. Features Supabase authentication with user roles (normal/admin) for recipe ownership and permissions.

**Recipe Versioning**: Recipes support forking with full version history tracking. Each recipe has a `version` number and `root_id` pointing to its parent, enabling tree-based version lineage visualization.

**Multi-Outlet Support**: Recipes can be assigned to multiple outlets (brands/locations) with per-outlet pricing overrides. Outlets support hierarchical parent-child relationships with cycle detection.

**Wastage & Costing**: Recipe ingredients track wastage percentage (0-100), which is factored into ingredient unit prices and final cost breakdowns.

## Common Commands

### Backend (FastAPI)

```bash
cd backend

# Setup
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env

# Run server
uvicorn app.main:app --reload

# Tests
pytest                          # Run all tests
pytest tests/test_recipes.py    # Single test file
pytest -k "test_create"         # By name pattern

# Linting
ruff check .
ruff format .
mypy app/
```

### Frontend (Next.js 15)

```bash
cd frontend

npm install
npm run dev     # Dev server at localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```

**Requires backend running on localhost:8000**

## Architecture

### Backend (`backend/`)

```
app/
├── main.py              # FastAPI factory with lifespan, CORS, router mounting
├── config.py            # pydantic-settings (env-driven)
├── database.py          # SQLModel engine + session management
├── models/              # SQLModel entities
│   ├── ingredient.py            # Ingredient (+ allergen field), SupplierEntry
│   ├── recipe.py                # Recipe (+ version, root_id, description, summary_feedback, rnd_started, review_ready)
│   ├── recipe_ingredient.py     # RecipeIngredient (+ wastage_percentage, unit_price, base_unit, supplier_id)
│   ├── recipe_recipe.py         # RecipeRecipe (sub-recipe/BOM hierarchy)
│   ├── recipe_image.py          # RecipeImage (multi-image support with is_main, order)
│   ├── tasting_note_image.py    # TastingNoteImage (images for tasting notes with timestamps)
│   ├── outlet.py                # Outlet (with parent_outlet_id hierarchy), RecipeOutlet (+ price_override)
│   ├── category.py              # Category (ingredient categorization, soft-delete)
│   ├── recipe_category.py       # RecipeCategory (recipe categorization)
│   ├── recipe_recipe_category.py # RecipeRecipeCategory (recipe-category many-to-many)
│   ├── tasting.py               # TastingSession, TastingNote
│   ├── recipe_tasting.py        # RecipeTasting (session-recipe many-to-many)
│   ├── supplier.py              # Supplier (name, address, phone, email, soft-delete support)
│   ├── user.py                  # User (email, username, user_type [normal/admin], outlet_id, Supabase auth, hierarchical access)
│   ├── auth.py                  # Auth DTOs: LoginRequest, RegisterRequest, LoginResponse
│   └── costing.py               # CostingResult (+ adjusted_cost_per_unit), CostBreakdownItem
├── domain/              # Business logic services
│   ├── ingredient_service.py    # Ingredient CRUD + variants + categorization
│   ├── recipe_service.py        # Recipe CRUD + status + fork + version tree
│   ├── instructions_service.py  # Freeform → structured parsing
│   ├── costing_service.py       # Unit conversion + cost calculations (with wastage)
│   ├── subrecipe_service.py     # Sub-recipe hierarchy + cycle detection
│   ├── outlet_service.py        # Outlet CRUD + hierarchy + cycle detection + recipe links
│   ├── recipe_image_service.py  # Recipe image management + ordering
│   ├── tasting_session_service.py   # Tasting session CRUD + stats
│   ├── tasting_note_service.py      # Tasting notes + recipe history
│   ├── tasting_note_image_service.py  # Tasting note image management (add/delete/batch)
│   ├── recipe_tasting_service.py    # Session-recipe relationships
│   ├── supplier_service.py      # Supplier CRUD + supplier-ingredient links
│   ├── storage_service.py       # Supabase Storage for recipe images
│   ├── category_service.py      # Category CRUD + soft-delete
│   ├── recipe_category_service.py   # Recipe category CRUD
│   ├── recipe_recipe_category_service.py # Recipe-category link CRUD
│   ├── user_service.py          # User CRUD and management
│   └── supabase_auth_service.py # Supabase authentication integration
├── api/                 # FastAPI routers (one per resource)
│   ├── recipes.py               # Recipe CRUD + fork + versions + image management
│   ├── recipe_ingredients.py    # Recipe ingredient links + wastage/pricing
│   ├── ingredients.py           # Ingredient CRUD + suppliers + variants + categorization
│   ├── instructions.py          # Recipe instructions (raw, parse, structured)
│   ├── costing.py               # Recipe costing (calculate, recompute with wastage)
│   ├── sub_recipes.py           # Sub-recipe hierarchy + BOM tree
│   ├── outlets.py               # Outlets CRUD + hierarchy + cycle detection
│   ├── recipe_outlets.py        # Recipe-outlet links (per-recipe detail)
│   ├── tastings.py              # Tasting sessions CRUD + stats
│   ├── tasting_notes.py         # Tasting notes CRUD (nested under sessions)
│   ├── tasting_note_images.py   # Tasting note image management (get, delete, sync)
│   ├── tasting_history.py       # Recipe tasting history + summary
│   ├── recipe_tastings.py       # Session-recipe relationships
│   ├── suppliers.py             # Supplier CRUD + ingredient links
│   ├── agents.py                # Agent endpoints (feedback summarization, etc.)
│   ├── categories.py            # Category CRUD
│   ├── recipe_categories.py     # Recipe category CRUD
│   ├── recipe_recipe_categories.py # Recipe-category link CRUD
│   ├── auth.py                  # Login, register, token refresh endpoints
│   └── deps.py                  # Dependency injection (get_session)
├── agents/              # AI-powered features
│   ├── base_agent.py            # Base agent framework
│   ├── category_agent.py        # Ingredient categorization
│   └── feedback_summary_agent.py # Tasting feedback summarization
└── utils/               # Unit conversion helpers
```

**Key patterns:**
- Services receive SQLModel `Session` and return domain objects
- Routers depend on services via function calls (no DI framework)
- Tests use SQLite in-memory via `conftest.py` fixtures

### Frontend (`frontend/src/`)

```
app/
├── page.tsx             # Home page (redirects to /recipes if authenticated, else /login)
├── layout.tsx           # Root layout with providers and top nav
├── outlets/[id]/page.tsx        # Outlet detail page
├── recipe-categories/[id]/page.tsx # Recipe category detail with recipe management
├── recipes/
│   ├── page.tsx         # Recipe list/management with tabs (Recipe, Outlet, Category Management)
│   ├── new/page.tsx     # Create new recipe page
│   └── [id]/page.tsx    # Individual recipe detail page
├── ingredients/
│   ├── page.tsx         # Ingredient list
│   └── [id]/page.tsx    # Ingredient detail page
├── suppliers/
│   ├── page.tsx         # Supplier list
│   └── [id]/page.tsx    # Supplier detail page
├── tastings/
│   ├── page.tsx         # Tasting session list
│   ├── new/page.tsx     # Create new tasting session
│   ├── [id]/page.tsx    # Tasting session detail
│   └── [id]/r/[recipeId]/page.tsx # Tasting notes for recipe in session
├── finance/page.tsx     # Finance/analytics dashboard
├── rnd/
│   ├── page.tsx         # R&D workspace list
│   └── r/[recipeId]/page.tsx # Individual R&D recipe detail
├── design-system/page.tsx # Design system reference
├── login/page.tsx       # Login page (mock auth)
├── register/page.tsx    # Registration page (mock auth)
└── api/                 # Route handlers
    └── generate-image/  # DALL-E 3 image generation API route

lib/
├── api.ts               # Typed fetch wrapper (40+ endpoints)
├── providers.tsx        # QueryClientProvider + AppProvider + AuthGuard composition
├── store.tsx            # React Context (selectedRecipeId, canvasTab, auth state)
├── types/index.ts       # TypeScript interfaces for all entities
├── utils.ts             # Utility functions (cn for classnames)
├── mock-users.json      # Mock user data for frontend-only auth
└── hooks/               # TanStack Query hooks with cache invalidation
    ├── useRecipes.ts            # useRecipes, useRecipe, useCreateRecipe, useUpdateRecipe, useDeleteRecipe, useForkRecipe, useRecipeVersions, useGenerateRecipeImage
    ├── useIngredients.ts        # useIngredients, useIngredient, useCreateIngredient, useUpdateIngredient, useDeactivateIngredient, useIngredientVariants, useIngredientSuppliers, useAddSupplier, useUpdateSupplier, useRemoveSupplier, usePreferredSupplier
    ├── useRecipeIngredients.ts  # useRecipeIngredients, useAddIngredient, useUpdateRecipeIngredient, useRemoveIngredient, useReorderIngredients
    ├── useCosting.ts            # useRecipeCost, useRecomputeCost
    ├── useInstructions.ts       # useInstructions, useSaveRawInstructions, useParseInstructions, useUpdateStructuredInstructions
    ├── useSuppliers.ts          # useSuppliers, useSupplier, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, useSupplierIngredients
    ├── useSubRecipes.ts         # useSubRecipes, useAddSubRecipe, useUpdateSubRecipe, useRemoveSubRecipe, useReorderSubRecipes, useBOMTree
    ├── useOutlets.ts            # useOutlets, useOutlet, useCreateOutlet, useUpdateOutlet, useDeactivateOutlet
    ├── useRecipeOutlets.ts      # useRecipeOutlets, useOutletRecipes, useAddRecipeToOutlet, useUpdateRecipeOutlet, useRemoveRecipeFromOutlet
    ├── useTastings.ts           # useTastingSessions, useTastingSession, useTastingSessionStats, useCreateTastingSession, useUpdateTastingSession, useDeleteTastingSession, useSessionNotes, useCreateTastingNote, useUpdateTastingNote, useDeleteTastingNote, useTastingNoteImages, useSyncTastingNoteImages, useAddRecipeToSession, useRemoveRecipeFromSession
    ├── useCategories.ts         # useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useCategoryIngredients
    ├── useRecipeCategories.ts   # useRecipeCategories, useRecipeCategory, useCreateRecipeCategory, useUpdateRecipeCategory, useDeleteRecipeCategory
    ├── useRecipeRecipeCategories.ts # useRecipeCategoryLinks, useCategoryRecipes, useAddRecipeToCategory, useRemoveRecipeFromCategory
    ├── useAgents.ts             # useCategorizeIngredient, useSummarizeFeedback
    ├── useAutoFlowLayout.ts     # Automatic layout arrangement using ReactFlow
    ├── useSendTastingInvitation.ts # Email invitation functionality
    └── index.ts                 # Export barrel for all hooks

components/
├── layout/              # AppShell, TopAppBar, TopNav, LeftPanel, RightPanel, RecipeCanvas, CanvasLayout
│   └── tabs/            # CanvasTab, OverviewTab, IngredientsTab, InstructionsTab, CostsTab, OutletsTab, TastingTab, VersionsTab, AddOutletModal
├── recipe/              # RecipeIngredientsList, RecipeIngredientRow, SubRecipesList, Instructions, InstructionsSteps, InstructionStepCard, RecipeImageCarousel
├── recipes/             # RecipeManagementTab, RecipeCard, RecipeListRow, OutletManagementTab, RecipeCategoriesTab, AddRecipeCategoryModal, RecipeCategoryCard, RecipeCategoryFilterButtons, RecipeCategoryListRow
├── outlets/             # OutletCard, OutletListRow, AddOutletModal
├── ingredients/         # IngredientCard, IngredientListRow, AddIngredientModal, FilterButtons, CategoriesTab
├── categories/          # CategoryCard, CategoryListRow, AddCategoryModal
├── suppliers/           # SupplierListRow, AddSupplierModal
├── tasting/             # ImageUploadPreview (drag-drop upload with preview, Base64 + Supabase integration)
├── AuthGuard.tsx        # Route protection for authenticated pages
└── ui/                  # Button, Input, Textarea, Select, Badge, Card, Modal, ConfirmModal, Skeleton, PageHeader, SearchInput, EditableCell, Switch, ListSection, GroupSection, ViewToggle, MasonryGrid
```

**Key patterns:**
- All data flows through TanStack Query hooks—no local state for server data
- Drag-and-drop via `dnd-kit` (wrapped in AppShell's DndContext)
- Debounced autosave on all editable fields (no save buttons)
- `useAppState()` for global UI state (selected recipe, active tab)
- Canvas tabs: `canvas | overview | ingredients | costs | instructions | tasting | outlets | versions`
- Version tree visualization via `@xyflow/react` (ReactFlow)
- Inline editable cells with `EditableCell` component
- Modal dialogs for complex forms (suppliers, outlets, etc.)

### API Structure

All endpoints under `/api/v1`:

**Authentication:**
- `/auth/login` — Login with email/password (returns JWT tokens)
- `/auth/register` — Register new user (email, username, password)
- `/auth/refresh` — Refresh JWT token

**Core Resources:**
- `/recipes` — CRUD + status + soft-delete + fork
- `/ingredients` — CRUD + deactivate + categories + variants
- `/suppliers` — CRUD + contact info (address, phone, email)
- `/outlets` — CRUD + hierarchy + cycle detection

**Recipe Sub-resources:**
- `/recipes/{id}/fork` — create editable copy with ingredients & instructions (sets version + root_id, excludes image)
- `/recipes/{id}/image` — upload recipe image (base64 → Supabase Storage)
- `/recipes/{id}/versions` — get all recipes in version tree (with user_id filtering for visibility)
- `/recipes/{id}/ingredients` — add, update, remove, reorder
- `/recipes/{id}/sub-recipes` — sub-recipe hierarchy (BOM) with cycle detection
- `/recipes/{id}/used-in` — reverse lookup: recipes that use this as sub-recipe
- `/recipes/{id}/bom-tree` — full Bill of Materials tree (nested)
- `/recipes/{id}/instructions/raw` — store raw instructions text
- `/recipes/{id}/instructions/parse` — parse raw to structured (LLM)
- `/recipes/{id}/instructions/structured` — update structured instructions
- `/recipes/{id}/costing` — calculate cost breakdown
- `/recipes/{id}/costing/recompute` — recompute and persist cost
- `/recipes/{id}/outlets` — multi-brand outlet assignments
- `/recipes/{id}/tasting-notes` — tasting history for recipe
- `/recipes/{id}/tasting-summary` — aggregated tasting data for recipe

**Ingredient Sub-resources:**
- `/ingredients/categories` — list all food categories
- `/ingredients/{id}/suppliers` — add, update, remove supplier entries
- `/ingredients/{id}/suppliers/preferred` — get preferred supplier
- `/ingredients/{id}/variants` — get ingredient variants

**Supplier Sub-resources:**
- `/suppliers/{id}/ingredients` — get ingredients linked to a supplier

**Tasting Sessions:**
- `/tasting-sessions` — CRUD + stats
- `/tasting-sessions/{id}/stats` — get session statistics
- `/tasting-sessions/{id}/notes` — full CRUD for tasting notes
- `/tasting-sessions/{id}/recipes` — session-recipe relationships (add/remove)

**Tasting Note Images:**
- `GET /tasting-note-images/{tasting_note_id}` — get all images for note
- `DELETE /tasting-note-images/{image_id}` — delete single image
- `POST /tasting-note-images/sync/{tasting_note_id}` — sync add/update/delete in single call

**Outlets:**
- `/outlets` — CRUD for multi-brand/location support
- `/outlets/{id}` — get/update single outlet
- `/outlets/{id}/recipes` — get recipes assigned to outlet
- `/outlets/{id}/hierarchy` — get outlet hierarchy tree

**Recipe-Outlet Links** (nested under recipes):
- `/recipes/{id}/outlets` — get outlets for recipe
- `/recipes/{id}/outlets` (POST) — add recipe to outlet
- `/recipes/{id}/outlets/{outlet_id}` (PATCH) — update outlet link (price_override, activation)
- `/recipes/{id}/outlets/{outlet_id}` (DELETE) — remove recipe from outlet

**Recipe Categories:**
- `/recipe-categories` — CRUD for recipe categories
- `/recipe-categories/{id}` — get/update single recipe category
- `/recipe-recipe-categories` — CRUD for recipe-category links
- `/recipe-recipe-categories/recipe/{recipe_id}` — get categories assigned to recipe
- `/recipe-recipe-categories/category/{category_id}` — get recipes in category

**Agents:**
- `/agents/summarize-feedback/{recipe_id}` — AI-powered tasting feedback summary

**Categories:**
- `/ingredients/categories` — list all food categories

## Environment Variables

**Backend** (`.env`):
- `DATABASE_URL` — PostgreSQL connection (defaults to SQLite for local dev)
- `CORS_ORIGINS` — JSON array of allowed origins
- `SUPABASE_URL` — Supabase project URL (optional, for image storage)
- `SUPABASE_KEY` — Supabase anon key (optional, for image storage)
- `SUPABASE_BUCKET` — Storage bucket name (default: `recipe-images`)
- `ANTHROPIC_API_KEY` — Anthropic API key (optional, for AI agents)

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL` — Backend URL (default: `http://localhost:8000/api/v1`)
- `OPENAI_API_KEY` — OpenAI API key (optional, for DALL-E 3 image generation)
- `TWILIO_ACCOUNT_SID` — Twilio account SID (optional, for SMS invitations)
- `TWILIO_AUTH_TOKEN` — Twilio auth token (optional, for SMS invitations)
- `TWILIO_FROM_NUMBER` — Twilio phone number for SMS sending (optional, for SMS invitations)

## Skills Reference

### Agent Skills (`.agents/skills/`)

| Skill | When to Use |
|-------|-------------|
| `/frontend-design` | **Any UI/frontend work** — building pages, components, styling, layout adjustments, design polish. Proactively invoke for all visual tasks, not just new builds. ANY tasks that concerns frontend; not limited to the mentioned. |
| `/fastapi-expert` | Building or modifying **backend API endpoints** — async routes, Pydantic V2 models, SQLAlchemy queries, JWT auth, WebSocket handlers, or writing tests for API logic. |
| `/nextjs-best-practices` | Quick reference for **Next.js principles** — Server vs Client Components decisions, data fetching patterns, routing conventions, caching strategies. |
| `/nextjs-app-router-patterns` | Deep dive into **App Router patterns** — Server Actions, parallel routes, intercepting routes, streaming with Suspense, metadata/SEO. Use when implementing advanced Next.js features. |
| `/vercel-react-best-practices` | **React/Next.js performance optimization** — eliminating waterfalls, bundle size reduction, re-render optimization, server-side performance. Use when reviewing or refactoring for performance. |
| `/python-testing-patterns` | Writing **Python tests with pytest** — fixtures, mocking, parameterization, async testing, property-based testing, test organization and CI/CD integration. |
| `/database-schema-designer` | Designing **database schemas** — normalization, indexing strategies, relationship patterns (polymorphic, self-referencing), migrations, and performance optimization. |
| `/git-commit` | Creating **git commits** — analyzes diffs, generates conventional commit messages (feat/fix/refactor/etc.), handles staging and commit execution. |
| `/skill-creator` | Creating or updating **new agent skills** — skill anatomy, progressive disclosure design, packaging, and best practices. |

### Project Commands (`.claude/commands/`)

| Command | When to Use |
|---------|-------------|
| `/get_started` | **Onboarding** — reads CLAUDE.md, docs/intro.md, and docs/changelog.md to get an overview of the project. |
| `/commit` | **Quick commit** — looks at latest changes and generates a commit message automatically. |
| `/fe-build-check` | **Frontend validation** — runs `npm run lint` then `npm run build` to check for errors before committing. |
| `/schema-assembly` | **New database tables** — creates table models, CRUD endpoints, unit tests, and a migration file. Asks about soft vs hard delete. Does NOT run migrations or tests. |
| `/update-context` | **Refresh CLAUDE.md** — updates this file based on current codebase contents after significant changes. |

## Key Features (Recent Additions)

**SMS Invitations for Tasting Sessions** (Feb 26)
- Twilio SMS integration for tasting session invitations
- `useSendTastingInvitation` hook supports parallel email (SendGrid) and SMS (Twilio) delivery
- API route `/api/send-tasting-invitation` handles both channels with configurable recipients
- Graceful degradation if Twilio not configured—falls back to email-only without error
- SMS includes session name, date, location, and invite link in plain text format
- Participant phone numbers managed through `TastingParticipant` type with `phone_number` field
- Response includes `email_count` and `sms_count` for transparency
- Frontend updated to pass recipients as objects with email and optional phone_number

**Tasting Session Participant Association** (Feb 26)
- `TastingUser` join table replaces email-based attendees with proper user-session relationships
- `TastingUserRead` DTO displays participant names and emails from User table
- `TastingSessionRead` returns `participants: List[TastingUserRead]` instead of email strings
- Service layer email lookup (`_resolve_attendees_to_users()`) silently skips unregistered emails
- Access control: non-admin users can only access sessions they participate in (403 otherwise)
- Admin users bypass participant check for full access
- Alembic migration with cascade delete on session deletion, SET NULL on user deletion
- Unique constraint on (session_id, user_id) prevents duplicate participation
- Backend tests: 26/26 passing with participant resolution, unregistered email skipping, and access control validation
- Frontend `ParticipantPicker` component for user selection during session creation
- Backward compatible: `attendees` field kept on request DTOs for wire compatibility

**Menu Management Enhancements** (Feb 26)
- Drag-and-drop reordering for menu sections and items via `dnd-kit` library
- Order numbers automatically updated during drag operations
- Editable `key_highlights` textarea field (appears first) for signature items, seasonal specials
- Editable `additional_info` textarea field (appears second) for dietary notes, preparation tips
- `DraggableSection` and `DraggableItem` wrapper components with grip icons
- Real-time UI feedback with opacity changes during dragging
- Support for both create mode (no IDs) and update mode (with existing IDs)
- Separate data structures to handle create vs. update workflows
- Components properly typed with `MenuItem` model fields

**Access Control & Admin Management** (Feb 13-23)
- Admin user model and role-based access control
- Protected admin routes with authorization checks
- Hierarchical outlet-based access control for recipes and tasting sessions
- User access restricted to outlets within their hierarchy
- Read-only mode for users without edit permissions
- Outlet hierarchy validation for permission enforcement

**Allergen Management System** (Feb 20-23)
- `allergen` field on `Ingredient` model for tracking allergen information
- Allergen display across recipe views (ingredients panel, recipe detail, BOM tree)
- Hierarchical allergen display in recipe sub-recipes
- Ingredient allergen data management through ingredient detail UI
- Allergen badges in ingredient lists and recipe views

**Supplier Soft Delete** (Feb 23)
- Soft delete support for supplier records
- Archived suppliers remain available for historical reference
- Deactivation logic prevents orphaning ingredient-supplier links

**User Authentication System** (Jan 23)
- `User` model with email, username, user_type (normal/admin), outlet_id reference
- `supabase_auth_service.py` for Supabase authentication integration
- `user_service.py` for user CRUD and management
- Login/register endpoints at `/auth/login`, `/auth/register`, `/auth/refresh`
- Frontend auth pages at `/login` and `/register` with JWT token storage
- `AuthGuard` component for route protection
- Mock user data for frontend-only auth fallback

**Recipe Category Management** (Jan 23)
- `RecipeCategory` model for categorizing recipes
- `RecipeRecipeCategory` model for many-to-many recipe-category relationships
- Full CRUD operations for recipe categories and links
- Category detail page with recipe management at `/recipe-categories/[id]`
- `RecipeCategoryCard` and `RecipeCategoryFilterButtons` components for UI
- Complete integration with recipe management workflows

**Tasting Note Image Management** (Jan 23)
- `TastingNoteImage` model for multiple images per tasting note
- `ImageUploadPreview` React component with drag-drop upload
- Sync endpoint for atomic add/update/delete operations
- Parallel async uploads/deletions via asyncio.gather()
- Base64 encoding + Supabase Storage integration
- Integrated with tasting session detail page (`/tastings/[id]/r/[recipeId]`)

**Wastage Tracking** (Jan 20)
- Recipe ingredients now track `wastage_percentage` (0-100)
- Wastage is factored into ingredient unit prices and cost breakdowns
- `adjusted_cost_per_unit` field on costing results

**Multi-Outlet Management** (Jan 22)
- Outlets support hierarchical parent-child relationships
- Cycle detection prevents circular hierarchies
- Per-outlet recipe activation and price overrides
- Dedicated `/outlets` page with detail views

**AI-Powered Agents** (Jan 20+)
- `category_agent.py` — Ingredient categorization
- `feedback_summary_agent.py` — Tasting feedback summarization
- Extensible base agent framework for future AI features

**Multi-Image Support** (Jan 16)
- `RecipeImage` model for multiple recipe images
- `is_main` flag for primary image selection
- `order` field for carousel sequencing

**R&D Workflow Enhancements** (Jan 16-20)
- `review_ready` flag for recipe review state
- `rnd_started` flag for R&D session initiation
- AI-generated `summary_feedback` on recipes
