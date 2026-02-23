# Frontend Pages Documentation

This document lists all pages in the Prepper frontend application and their functionality.

## Core Navigation Pages

### Home (`/`)
**Description:** Landing/home page that serves as the entry point to the application.
- Redirects authenticated users to `/recipes`
- Redirects unauthenticated users to `/login`

**Checklist:**
- [ ] Redirect logic implemented
- [ ] Loading state while checking auth
- [ ] Branded landing content (optional for auth users)

---

### Login (`/login`)
**Description:** User authentication page for logging in with email and password.
- JWT token-based authentication
- Integration with Supabase auth
- Form validation
- Error handling for invalid credentials

**Checklist:**
- [ ] Email/password input fields
- [ ] Form validation
- [ ] Error messages display
- [ ] Redirect to `/recipes` on successful login
- [ ] Link to `/register` page
- [ ] Loading state during submission
- [ ] JWT token storage (localStorage/cookies)

---

### Register (`/register`)
**Description:** User registration page for creating new accounts.
- Email, username, and password input
- Supabase auth integration
- User role selection (normal/admin)
- Optional outlet assignment

**Checklist:**
- [ ] Email input with validation
- [ ] Username input with validation
- [ ] Password input with strength indicator
- [ ] Password confirmation
- [ ] User type selection (normal/admin)
- [ ] Outlet selection (optional)
- [ ] Terms of service checkbox
- [ ] Redirect to `/login` on successful registration
- [ ] Link to login page
- [ ] Loading state during submission

---

## Recipe Management Pages

### Recipes List (`/recipes`)
**Description:** Main recipe management dashboard with multiple tabs for different operations.
- Recipe list/management view with drag-and-drop support
- Multiple tabs:
  - **Recipe Tab:** List of recipes with CRUD operations
  - **Outlet Management Tab:** Manage recipe-outlet relationships
  - **Category Management Tab:** Manage recipe-category relationships
- Search and filtering capabilities
- Recipe creation from list

**Checklist:**
- [ ] Recipe tab with list display
- [ ] Outlet Management tab
- [ ] Category Management tab
- [ ] Search functionality
- [ ] Filter by status (draft, active, archived)
- [ ] Sort options (name, date, cost)
- [ ] Create new recipe button
- [ ] Edit recipe button
- [ ] Delete recipe with confirmation
- [ ] Fork/version recipe
- [ ] Soft-delete handling
- [ ] Tab persistence
- [ ] Pagination/virtualization for large lists

---

### Create New Recipe (`/recipes/new`)
**Description:** Page for creating a new recipe from scratch.
- Recipe name and basic metadata input
- Optional image upload
- Auto-save functionality

**Checklist:**
- [ ] Recipe name input
- [ ] Optional description
- [ ] Optional image upload
- [ ] Default values initialization
- [ ] Auto-save on each field change
- [ ] Validation before saving
- [ ] Redirect to recipe detail page on creation

---

### Recipe Detail (`/recipes/[id]`)
**Description:** Main recipe editing and viewing interface - the "recipe canvas" where all recipe operations occur.
- Multi-tab interface with different views:
  - **Canvas:** Overview and basic info
  - **Overview:** Recipe metadata and status
  - **Ingredients:** Recipe ingredient list with drag-and-drop
  - **Instructions:** Freeform and structured instructions
  - **Costs:** Recipe costing and cost breakdown
  - **Outlets:** Outlet assignments and price overrides
  - **Tasting:** Tasting notes and history
  - **Versions:** Recipe version tree and history
- Autosave on all changes
- Real-time cost calculations
- Sub-recipe management
- Image carousel

**Checklist:**
- [ ] Canvas tab with recipe overview
- [ ] Overview tab with metadata
- [ ] Ingredients tab with drag-and-drop
  - [ ] Add ingredient
  - [ ] Remove ingredient
  - [ ] Reorder ingredients
  - [ ] Edit wastage percentage
  - [ ] Edit unit price
- [ ] Instructions tab
  - [ ] Raw instructions editor
  - [ ] Parse instructions (LLM)
  - [ ] Structured instructions editor
- [ ] Costs tab
  - [ ] Cost breakdown display
  - [ ] Wastage impact visualization
  - [ ] Recompute cost button
- [ ] Outlets tab
  - [ ] List of assigned outlets
  - [ ] Add recipe to outlet
  - [ ] Remove recipe from outlet
  - [ ] Override outlet pricing
- [ ] Tasting tab
  - [ ] Tasting notes list
  - [ ] Tasting summary
- [ ] Versions tab
  - [ ] Version tree visualization
  - [ ] Version history list
- [ ] Image carousel
- [ ] Fork recipe button
- [ ] Delete recipe button
- [ ] Autosave indicator
- [ ] Error handling and recovery

---

## Ingredient Management Pages

### Ingredients List (`/ingredients`)
**Description:** View and manage all ingredients in the system.
- Ingredient list with categorization
- Search and filter capabilities
- Create new ingredient
- Edit and deactivate ingredients
- Supplier management interface

**Checklist:**
- [ ] Ingredient list display
- [ ] Search by ingredient name
- [ ] Filter by category
- [ ] Categorize ingredients button
- [ ] Create new ingredient button
- [ ] Edit ingredient button
- [ ] Deactivate/archive ingredient button
- [ ] Bulk actions (optional)
- [ ] Pagination/virtualization
- [ ] Sort by name, category, supplier count

---

### Ingredient Detail (`/ingredients/[id]`)
**Description:** Detailed ingredient view with supplier and variant management.
- Ingredient metadata (name, unit, density)
- Supplier entries with pricing
- Ingredient variants
- Preferred supplier selection
- Recipes using this ingredient

**Checklist:**
- [ ] Ingredient name and metadata
- [ ] Unit selection
- [ ] Density input (optional)
- [ ] Supplier list
  - [ ] Add supplier
  - [ ] Edit supplier entry (price, MOQ)
  - [ ] Remove supplier
  - [ ] Set as preferred
- [ ] Ingredient variants list
- [ ] Recipes using this ingredient
- [ ] Category assignment
- [ ] Auto-save functionality

---

## Supplier Management Pages

### Suppliers List (`/suppliers`)
**Description:** Manage all suppliers and their details.
- Supplier list display
- Search and filter
- Create new supplier
- Edit supplier information

**Checklist:**
- [ ] Supplier list display
- [ ] Search by supplier name
- [ ] Create new supplier button
- [ ] Edit supplier button
- [ ] Delete supplier button
- [ ] View supplier contact info
- [ ] Pagination/virtualization

---

### Supplier Detail (`/suppliers/[id]`)
**Description:** Detailed supplier view with contact info and ingredient links.
- Supplier name, address, phone, email
- List of ingredients supplied
- Pricing information for each ingredient
- Contact information management

**Checklist:**
- [ ] Supplier name
- [ ] Address input
- [ ] Phone input
- [ ] Email input
- [ ] Ingredients list (supplied by this supplier)
- [ ] Pricing per ingredient
- [ ] Edit contact information
- [ ] Auto-save functionality
- [ ] Delete supplier button

---

## Outlet Management Pages

### Outlet Detail (`/outlets/[id]`)
**Description:** Detailed outlet view with hierarchy and recipe management.
- Outlet name and metadata
- Parent outlet relationship
- Child outlet hierarchy
- Recipes assigned to outlet
- Outlet-specific pricing overrides

**Checklist:**
- [ ] Outlet name and metadata
- [ ] Parent outlet selection
- [ ] Child outlet list
- [ ] Recipes assigned to outlet
  - [ ] View assigned recipes
  - [ ] View per-outlet price overrides
  - [ ] Remove recipe from outlet
- [ ] Outlet hierarchy visualization
- [ ] Cycle detection feedback
- [ ] Edit outlet information
- [ ] Delete outlet button

---

## Tasting Session Pages

### Tastings List (`/tastings`)
**Description:** View all tasting sessions and their summaries.
- List of all tasting sessions
- Session date, name, and status
- Quick access to session statistics
- Create new tasting session

**Checklist:**
- [ ] Tasting session list display
- [ ] Session name
- [ ] Session date
- [ ] Participant count
- [ ] Recipes in session count
- [ ] Session status (active, completed)
- [ ] Create new session button
- [ ] View session details button
- [ ] Delete session button
- [ ] Sort and filter options

---

### Create New Tasting Session (`/tastings/new`)
**Description:** Page for creating a new tasting session.
- Session name and date input
- Optional participant list
- Recipe selection (optional at creation)

**Checklist:**
- [ ] Session name input
- [ ] Session date/time picker
- [ ] Optional participant email list
- [ ] Optional recipe selection
- [ ] Create and start session button
- [ ] Validation before creation
- [ ] Auto-save draft session

---

### Tasting Session Detail (`/tastings/[id]`)
**Description:** Main tasting session view with statistics and recipe management.
- Session metadata
- List of recipes in session
- Session statistics (ratings, feedback)
- Add/remove recipes from session
- Quick access to tasting notes

**Checklist:**
- [ ] Session name and date display
- [ ] Session status
- [ ] Recipes in session list
  - [ ] Add recipe button
  - [ ] Remove recipe button
  - [ ] View tasting notes button
- [ ] Session statistics
  - [ ] Average rating
  - [ ] Feedback summary
  - [ ] Participant count
- [ ] Export session data (optional)
- [ ] Edit session information
- [ ] Archive/delete session

---

### Tasting Notes for Recipe (`/tastings/[id]/r/[recipeId]`)
**Description:** Detailed tasting notes view for a specific recipe within a session.
- Tasting notes CRUD
- Image upload and management for notes
- Rating and feedback entry
- Participant information
- Historical tasting data for recipe

**Checklist:**
- [ ] Tasting note creation form
  - [ ] Rating input (1-5 or 1-10 scale)
  - [ ] Feedback text area
  - [ ] Participant name
- [ ] Tasting notes list for recipe
- [ ] Edit tasting note button
- [ ] Delete tasting note button
- [ ] Image upload for notes
  - [ ] Drag-and-drop upload
  - [ ] Multiple images per note
  - [ ] Image preview
  - [ ] Image delete
- [ ] AI feedback summarization (optional)
- [ ] Historical tasting data display
- [ ] Export tasting data (optional)

---

## Outlet Management Pages

### Outlets (Implicit in Recipe Management)
**Description:** While dedicated outlet CRUD is not shown as a standalone page, outlet management is integrated into:
- Recipe detail page (Outlets tab)
- Outlet detail pages (`/outlets/[id]`)

**Checklist:**
- [ ] Create new outlet functionality
- [ ] View outlet details
- [ ] Edit outlet information
- [ ] Delete outlet
- [ ] Manage parent-child relationships
- [ ] View recipes in outlet
- [ ] Set price overrides per recipe

---

## Recipe Category Management Pages

### Recipe Category Detail (`/recipe-categories/[id]`)
**Description:** Detailed recipe category view with recipe management.
- Category name and metadata
- List of recipes in category
- Add/remove recipes from category
- Category editing

**Checklist:**
- [ ] Category name and metadata display
- [ ] Recipes in category list
  - [ ] Add recipe to category
  - [ ] Remove recipe from category
- [ ] Category statistics (recipe count)
- [ ] Edit category information
- [ ] Delete category button
- [ ] Search recipes in category

---

## Analytics & Dashboard Pages

### Finance (`/finance`)
**Description:** Finance and analytics dashboard.
- Recipe costing aggregates
- Outlet profitability
- Cost trends over time
- Supplier pricing analysis (optional)

**Checklist:**
- [ ] Total recipe count
- [ ] Average recipe cost
- [ ] Cost breakdown by category
- [ ] Outlet profitability summary
- [ ] Cost trends chart
- [ ] Supplier price comparison (optional)
- [ ] Export report functionality (optional)

---

## Development & Design Pages

### R&D Workspace (`/rnd`)
**Description:** List of recipes in R&D/development status.
- View recipes marked with `rnd_started: true`
- Filter recipes in development
- Quick access to R&D recipes

**Checklist:**
- [ ] R&D recipes list
- [ ] Filter by status (in development, review ready)
- [ ] Sort by date created
- [ ] View R&D recipe detail button
- [ ] Start new R&D session button

---

### R&D Recipe Detail (`/rnd/r/[recipeId]`)
**Description:** Detailed R&D workspace for individual recipe development.
- Recipe editing interface optimized for R&D
- Development status tracking
- Feedback and summary
- Tasting notes integration
- Version branching

**Checklist:**
- [ ] Full recipe editing interface
- [ ] `rnd_started` flag display/toggle
- [ ] `review_ready` flag toggle
- [ ] Summary feedback display
- [ ] Tasting notes display
- [ ] Version branching interface
- [ ] Fork recipe for experimentation
- [ ] Mark as ready for review

---

### Design System (`/design-system`)
**Description:** Design system reference page showing UI components and patterns.
- Component showcase
- Typography specimens
- Color palette
- Interactive component examples
- Documentation

**Checklist:**
- [ ] Button components showcase
- [ ] Input components showcase
- [ ] Modal components showcase
- [ ] Card components showcase
- [ ] Typography styles
- [ ] Color palette display
- [ ] Icons showcase
- [ ] Layout patterns
- [ ] Interactive examples
- [ ] Documentation/usage examples

---

## API Routes

### Image Generation (`/api/generate-image`)
**Description:** Server-side route handler for DALL-E 3 image generation.
- Receives recipe description
- Calls OpenAI API
- Returns generated image URL

**Checklist:**
- [ ] POST endpoint implementation
- [ ] OpenAI API integration
- [ ] Error handling
- [ ] Rate limiting (optional)
- [ ] Image caching (optional)

---

## Implementation Status Summary

| Page | Status | Notes |
|------|--------|-------|
| `/` | | Home/landing page |
| `/login` | | Authentication |
| `/register` | | User registration |
| `/recipes` | | Recipe management hub |
| `/recipes/new` | | Recipe creation |
| `/recipes/[id]` | | Recipe canvas (main workspace) |
| `/ingredients` | | Ingredient list |
| `/ingredients/[id]` | | Ingredient detail |
| `/suppliers` | | Supplier list |
| `/suppliers/[id]` | | Supplier detail |
| `/outlets/[id]` | | Outlet detail |
| `/recipe-categories/[id]` | | Recipe category detail |
| `/tastings` | | Tasting sessions list |
| `/tastings/new` | | Create tasting session |
| `/tastings/[id]` | | Tasting session detail |
| `/tastings/[id]/r/[recipeId]` | | Tasting notes for recipe |
| `/finance` | | Finance dashboard |
| `/rnd` | | R&D workspace list |
| `/rnd/r/[recipeId]` | | R&D recipe detail |
| `/design-system` | | Design system reference |
| `/api/generate-image` | | Image generation API |

---

## Navigation Structure

```
Home (/)
├── Login (/login)
├── Register (/register)
├── Recipes (/recipes)
│   ├── Recipe Detail (/recipes/[id])
│   │   ├── Canvas
│   │   ├── Overview
│   │   ├── Ingredients
│   │   ├── Instructions
│   │   ├── Costs
│   │   ├── Outlets
│   │   ├── Tasting
│   │   └── Versions
│   ├── Create Recipe (/recipes/new)
│   ├── Outlet Management
│   └── Category Management
├── Ingredients (/ingredients)
│   └── Ingredient Detail (/ingredients/[id])
├── Suppliers (/suppliers)
│   └── Supplier Detail (/suppliers/[id])
├── Outlets (/outlets/[id])
├── Recipe Categories (/recipe-categories/[id])
├── Tastings (/tastings)
│   ├── Create Session (/tastings/new)
│   ├── Session Detail (/tastings/[id])
│   └── Tasting Notes (/tastings/[id]/r/[recipeId])
├── Finance (/finance)
├── R&D (/rnd)
│   └── R&D Recipe (/rnd/r/[recipeId])
└── Design System (/design-system)
```

