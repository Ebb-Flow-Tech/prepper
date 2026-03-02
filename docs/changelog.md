# Changelog

All notable changes to this project will be documented in this file.

---

## Version History

- **0.0.18** (2026-03-02) - Tasting Session Creator Tracking & UX Improvements: Session Creator Ownership, ID-Based Participant Management, Quick-Add Ingredients & Past-Date Invitation Guard
- **0.0.17** (2026-02-27) - UI Redesign & Performance Optimization: Canvas Layout Overhaul, Supplier UI Polish, Menu Publish/Unpublish & Backend Query Optimization
- **0.0.16** (2026-02-26) - SMS Invitations, Tasting Participant Association & Menu Management: Twilio SMS Integration, User-Based Session Relationships & Drag-and-Drop Menu Reordering
- **0.0.15** (2026-02-23) - Access Control & Allergen Management: Admin User Management, Hierarchical Access Control, Allergen Tracking & Supplier Soft Delete
- **0.0.14** (2026-02-12) - Parent Outlet Recipes Display: Read-Only Table for Multi-Brand Recipe Management
- **0.0.13** (2026-01-28) - Ingredient Tasting & Text-Based Features: Standalone Tasting Notes, Direct Ingredient Input, Collapsible UI & Image Support
- **0.0.12** (2026-01-21) - Wastage, Outlets & Recipe Enhancements: Multi-Image Gallery, Outlet Hierarchy, Profit Margins, AI Feedback Summary & R&D Workflow
- **0.0.11** (2026-01-23) - User Authentication & Recipe Categories: Supabase Auth Integration, Full CRUD Category Management, Tasting Note Images & Branding
- **0.0.10** (2025-12-18) - Tasting Notes: R&D Feedback Tracking with Sessions, Ratings, Decisions & Recipe History Integration
- **0.0.9** (2025-12-17) - Bugfix: Enum-to-VARCHAR Mismatch Fix for Ingredients API + CORS Update for Vercel
- **0.0.8** (2025-12-17) - Frontend Multi-Page Expansion: Ingredients Library, Recipes Gallery, Recipe Detail, R&D Workspace, Finance Placeholder
- **0.0.7** (2025-12-17) - Recipe Extensions: Sub-Recipe BOM Hierarchy, Authorship Tracking, Outlet/Brand Attribution
- **0.0.6** (2025-12-17) - Ingredient Data Model Enhancements: Multi-Supplier Pricing, Master Ingredient Linking, Food Categories & Source Tracking
- **0.0.5** (2025-12-03) - AI-Powered Instructions Parsing: Vercel AI SDK + GPT-5.1 for Freeform→Structured Conversion, UX Improvements & CORS Fixes
- **0.0.4** (2025-12-02) - Backend Deployment: Fly.io Production Setup with Supabase PostgreSQL
- **0.0.3** (2024-11-27) - Database Migration: Alembic Initial Tables to Supabase + PostgreSQL JSON Compatibility Fix
- **0.0.2** (2024-11-27) - Frontend Implementation: Next.js 15 Recipe Canvas with Drag-and-Drop, Autosave & TanStack Query
- **0.0.1** (2024-11-27) - Backend Foundation: FastAPI + SQLModel with 17 API Endpoints, Domain Services & Unit Conversio
---

## [0.0.18] - 2026-03-02

### Changed

#### Tasting Session Creator Tracking

Added `creator_id` column to tasting sessions, establishing explicit ownership of who created each session. Creators now have the same access privileges as participants.

**Database Changes**:
- New `creator_id` column on `tasting_sessions` (FK to `users.id`, nullable, indexed, SET NULL on delete)
- Legacy `attendees` JSON column dropped (replaced by `tasting_users` join table in 0.0.16)

**Backend**:
- `TastingSession` model includes `creator_id` field
- `TastingSessionRead` returns `creator_id` in API responses
- Service layer sets `creator_id` from authenticated user during session creation
- Access control updated: admins, creators, and participants can all access sessions

**Frontend**:
- Session detail page (`/tastings/[id]`) checks `creator_id` for access control
- Recipe tasting page (`/tastings/[id]/r/[recipeId]`) uses creator-based access check
- Ingredient tasting page (`/tastings/[id]/i/[ingredientId]`) uses creator-based access check
- 403 error handling displays "Access Denied" with back-navigation link

**Files Created**:
- `backend/alembic/versions/e1f2g3h4i5j6_add_creator_id_to_tasting_sessions.py`

**Files Modified**:
- `backend/app/models/tasting.py` — Added `creator_id` to model and read DTO
- `backend/app/domain/tasting_session_service.py` — Creator ID set on create
- `backend/app/api/tastings.py` — Access control includes creator check
- `backend/tests/test_tastings.py` — Tests assert `creator_id` in responses
- `frontend/src/app/tastings/[id]/page.tsx` — Creator-based access check
- `frontend/src/app/tastings/[id]/r/[recipeId]/page.tsx` — Creator-based access check
- `frontend/src/app/tastings/[id]/i/[ingredientId]/page.tsx` — Creator-based access check
- `frontend/src/types/index.ts` — Added `creator_id` to `TastingSession` type

#### Simplified Participant Management (ID-Based)

Replaced email-based `attendees` field with direct `participant_ids` (user ID array) on create/update DTOs. Removes email-to-user resolution overhead.

**Changes**:
- `TastingSessionCreate` and `TastingSessionUpdate` accept `participant_ids: List[str]` instead of `attendees: List[str]`
- Service layer creates `TastingUser` rows directly by user ID (no email lookup)
- Frontend sends user IDs from `ParticipantPicker` component directly

**Files Modified**:
- `backend/app/models/tasting.py` — Schema DTOs use `participant_ids`
- `backend/app/domain/tasting_session_service.py` — Direct ID-based participant creation
- `frontend/src/app/tastings/new/page.tsx` — Sends `participant_ids` from selected users
- `frontend/src/app/tastings/[id]/page.tsx` — Updates participants via `participant_ids`

### Added

#### Quick-Add Ingredient from Search

Added a quick-create shortcut in the RightPanel ingredient library — when a search term yields no matches, a "Add [term]" button appears to instantly create the ingredient with auto-categorization.

**Features**:
- Quick-add button appears when search has no matching ingredients
- Auto-categorizes via AI category agent during creation
- Loading overlay with spinner during ingredient creation
- Tabs and search disabled while creation is in progress
- Created ingredient uses default unit `g` and no cost (editable later)

**Files Modified**:
- `frontend/src/components/layout/RightPanel.tsx` — Quick-add flow with loading state

#### Past-Date Invitation Guard

SMS/email invitations are now skipped when the tasting session date is in the past, preventing unnecessary sends for historical sessions.

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Early return with `email_count: 0, sms_count: 0` for past sessions

---

## [0.0.17] - 2026-02-27

### Changed

#### Canvas Layout Redesign

Replaced game-card styled components with clean, compact list-item design across the recipe canvas for a more professional, minimal look.

**Changes**:
- RightPanel (ingredient palette) redesigned with compact list-item rows instead of large cards
- CanvasTab overhauled with streamlined, minimal UI for recipe ingredients and sub-recipes
- TopAppBar tabs switched to pill-style design for cleaner navigation
- Tabs hidden on new recipe page until recipe is saved
- Menu preview always shows substitution field for consistency

**Files Modified**:
- `frontend/src/components/layout/RightPanel.tsx` — List-item redesign
- `frontend/src/components/layout/tabs/CanvasTab.tsx` — Compact ingredient/sub-recipe UI
- `frontend/src/components/layout/CanvasLayout.tsx` — Layout adjustments
- `frontend/src/components/layout/TopAppBar.tsx` — Pill-style tabs
- `frontend/src/app/recipes/new/page.tsx` — Hide tabs on new recipe
- `frontend/src/app/menu/preview/[id]/page.tsx` — Always show substitution field

#### Supplier UI Polish

Enhanced supplier management interface with unarchive support, visual indicators, and better text handling.

**Changes**:
- Supplier unarchive/restore functionality with ArchiveRestore icon button
- `OverflowTooltip` component for truncated text with hover titles
- "Archived" badge displayed on inactive suppliers in both card and list views
- `is_active` field added to `UpdateSupplierRequest` type for reactivation
- Navigation labels visible at `xl` breakpoint (down from `2xl`) for better usability

**Files Modified**:
- `frontend/src/app/suppliers/page.tsx` — Unarchive actions and archived badges
- `frontend/src/components/suppliers/SupplierListRow.tsx` — Archived badge in list view
- `frontend/src/components/layout/TopNav.tsx` — Nav label breakpoint change
- `frontend/src/types/index.ts` — Added `is_active` to update type

### Added

#### Menu Publish/Unpublish

Added publish and unpublish workflow for menus, enabling status management from draft to published state.

**Features**:
- `POST /menus/{id}/publish` and `POST /menus/{id}/unpublish` backend endpoints
- Service-layer `publish_menu()` and `unpublish_menu()` methods
- `usePublishMenu` and `useUnpublishMenu` frontend hooks
- Status toggle UI on menu management page with visual publish state indicator

**Files Modified**:
- `backend/app/api/menus.py` — Publish/unpublish endpoints
- `backend/app/domain/menu_service.py` — Publish/unpublish service methods
- `frontend/src/app/menu/page.tsx` — Status toggle UI
- `frontend/src/lib/api.ts` — API client methods
- `frontend/src/lib/hooks/useMenus.ts` — Mutation hooks

#### Supplier Endpoint Tests

Added comprehensive test coverage for supplier API endpoints.

**Tests**:
- 11 new tests covering deactivate, reactivate, `active_only` filtering, and 404 error cases
- Validates soft-delete and restore behavior end-to-end

**Files Created**:
- `backend/tests/test_suppliers.py` — 11 supplier endpoint tests

### Performance

#### Backend Query Optimization

Eliminated N+1 query patterns across multiple services with batch fetching and SQL-level filtering.

**Optimizations**:
- **Outlet hierarchy/cycle detection** — Replaced recursive single-row fetches with batch `SELECT IN` queries in `outlet_service.py`
- **BOM tree** — Batch-loaded sub-recipe links and recipes in `subrecipe_service.py` instead of per-node queries
- **Tasting session participants** — Single JOIN query to load all participants with user details in `tasting_session_service.py`
- **Recipe list access control** — SQL-level subquery filtering replaces Python-side loop filtering in `recipe_service.py`; removed debug print statements from recipe access control
- **Recipe access control cleanup** — Removed debug `print()` statements from `recipes.py` router

**Files Modified**:
- `backend/app/domain/outlet_service.py` — Batch hierarchy queries
- `backend/app/domain/subrecipe_service.py` — Batch BOM tree loading
- `backend/app/domain/tasting_session_service.py` — JOIN-based participant loading
- `backend/app/domain/recipe_service.py` — SQL subquery access filtering
- `backend/app/api/recipes.py` — Removed debug prints

#### Frontend Caching & Memoization

Optimized React rendering and TanStack Query cache behavior to reduce unnecessary re-renders and API calls.

**Optimizations**:
- **`RecipeIngredientRow`** — Wrapped with `React.memo` and memoized supplier options to prevent re-renders on parent state changes
- **Recipe ID stabilization** — Stabilized recipe ID references in `RecipeManagementTab` to avoid cascading re-renders
- **Scoped cache invalidation** — Cache invalidation for outlets and tasting notes scoped to specific IDs instead of broad invalidation
- **Increased stale time** — TanStack Query stale time increased from default to 5 minutes to reduce refetch frequency

**Files Modified**:
- `frontend/src/components/recipe/RecipeIngredientRow.tsx` — `React.memo` wrapper
- `frontend/src/components/recipes/RecipeManagementTab.tsx` — Stable ID refs
- `frontend/src/lib/hooks/useRecipeOutlets.ts` — Scoped invalidation
- `frontend/src/lib/hooks/useTastings.ts` — Scoped invalidation
- `frontend/src/lib/providers.tsx` — 5-minute stale time

---

## [0.0.16] - 2026-02-26

### Added

#### SMS Invitations for Tasting Sessions

Integrated Twilio SMS delivery for tasting session invitations, providing multi-channel communication alongside email.

**Features**:
- Twilio SMS integration for sending SMS invitations to tasting session participants
- Parallel email (SendGrid) and SMS (Twilio) delivery in single API call
- Graceful degradation if Twilio not configured—falls back to email-only without errors
- SMS includes session name, date, location, and invite link in plain text format
- Participant phone numbers managed through `TastingParticipant` type with optional `phone_number` field
- API response includes `email_count` and `sms_count` for delivery transparency

**Files Modified**:
- `frontend/src/app/api/send-tasting-invitation/route.ts` — Added Twilio integration
- `frontend/src/lib/hooks/useSendTastingInvitation.ts` — Updated recipient type and response schema
- `frontend/src/app/tastings/new/page.tsx` — Updated invitation caller to pass phone numbers
- `frontend/package.json` — Added `twilio` dependency

**Environment Variables**:
- `TWILIO_ACCOUNT_SID` — Twilio account identifier
- `TWILIO_AUTH_TOKEN` — Twilio authentication token
- `TWILIO_FROM_NUMBER` — Twilio phone number for sending SMS

#### Tasting Session Participant Association

Replaced email-based attendee lists with proper user-session relationships via `TastingUser` join table.

**Features**:
- `TastingUser` many-to-many join table links users to tasting sessions
- `TastingUserRead` DTO displays participant names and emails from User table (instead of email strings)
- Email-to-user resolution in service layer (`_resolve_attendees_to_users()`) with silent skipping of unregistered emails
- Access control: non-admin users can only access sessions they participate in (403 Forbidden otherwise)
- Admin users bypass participant check for unrestricted access
- Backward compatibility: `attendees` field retained on request DTOs for wire compatibility

**Database Changes**:
- New `TastingUser` model as join table
- Alembic migration creates `tasting_users` table
- Cascade delete on session deletion, SET NULL on user deletion
- Unique constraint on (session_id, user_id) prevents duplicate participation

**API Changes**:
- All tasting endpoints return `TastingSessionRead` with `participants: List[TastingUserRead]`
- Non-admin GET/PATCH/DELETE now require user participation or admin status
- Email lookup happens transparently during create/update operations

**Frontend**:
- New `ParticipantPicker` component for user selection during session creation
- Uses existing `useUsers()` hook for user lookup
- Supports search by username or email
- Displays selected user badges with removal capability

**Test Coverage**:
- 26/26 tests passing with participant resolution and access control validation
- Tests verify unregistered email skipping and admin access override

**Files Modified**:
- `backend/app/models/tasting.py` — Added `TastingUser` and `TastingUserRead`
- `backend/app/domain/tasting_session_service.py` — Service layer improvements
- `backend/app/api/tastings.py` — API router updates with access control
- `backend/tests/test_tastings.py` — Comprehensive test coverage

#### Menu Management Enhancements

Enhanced menu builder with drag-and-drop reordering and new editable metadata fields.

**Features**:
- Drag-and-drop reordering for menu sections and individual menu items
- Real-time order number updates during drag operations
- New `key_highlights` textarea field for signature items, seasonal specials, etc. (appears first)
- New `additional_info` textarea field for dietary notes, preparation tips, etc. (appears second)
- `DraggableSection` component wrapper for section-level drag handling
- `DraggableItem` component wrapper for item-level drag handling
- Visual feedback with opacity changes during drag operations
- Grip icons for clear drag handles
- Support for both create mode (no IDs) and update mode (with existing IDs)

**Components**:
- `MenuBuilder.tsx` — Main component managing drag-drop state and operations
- `DraggableSection` — Section wrapper with drag handle
- `DraggableItem` — Item wrapper with drag handle
- Proper type handling for `MenuItem` model fields

**Files Modified**:
- `frontend/src/components/menu/MenuBuilder.tsx` — Full drag-and-drop implementation

---

## [0.0.15] - 2026-02-23

### Added

#### Admin User Management & Route Access Control

Implemented admin user management system with role-based access control to protect admin-only routes.

**Features**:
- Admin user model and database support
- Admin identification in user authentication
- Protected admin routes with access control checks
- Fix for infinite loop on admin pages for non-admin users

#### Hierarchical Outlet-Based Access Control

Implemented comprehensive outlet hierarchy-based access control system for recipes and tasting sessions.

**Features**:
- Hierarchical outlet-based recipe filtering
- User access restricted to outlets within their hierarchy
- Recipe access control based on user outlet assignment
- Read-only mode for users without edit permissions
- Outlet hierarchy validation for access checks

**API Enhancements**:
- Enhanced recipe endpoints with outlet-based filtering
- Tasting session endpoints with user hierarchy access control
- Outlet hierarchy tree support for permission validation

#### Allergen Management System

Complete allergen tracking and display system for ingredients and recipes.

**New Features**:
- Allergen field on `Ingredient` model for tracking allergen information
- Allergen display across recipe views (ingredients panel, recipe detail, BOM)
- Ingredient allergen data management through ingredient detail UI
- Hierarchical allergen display in recipe sub-recipes and BOM tree

**Files Created/Modified**:
- Ingredient model extended with allergen field
- Recipe/ingredient components updated to display allergens
- Allergen badges in ingredient lists and recipe views

#### Supplier Soft Delete

Implemented soft delete functionality for suppliers to maintain referential integrity.

**Features**:
- Soft delete support for supplier records
- Archived suppliers remain available for historical reference
- Deactivation logic prevents orphaning ingredient-supplier links

### Fixed

- **JWT Token Regeneration**: Fixed token refresh endpoint to properly handle JWT token regeneration
- **Tasting Notes Access**: Allow tasting notes to be accessible regardless of recipe permissions (users can view tasting history even without full recipe edit access)
- **Admin Page Infinite Loop**: Fixed infinite loop occurring on admin pages for non-admin users

---

## [0.0.14] - 2026-02-12

### Added

#### Parent Outlet Recipes Display (Plan 06)

Implemented read-only display of parent outlet recipes linked to child outlets within the outlet hierarchy.

**Features**:
- Parent outlet recipes displayed in dedicated table on outlet detail page
- Read-only view showing all recipes from parent outlet(s)
- Supports multi-level hierarchy visualization
- Non-editable display to prevent accidental modifications

**Files Modified**:
- `frontend/src/components/outlets/OutletDetail.tsx`
- `frontend/src/app/outlets/[id]/page.tsx`

---

## [0.0.13] - 2026-01-28

### Added

#### Ingredient Tasting Features

Complete standalone tasting note system for individual ingredients, separate from recipe tasting sessions.

**New Features**:
- Standalone tasting notes for ingredients with ratings and feedback
- Image support for ingredient tasting notes (upload, view, delete)
- Auto-categorization via ingredient category agent
- Display of tasting history on ingredient detail pages

**UI Enhancements**:
- Ingredient tasting notes panel in ingredient detail view
- Image upload with preview and management
- Integration with existing tasting note images infrastructure

#### Canvas & Input Enhancements

**Text-Based Ingredient Addition**:
- Add ingredients directly by typing text in canvas ingredient panel
- Alternative to drag-and-drop workflow for rapid entry
- Automatic ingredient lookup and linking

**Right Panel Collapsibility**:
- Horizontal collapsible right panel (ingredient palette)
- Improved canvas real estate for larger ingredient displays
- Persistent collapse state

**Display Improvements**:
- Show usernames instead of user IDs in recipe overview
- Display parent outlet names instead of IDs in outlet management
- Image URL denormalization in Recipe model for optimized display
- Add missing `is_halal` property to fallback Ingredient objects

**Fixes**:
- Fixed overlapping items in Canvas card view layout
- Fixed ingredient/recipe dropdown table functionality
- Fixed category cache invalidation on ingredient creation

**Files Created/Modified**:
- `frontend/src/components/ingredients/IngredientTastingPanel.tsx`
- `frontend/src/hooks/useIngredientTasting.ts`
- Updated CanvasTab, RightPanel, and ingredient detail components

---

## [0.0.12] - 2026-01-21

### Added

#### Wastage Tracking & Recipe Costing

Integrated wastage percentage tracking into recipe ingredients with full cost impact calculations.

**Features**:
- Recipe ingredients track `wastage_percentage` (0-100) field
- Wastage percentage displayed in ingredient table with inline editing
- Cost calculations automatically factor in wastage
- `adjusted_cost_per_unit` reflects final cost including wastage impact

#### Multi-Image Recipe Gallery

Complete multi-image support for recipes with main image selection and carousel display.

**New Models/Features**:
- `RecipeImage` model with `is_main` flag and `order` field
- Multiple images per recipe with sequence ordering
- Main image selection UI in recipe overview
- Image carousel display on recipe cards and detail pages
- Automatic main image fallback if not explicitly set

**Migration**: Added RecipeImage table with indexes

#### Recipe Enhancements

**R&D Workflow Flags**:
- `rnd_started` flag — Marks when R&D work begins on a recipe
- `review_ready` flag — Indicates recipe is ready for review/approval
- Toggle controls in recipe overview tab

**Recipe Description Editing**:
- In-line description editing in Overview tab
- Markdown support in descriptions
- Auto-save on blur

**Profit Margin & Selling Price**:
- Calculate and display profit margin in canvas tab
- Recommended selling price based on cost + markup
- Configurable profit margin inputs
- Cost price denormalization on recipe save

#### Outlet Management Enhancements

**Outlet Hierarchy & Cycle Detection**:
- Implement parent-child relationships between outlets
- Cycle detection prevents circular hierarchies
- Outlet hierarchy tree visualization
- Deactivation of outlets with cascade considerations

**Recipe-Outlet Management UI**:
- Assign recipes to multiple outlets
- Per-outlet activation status
- Per-outlet price overrides
- Outlet badges on recipe cards
- Detail page outlet management tab

#### UI/UX Improvements

**Grid/List View Toggle**:
- Implement across inventory pages (ingredients, recipes, suppliers)
- Persistent view preference storage
- Card view (grid) and list view options
- Optimized layouts for each view type

**AI Feedback Summary**:
- AI-powered tasting feedback summarization endpoint
- Integration in recipe overview tab
- Manual trigger button for feedback generation
- Summary display and editing

**Files Created/Modified**:
- `backend/app/models/recipe_image.py`
- `backend/app/domain/recipe_image_service.py`
- `backend/app/api/recipe_outlets.py`
- Frontend components for outlet management and grid/list toggle
- Canvas tab enhancements for profit margin and cost price

#### Fixes

- Fixed routing to new canvas page
- Fixed Supabase storage mock in tests
- Fixed type errors for recipe page in R&D
- Fixed CanvasTab submit button display issues
- Fixed RightPanel disappearance bugs
- Resolve TypeScript and ESLint errors in frontend
- Fixed recipe description display in individual recipe page

---

## [0.0.11] - 2026-01-23

### Added

#### User Authentication System (Complete Integration)

Full Supabase authentication integration with user roles and session management.

**Features**:
- Supabase Auth login/logout functionality
- JWT token management (access + refresh tokens)
- User role support (normal/admin)
- Outlet assignment per user
- AuthGuard component for route protection
- Session expiration handling with auto-refresh

**New Frontend Pages**:
- `/login` — Login page with Supabase integration
- `/register` — Registration page
- Home page redirect based on auth state

**New Backend Endpoints**:
- `POST /auth/login` — Login with email/password
- `POST /auth/register` — Register new user
- `POST /auth/refresh` — Refresh JWT token

**New Models**:
- `User` model with email, username, user_type, outlet_id reference

**Files Created**:
- `backend/app/domain/supabase_auth_service.py`
- `backend/app/domain/user_service.py`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`

#### Recipe Category Management

Complete category system for organizing and filtering recipes.

**New Models**:
- `RecipeCategory` — Recipe category definition with name, description
- `RecipeRecipeCategory` — Junction table for recipe-category many-to-many relationships

**New API Endpoints** (7 total):
- `/recipe-categories` — CRUD for recipe categories
- `/recipe-recipe-categories` — CRUD for recipe-category links
- `/recipe-recipe-categories/recipe/{recipe_id}` — Get categories for recipe
- `/recipe-recipe-categories/category/{category_id}` — Get recipes in category

**New Frontend Pages**:
- `/recipe-categories` — Category list and management
- `/recipe-categories/[id]` — Category detail with recipe management

**UI Components**:
- `RecipeCategoryCard` — Category display card
- `RecipeCategoryFilterButtons` — Filter buttons for category selection
- `AddRecipeCategoryModal` — Modal for creating/editing categories
- Recipe category badges on recipe cards

**Features**:
- Assign multiple categories to recipes
- Filter recipes by category
- Add/edit/delete recipe categories
- View recipes grouped by category

#### Tasting Note Image Management

Integrated image upload and management for tasting note entries.

**Features**:
- Multiple images per tasting note
- Drag-and-drop image upload with preview
- Base64 encoding for storage
- Supabase Storage integration for persistent storage
- Batch sync operations (add/update/delete)
- Collapsible image gallery view on tasting pages

**New Endpoint**:
- `POST /tasting-note-images/sync/{tasting_note_id}` — Atomic sync operation

**UI Component**:
- `ImageUploadPreview` — Reusable image upload component

#### Branding Updates

Updated application branding and logo references throughout the codebase.

**Changes**:
- Updated logo assets and references
- Consistent branding across pages
- Updated documentation references

**Files Modified**:
- Navigation components
- Layout files
- Documentation (README, CLAUDE.md)

#### Fixes

- Removed `any` types from auth pages
- Added `AuthApiError` interface for type safety
- Show recipe description on individual recipe R&D page
- Improved error handling in auth flows

---

## [0.0.10] - 2025-12-18

### Added

#### Tasting Notes Feature (Plan 05)

Complete R&D feedback tracking system for recipe tasting sessions.

**New Models**:
- `TastingSession` — Tasting event with name, date, location, attendees
- `TastingNote` — Per-recipe feedback with 1-5 star ratings, decision, action items
- `TastingDecision` — Enum: `approved`, `needs_work`, `rejected`
- `RecipeTastingSummary` — Aggregated tasting data for a recipe

**New Database Tables**:
- `tasting_sessions` — with indexes on date and name
- `tasting_notes` — with indexes on session_id and recipe_id, cascade delete

**New API Endpoints** (13 total):
- `/tasting-sessions` — CRUD for tasting sessions
- `/tasting-sessions/{id}/stats` — Session statistics
- `/tasting-sessions/{id}/notes` — CRUD for notes within a session
- `/recipes/{id}/tasting-notes` — Recipe's tasting history
- `/recipes/{id}/tasting-summary` — Recipe's aggregated summary

**New Frontend Pages**:
- `/tastings` — List of all tasting sessions with search
- `/tastings/new` — Create new session form
- `/tastings/[id]` — Session detail with notes, ratings, and editing

**Recipe Detail Integration**:
- Added "Tasting History" section showing recent tastings
- Displays average rating, decision badges, feedback excerpts
- Links to full tasting session

**UI Enhancements**:
- Added `destructive` variant to Badge component
- Added "Tastings" to TopNav with Wine icon
- Star rating component with 1-5 interactive stars

**Migration**: `c3d4e5f6g7h8_add_tasting_tables.py`

**Docs**: `docs/completions/plan-05-tasting-notes.md`

---

## [0.0.9] - 2025-12-17

### Fixed

#### Enum-to-VARCHAR Mismatch

The `/api/v1/ingredients` endpoint was returning 500 errors due to a mismatch between Python Enum types and database VARCHAR storage.

**Root Cause**: The Alembic migration created `category` and `source` as VARCHAR columns, but the SQLModel used Python Enums without explicit `sa_column`. SQLModel interpreted these as native PostgreSQL ENUMs using member **names** (FMH, MANUAL) instead of **values** (fmh, manual), causing `LookupError` on read.

**Fix**: Changed `Ingredient` model to use explicit `sa_column=Column(String(...))` for enum-like fields, ensuring VARCHAR storage.

```python
# Before (broken)
source: IngredientSource = Field(default=IngredientSource.MANUAL)

# After (fixed)
source: str = Field(
    default="manual",
    sa_column=Column(String(20), nullable=False, default="manual")
)
```

**Files Modified**: `backend/app/models/ingredient.py`

#### CORS Origins Update

Added Vercel deployment domain to allowed CORS origins:

```
https://prepper-one.vercel.app
```

**Docs**: `docs/completions/enum-varchar-fix.md`

---

## [0.0.8] - 2025-12-17

### Added

#### Frontend Multi-Page Expansion (Plan 03)

Expanded the frontend from a single recipe canvas to a multi-page application with dedicated views for ingredients, recipes, R&D, and finance.

**New Routes**:
- `/ingredients` — Ingredients Library with search, grouping, and filtering
- `/recipes` — Recipes Gallery with status filtering and search
- `/recipes/[id]` — Individual Recipe detail page with costing and instructions
- `/rnd` — R&D Workspace for experimental recipes and ingredient exploration
- `/finance` — Finance Reporting placeholder (awaiting Atlas integration)

**New UI Components**:
- `TopNav` — Global navigation bar with active state highlighting
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` — Composable card components
- `MasonryGrid` — Pinterest-style responsive grid (using react-masonry-css)
- `GroupSection` — Section with title and count badge for grouped content
- `PageHeader` — Page title, description, and action buttons
- `SearchInput` — Search input with clear button

**New Domain Components**:
- `IngredientCard` — Ingredient display card with hover actions
- `RecipeCard` — Recipe display card with status badge and cost

**Layout Changes**:
- Root layout now includes `TopNav` for global navigation
- `TopAppBar` simplified (logo moved to TopNav)
- Responsive design: mobile-friendly layouts for all new pages

**Library**: Added `react-masonry-css` for masonry grid layout

**Docs**: `docs/completions/plan-03-frontend-pages.md`

---

## [0.0.7] - 2025-12-17

### Added

#### Recipe Extensions (Plan 02)

Extended the `Recipe` model to support sub-recipe linking (BOM hierarchy), authorship tracking, and outlet/brand attribution.

**1. Sub-Recipes (Recipe-to-Recipe Linking)**

New `recipe_recipes` junction table enables Bill of Materials hierarchy where recipes can include other recipes as components (e.g., "Eggs Benedict" includes "Hollandaise Sauce").

**New Model**: `RecipeRecipe`
- `parent_recipe_id` / `child_recipe_id` — Recipe linking
- `quantity` + `unit` — Supports `portion`, `batch`, `g`, `ml`
- `position` — Display order
- Check constraint prevents self-references

**New API Endpoints**:
- `GET /recipes/{id}/sub-recipes` — List sub-recipes
- `POST /recipes/{id}/sub-recipes` — Add sub-recipe (with cycle detection)
- `PUT /recipes/{id}/sub-recipes/{link_id}` — Update quantity/unit
- `DELETE /recipes/{id}/sub-recipes/{link_id}` — Remove sub-recipe
- `POST /recipes/{id}/sub-recipes/reorder` — Reorder sub-recipes
- `GET /recipes/{id}/used-in` — Reverse lookup (what recipes use this?)
- `GET /recipes/{id}/bom-tree` — Full BOM hierarchy tree

**Costing**: `CostingService` now recursively calculates sub-recipe costs with cycle detection.

**2. Authorship Tracking**

**New Recipe Columns**:
- `created_by` (VARCHAR 100) — Who created the recipe
- `updated_by` (VARCHAR 100) — Who last modified it

**3. Outlet/Brand Attribution**

New `outlets` and `recipe_outlets` tables for multi-brand operations.

**New Model**: `Outlet`
- `name`, `code` — Brand/location identification
- `outlet_type` — `"brand"` or `"location"`
- `parent_outlet_id` — Hierarchical structure support

**New Model**: `RecipeOutlet` (junction)
- `recipe_id` / `outlet_id` — Many-to-many linking
- `is_active` — Per-outlet activation
- `price_override` — Outlet-specific pricing

**New API Endpoints**:
- `POST /outlets` — Create outlet
- `GET /outlets` — List outlets
- `GET /outlets/{id}` — Get outlet
- `PATCH /outlets/{id}` — Update outlet
- `DELETE /outlets/{id}` — Deactivate outlet
- `GET /outlets/{id}/recipes` — Recipes for outlet
- `GET /outlets/{id}/hierarchy` — Outlet tree
- `GET /recipes/{id}/outlets` — Outlets for recipe
- `POST /recipes/{id}/outlets` — Assign to outlet
- `PATCH /recipes/{id}/outlets/{outlet_id}` — Update (price override)
- `DELETE /recipes/{id}/outlets/{outlet_id}` — Remove from outlet

**Migration**: `b2c3d4e5f6g7_add_recipe_extensions.py`

**Files Created**:
- `backend/app/models/recipe_recipe.py`
- `backend/app/models/outlet.py`
- `backend/app/domain/subrecipe_service.py`
- `backend/app/domain/outlet_service.py`
- `backend/app/api/sub_recipes.py`
- `backend/app/api/outlets.py`

---

## [0.0.6] - 2025-12-17

### Added

#### Ingredient Data Model Enhancements (Plan 01)

Extended the `Ingredient` model to support multi-supplier pricing, canonical ingredient linking, and food categorization.

**New Database Columns**:
- `suppliers` (JSONB) — Array of supplier entries with pricing, currency, SKU
- `master_ingredient_id` (FK) — Self-referential link to canonical/master ingredient
- `category` (VARCHAR) — Food category enum (proteins, vegetables, dairy, etc.)
- `source` (VARCHAR) — Origin tracking: `"fmh"` or `"manual"`

**New API Endpoints**:
- `GET /ingredients/categories` — List all food categories
- `GET /ingredients/{id}/variants` — Get variants linked to a master ingredient
- `POST /ingredients/{id}/suppliers` — Add supplier entry
- `PATCH /ingredients/{id}/suppliers/{supplier_id}` — Update supplier
- `DELETE /ingredients/{id}/suppliers/{supplier_id}` — Remove supplier
- `GET /ingredients/{id}/suppliers/preferred` — Get preferred supplier

**New Query Filters**:
- `GET /ingredients?category=proteins` — Filter by food category
- `GET /ingredients?source=fmh` — Filter by source
- `GET /ingredients?master_only=true` — Only top-level ingredients

**Migration**: `a1b2c3d4e5f6_add_ingredient_enhancements.py`

**Docs**: `docs/completions/plan-01-ingredient-enhancements.md`

---

## [0.0.5] - 2025-12-03

### Added

#### AI-Powered Instructions Parsing

Integrated Vercel AI SDK with OpenAI GPT-5.1 to transform freeform recipe instructions into structured steps.

**Stack**: Vercel AI SDK, `@ai-sdk/openai`, Zod schema validation

**Features**:
- Natural language → structured JSON with `order`, `text`, `timer_seconds`, `temperature_c`
- Automatic duration extraction (e.g., "5 minutes" → 300 seconds)
- Automatic temperature conversion (e.g., "350°F" → 177°C)
- Loading state with animated spinner

**Files**:
- `frontend/src/app/api/parse-instructions/route.ts` — Next.js API route
- `frontend/.env.example` — Added `OPENAI_API_KEY` placeholder

**Docs**: `docs/completions/ai-instructions-parsing.md`

#### UX Improvements

**Recipe Delete** — Hover-reveal trash icon with click-twice-to-confirm pattern
- Appears on hover, first click arms (turns red), second click confirms
- Auto-resets after 2 seconds if not confirmed

**Double-Click to Create Ingredient** — Double-click empty space in ingredients panel to open new ingredient form
- Reduces friction for rapid ingredient entry
- Updated hint: "Drag to add to recipe • Double-click to create new"

**Files**: `LeftPanel.tsx`, `RightPanel.tsx`

### Fixed

- **CORS**: Added `https://www.reciperep.com` and `https://reciperep.com` to Fly.io `CORS_ORIGINS`
- **API Path**: Frontend `NEXT_PUBLIC_API_URL` now correctly includes `/api/v1` suffix
- **422 Error**: Fixed `updateStructuredInstructions` payload — was wrapping in extra `{ instructions_structured: ... }` layer

**Docs**: `docs/completions/frontend-api-fix.md`

---

## [0.0.4] - 2025-12-02

### Added

#### Backend Deployment (Fly.io)

**App**: `reciperepo` deployed to Ebb & Flow Group organization

**URL**: https://reciperepo.fly.dev

**Files**: `Dockerfile`, `fly.toml`

**Config**: Singapore region, shared-cpu-1x, 1GB RAM, auto-stop enabled

**Secrets**: `DATABASE_URL` (Supabase), `CORS_ORIGINS`

**Docs**: `docs/completions/backend-deployment.md`

---

## [0.0.3] - 2024-11-27

### Added

#### Database Migration (Alembic → Supabase)

**Tables Created**: `ingredients`, `recipes`, `recipe_ingredients`

**Indexes**: `ix_ingredients_name`, `ix_recipes_name`, `ix_recipe_ingredients_recipe_id`, `ix_recipe_ingredients_ingredient_id`

**Migration**: `db480a186284_initial_tables.py`

### Fixed

- `Recipe.instructions_structured` JSON type changed from `sqlite.JSON` to `sqlalchemy.JSON` for PostgreSQL compatibility

**Docs**: `docs/completions/database-migration.md`

---

## [0.0.2] - 2024-11-27

### Added

#### Frontend (Next.js 15 + TypeScript + Tailwind)

**Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS 4, TanStack Query, dnd-kit, Sonner

**Three-Column Layout**
- `TopAppBar` — inline-editable recipe name, yield, status dropdown, cost display
- `LeftPanel` — recipe list with search, create button, selection state
- `RecipeCanvas` — ingredient drop zone, instructions workspace
- `RightPanel` — draggable ingredient palette with inline create form

**Recipe Workspace**
- Drag-and-drop ingredients from palette to recipe
- Sortable ingredient rows with quantity/unit editing and line costs
- Cost summary (batch total + per-portion) from costing API
- Instructions with Freeform/Steps tab toggle
- Structured steps with timer, temperature, drag reorder

**Data Layer**
- Typed API client (`lib/api.ts`) covering all 17 backend endpoints
- 15+ TanStack Query hooks with automatic cache invalidation
- App state context for selected recipe and UI preferences

**UX Polish**
- Debounced autosave (no save buttons)
- Loading skeletons and contextual empty states
- Toast notifications via Sonner
- Dark mode support

**Docs**: `docs/completions/frontend-implementation.md`

---

## [0.0.1] - 2024-11-27

### Added

#### Backend Foundation (FastAPI + SQLModel)

**Infrastructure**: FastAPI, PostgreSQL (Supabase), Alembic migrations, pydantic-settings

**Models**: `Ingredient`, `Recipe`, `RecipeIngredient`

**Domain Services**: IngredientService, RecipeService, InstructionsService, CostingService

**API Endpoints (17 total)**
- `/api/v1/ingredients` — CRUD + deactivate
- `/api/v1/recipes` — CRUD + status + soft-delete
- `/api/v1/recipes/{id}/ingredients` — add, update, remove, reorder
- `/api/v1/recipes/{id}/instructions` — raw, parse, structured
- `/api/v1/recipes/{id}/costing` — calculate, recompute

**Utilities**: Unit conversion (mass, volume, count)

**Testing**: Pytest with SQLite fixtures

**Docs**: `docs/completions/backend-implementation.md`

---

*Backend Blueprint: `docs/plans/backend-blueprint.md` | Alignment: ~95%*
*Frontend Blueprint: `docs/plans/frontend-blueprint.md` | Alignment: ~95%*
