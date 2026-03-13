# Frontend UI Testing Checklist

> Covers all major frontend UI scenarios based on the current implementation as of 13 March 2026.
> Check items off as they pass.

---

## 1. Authentication

### Login Page (`/login`)
- [ ] Email and password fields are present and accept input
- [ ] Submit button is disabled while login is in progress
- [ ] Successful login redirects to `/recipes` (or stored redirect URL)
- [ ] Invalid credentials show an error message below the form
- [ ] Toast notification appears on success
- [ ] Toast notification appears on error
- [ ] Link to registration page navigates to `/register`
- [ ] Access token and refresh token are stored in auth state after login

**Edge Cases**
- [ ] Submitting with empty email shows validation error (not an API call)
- [ ] Submitting with empty password shows validation error
- [ ] Very long email address (255+ chars) does not crash the form
- [ ] Very long password (255+ chars) does not crash the form
- [ ] Email with leading/trailing whitespace is trimmed before submission
- [ ] Pressing Enter in either field submits the form
- [ ] Double-clicking submit does not send duplicate login requests
- [ ] Login failure does not clear the email field (only password)
- [ ] Expired/revoked token from a previous session does not cause a redirect loop
- [ ] Browser back button after successful login does not return to login page
- [ ] Stored redirect URL is used after login (e.g., `/recipes/123` → login → `/recipes/123`)
- [ ] Malformed stored redirect URL falls back to `/recipes` safely

### Register Page (`/register`)
- [ ] Email, username, and password fields are present
- [ ] Required field validation triggers on empty submit
- [ ] Successful registration redirects to `/recipes`
- [ ] Duplicate email/username shows error message
- [ ] Link back to login page navigates to `/login`

**Edge Cases**
- [ ] Username with special characters (spaces, symbols) shows validation error or is sanitised
- [ ] Email address in invalid format (missing `@`, missing TLD) shows inline error
- [ ] Submitting with all three fields empty shows errors on all three fields simultaneously
- [ ] Very short password (1–2 chars) is rejected with a meaningful error
- [ ] Duplicate email shows the correct field-level error, not a generic one
- [ ] Duplicate username shows the correct field-level error, not a generic one
- [ ] Double-clicking the register button does not send duplicate requests
- [ ] Pressing Enter in the last field submits the form

### Auth Guard
- [ ] Unauthenticated users visiting protected routes are redirected to `/login`
- [ ] Authenticated users visiting `/login` or `/register` are redirected to `/recipes`
- [ ] Logout clears auth state and redirects to `/login`

**Edge Cases**
- [ ] Expired access token mid-session triggers a refresh; if refresh fails, redirects to `/login`
- [ ] Tampered/invalid JWT in local storage is cleared and user is redirected to `/login`
- [ ] Opening a protected route in a new tab while logged out redirects to `/login` with the original URL stored
- [ ] Logout while on a protected page clears state and lands on `/login` (no 401 flash)
- [ ] User role change (normal → admin) reflected without requiring a full logout/login cycle
- [ ] Concurrent sessions in multiple tabs do not interfere with each other's auth state

---

## 2. Navigation & Layout

### Top Navigation
- [ ] Nav links are visible and navigate to correct pages: Recipes, Ingredients, Suppliers, Tastings, R&D, Menu
- [ ] Admin-only nav items (Outlets, User Management) are visible only to admin users
- [ ] Active page link is highlighted
- [ ] User avatar / username is displayed in the nav
- [ ] Logout action clears session

**Edge Cases**
- [ ] Very long username does not break the nav bar layout (truncated or wrapped gracefully)
- [ ] Keyboard navigation (Tab key) cycles through all nav links in logical order
- [ ] Nav links remain functional after a client-side navigation (no stale state)
- [ ] Admin nav items disappear immediately after a user is demoted from admin (on next nav render)
- [ ] Rapidly clicking the same nav link multiple times does not cause duplicate fetches or errors

### Home Page (`/`)
- [ ] Authenticated users are redirected to `/recipes`
- [ ] Unauthenticated users are redirected to `/login`

**Edge Cases**
- [ ] Redirect happens before any content flash (no brief render of the home page itself)
- [ ] If `/recipes` is slow to load, redirect still happens and loading state is shown there

---

## 3. Recipe Management

### Recipe List Page (`/recipes`)
- [ ] All recipes are listed with name, status badge, and cost
- [ ] Search input filters recipes with 300ms debounce
- [ ] Search clearing restores full list
- [ ] Pagination shows 30 items per page
- [ ] "Next" and "Previous" pagination buttons work
- [ ] Pagination resets when search term changes
- [ ] "Add recipe" button opens a create modal
- [ ] Creating a recipe adds it to the list
- [ ] Clicking a recipe row navigates to `/recipes/[id]`
- [ ] Tab switching between "Recipe Management" and "Category Management" works

**Edge Cases**
- [ ] Search with only whitespace does not filter or produce an API error
- [ ] Search with special regex characters (`.*+?[]()`) does not crash or return incorrect results
- [ ] Search with XSS payload (`<script>alert(1)</script>`) is escaped and displayed safely
- [ ] Search with very long string (500+ chars) does not overflow the input or crash the API
- [ ] Recipe with no cost assigned displays a dash or zero gracefully (no blank cell)
- [ ] Recipe with a very long name truncates correctly in the list row without breaking layout
- [ ] Exactly 30 recipes in the list shows no "Next" button (boundary condition)
- [ ] Exactly 31 recipes shows a "Next" button and page 2 contains one item
- [ ] Rapidly clicking "Next" / "Previous" does not cause race conditions or duplicate requests
- [ ] Creating a recipe when on page 2 of results navigates back to page 1 to show the new item
- [ ] Navigating away and returning preserves the current search/filter state (or resets consistently)
- [ ] Clicking a recipe row on a touch device navigates correctly (no drag vs. tap confusion)

### Recipe Category Management Tab
- [ ] Recipe categories are displayed as cards
- [ ] Search input filters categories
- [ ] "Add category" button opens a modal
- [ ] Creating a category adds it to the grid
- [ ] Editing a category updates its name in place
- [ ] Deleting a category removes it with a confirmation prompt
- [ ] Category filter buttons on recipe list allow multi-select filtering
- [ ] Clicking "Load more" in category filter loads additional categories

**Edge Cases**
- [ ] Creating a category with an empty name shows a validation error
- [ ] Creating a duplicate category name shows an appropriate error
- [ ] Deleting a category that has recipes linked shows confirmation; recipes are not lost
- [ ] Category with a very long name renders without breaking the card layout
- [ ] "Load more" at the end of categories list is hidden or disabled when no more exist
- [ ] Selecting all available category filters and then clearing them restores the full recipe list
- [ ] Multi-select category filter still works after a new category is added mid-session

### New Recipe Page (`/recipes/new`)
- [ ] Page loads with an empty canvas
- [ ] All 8 canvas tabs are accessible: Canvas, Overview, Ingredients, Instructions, Costs, Outlets, Tasting, Versions
- [ ] Recipe is created on first edit (autosave)

**Edge Cases**
- [ ] Navigating away immediately (before any edit) does not create a phantom empty recipe
- [ ] Editing the name field and navigating away before autosave completes does not lose data
- [ ] Rapid switching between all 8 tabs before the recipe is saved does not cause errors
- [ ] Browser refresh mid-creation does not duplicate the recipe

### Recipe Detail Page (`/recipes/[id]`)
- [ ] Recipe data loads correctly
- [ ] Active canvas tab persists when navigating between tabs
- [ ] Back link navigates to `/recipes`

**Edge Cases**
- [ ] Navigating to a non-existent recipe ID shows a 404 or "not found" state (not a blank screen)
- [ ] Navigating to a recipe the user doesn't own shows read-only mode, not an error
- [ ] Refreshing the page preserves the active canvas tab (if stored in URL or state)
- [ ] If the recipe is deleted by another session, the current user sees an appropriate error on next action

---

## 4. Recipe Canvas Tabs

### Canvas Tab
- [ ] Ingredients appear as draggable nodes on the canvas
- [ ] Nodes can be repositioned by dragging
- [ ] Recipe name is editable inline on the canvas
- [ ] Yield and status fields are editable
- [ ] Auto-layout button repositions nodes cleanly
- [ ] Right panel shows ingredient search
- [ ] Searching and selecting an ingredient from the panel adds it to the canvas

**Edge Cases**
- [ ] Canvas with 0 ingredients shows an empty state or prompt (not a blank/broken canvas)
- [ ] Canvas with a large number of ingredients (20+) renders without performance degradation
- [ ] Ingredient node with a very long name renders without overflowing its node boundary
- [ ] Auto-layout with overlapping nodes resolves cleanly without nodes being placed off-screen
- [ ] Dragging a node to the far edge of the canvas does not cause it to disappear
- [ ] Ingredient already added to the recipe is not added twice from the search panel
- [ ] Rapidly adding multiple ingredients from the panel does not duplicate entries
- [ ] Canvas scroll/zoom state is preserved when switching to another tab and returning

### Overview Tab
- [ ] Recipe metadata (name, description, status, yield) is displayed
- [ ] All fields are editable inline
- [ ] Changes are auto-saved (no save button required)
- [ ] Owner and created/updated timestamps are shown

**Edge Cases**
- [ ] Setting name to empty string is rejected or reverts to the previous value
- [ ] Setting yield to `0` or a negative number shows a validation error or is rejected
- [ ] Setting yield to a very large number (e.g., 99999) is accepted and displayed correctly
- [ ] Description with very long text (1000+ chars) wraps correctly without breaking layout
- [ ] Autosave fires after each field change, not just on blur; verify no duplicate API calls
- [ ] Status change to "archived" reflects immediately in the status badge across all tabs
- [ ] Rapid successive edits to the same field result in only the final value being saved (debounce)

### Ingredients Tab
- [ ] Recipe ingredients are listed
- [ ] Rows can be reordered via drag-and-drop
- [ ] Quantity field is editable inline
- [ ] Unit dropdown changes the ingredient unit
- [ ] Changing unit triggers automatic price conversion
- [ ] Unit price is editable inline
- [ ] Wastage percentage slider moves between 0–100%
- [ ] Supplier dropdown shows available suppliers for the ingredient
- [ ] Allergen badge is displayed for ingredients with allergens
- [ ] Remove ingredient button removes the row with confirmation
- [ ] "Add ingredient" button opens a search modal

**Edge Cases**
- [ ] Quantity set to `0` is accepted or rejected with clear feedback
- [ ] Quantity set to a negative number is rejected
- [ ] Quantity set to a non-numeric value (e.g., "abc") reverts to the previous value
- [ ] Quantity with many decimal places (e.g., `0.00001`) is handled without rounding errors
- [ ] Unit conversion from weight to volume (cross-category) warns the user or is disabled where unsupported
- [ ] Ingredient with no suppliers shows an empty or disabled supplier dropdown (not an error)
- [ ] Wastage slider at exactly 0% and 100% are both valid and compute correctly
- [ ] Removing the last ingredient from a recipe leaves an empty state, not an error
- [ ] Drag-and-drop reorder with only one ingredient row does not break the list
- [ ] Adding the same ingredient twice to a recipe is handled (rejected or allowed per business rule)
- [ ] Allergen badge renders correctly when multiple allergens are set

### Instructions Tab
- [ ] Raw instructions textarea accepts multi-line input
- [ ] "Parse" button sends raw text to AI and returns structured steps
- [ ] Structured steps are displayed with order, text, timer, and temperature fields
- [ ] Steps can be added, edited, reordered, and deleted
- [ ] Changes are auto-saved

**Edge Cases**
- [ ] Clicking "Parse" with an empty raw text field shows a validation error or is disabled
- [ ] Very long raw input (2000+ chars) is handled without truncation or crash
- [ ] AI parse returning zero structured steps shows an empty state with an appropriate message
- [ ] AI service timeout or error shows a toast error and does not clear existing structured steps
- [ ] Rapidly clicking "Parse" multiple times does not send duplicate requests
- [ ] Step with an empty text field is rejected or shows an inline validation error on save
- [ ] Timer value set to `0` or negative is rejected or handled gracefully
- [ ] Temperature value set to a non-numeric value reverts to the previous value
- [ ] Reordering steps with only one step does not break the list
- [ ] Switching to another tab while parse is in progress and returning shows the result correctly

### Costs Tab
- [ ] Cost breakdown table shows all ingredients with columns: name, qty, unit, price/unit, wastage %, adjusted cost, line cost
- [ ] Sub-recipe cost section is displayed when sub-recipes exist
- [ ] Total batch cost and per-portion cost are shown
- [ ] Ingredients missing cost data show a warning
- [ ] "Recompute" button recalculates and persists costs

**Edge Cases**
- [ ] Recipe with no ingredients shows an empty cost table (not an error)
- [ ] Recipe with all ingredients missing unit prices shows warnings for all rows, and total cost is `$0.00` or `N/A`
- [ ] Recipe with a mix of costed and uncosted ingredients totals only the costed ones (or displays a partial-data warning)
- [ ] Sub-recipe with its own sub-recipes (nested BOM) calculates costs recursively without infinite loop
- [ ] Wastage of 100% on an ingredient results in an infinite adjusted cost; verify graceful display
- [ ] Yield of 1 and yield of 0 produce sensible per-portion costs (divide-by-zero guard)
- [ ] Recomputing while a previous recompute is in progress does not cause duplicate persisted records
- [ ] Very high ingredient cost (e.g., $99,999.99) is displayed without overflowing the column width

### Outlets Tab
- [ ] Outlets assigned to the recipe are listed
- [ ] Each outlet shows name, activation toggle, and price override field
- [ ] Price override field is editable inline
- [ ] Activation toggle enables/disables the recipe for that outlet
- [ ] "Add outlet" button opens a selection modal
- [ ] Removing an outlet unlinks it with confirmation

**Edge Cases**
- [ ] Recipe with no outlets assigned shows an empty state and an "Add outlet" prompt
- [ ] Outlet selection modal does not show outlets already linked to the recipe
- [ ] Price override set to `0` is accepted (free item scenario)
- [ ] Price override set to a negative number is rejected or shows a validation error
- [ ] Price override set to a non-numeric value reverts to the previous value
- [ ] Toggling activation off and then on in rapid succession does not desync the UI and server state
- [ ] Removing an outlet that has a price override removes the override record too (no orphan)

### Tasting Tab
- [ ] Tasting notes for the recipe are listed
- [ ] Notes can be filtered by session
- [ ] Clicking a note expands tasting feedback details

**Edge Cases**
- [ ] Recipe with no tasting notes shows an empty state (not a blank tab)
- [ ] Filtering by a session with no notes for this recipe shows an appropriate empty state
- [ ] Very long tasting note text is displayed with wrapping or truncation (no layout break)
- [ ] Expanding and collapsing notes in rapid succession does not cause scroll jumps

### Versions Tab
- [ ] Version tree is displayed using the ReactFlow graph
- [ ] Current version is highlighted
- [ ] Parent and child versions are connected by edges
- [ ] Clicking a version node navigates to that recipe
- [ ] Fork indicator is shown where applicable

**Edge Cases**
- [ ] Recipe with no forks (single version) shows a single highlighted node without edges
- [ ] Very deep version tree (5+ levels) renders without overflow or crash
- [ ] Wide version tree (many forks from a single parent) renders without node overlap
- [ ] Clicking a version node that has since been deleted navigates to a 404 state gracefully
- [ ] Current version node is highlighted even when the tree is initially zoomed out

---

## 5. Ingredients

### Ingredients List Page (`/ingredients`)
- [ ] Tab navigation: Ingredients, Categories, Allergens
- [ ] Ingredient cards/rows are displayed
- [ ] Search input filters with 300ms debounce
- [ ] Sort by Price (asc/desc) works correctly
- [ ] Group by: None, By Unit, By Status, By Category regroups the list
- [ ] Category filter buttons allow multi-select
- [ ] Unit filter buttons work
- [ ] Halal filter (Yes/No) works
- [ ] Allergen filter works
- [ ] "Show archived" checkbox reveals archived ingredients
- [ ] View toggle switches between Grid and List layouts
- [ ] Pagination shows 30 items per page
- [ ] Resetting filters restores full list
- [ ] "Add ingredient" button opens a create modal
- [ ] Creating an ingredient adds it to the list

**Edge Cases**
- [ ] Applying all filters simultaneously (category + unit + halal + allergen + search) works without error
- [ ] Category with no ingredients still shows a header when grouped by category
- [ ] Ingredient with no price sorts consistently under "Sort by Price" (placed at top or bottom, consistently)
- [ ] Ingredient with no category appears under an "Uncategorised" group when grouped by category
- [ ] Toggling "Show archived" while on page 3 resets pagination to page 1
- [ ] Creating an ingredient with a duplicate name shows an appropriate error or is allowed (per business rule)
- [ ] Creating an ingredient with an empty name is rejected with a validation error
- [ ] Searching for an ingredient by partial name returns partial matches correctly
- [ ] Switching between Grid and List preserves the current search/filter state

### Ingredient Detail Page (`/ingredients/[id]`)
- [ ] Ingredient metadata (name, unit, cost, category, halal) is displayed
- [ ] All metadata fields are editable inline
- [ ] Archive/unarchive button changes ingredient status
- [ ] Supplier entries are listed with unit, price, and preferred indicator
- [ ] "Add supplier" button opens a supplier selection dropdown
- [ ] Editing a supplier entry updates price and unit
- [ ] Marking a supplier as preferred updates the indicator
- [ ] Removing a supplier entry works with confirmation
- [ ] Median price across suppliers is calculated and displayed
- [ ] AI categorization button sends request and shows suggested category
- [ ] Accepting suggested category updates the ingredient category
- [ ] Allergen list shows allergens associated with ingredient
- [ ] Adding an allergen links it to the ingredient
- [ ] Removing an allergen unlinks it with confirmation

**Edge Cases**
- [ ] Navigating to a non-existent ingredient ID shows a 404 or "not found" state
- [ ] Ingredient with only one supplier: removing it leaves an empty supplier list (not an error)
- [ ] Setting cost to `0` is accepted (bulk/free ingredient scenario)
- [ ] Setting cost to a negative value is rejected
- [ ] Marking a second supplier as preferred unmarks the previous preferred one
- [ ] Ingredient with no suppliers shows a median price of `—` or `$0.00` (not a crash)
- [ ] AI categorization when the service is unavailable shows a toast error (button does not hang)
- [ ] Rapidly clicking "Accept" on the AI suggestion multiple times does not duplicate the update
- [ ] Archiving an ingredient that is used in active recipes shows a warning or confirmation
- [ ] Adding an allergen that is already linked to the ingredient is prevented or shows an error

---

## 6. Suppliers

### Suppliers List Page (`/suppliers`)
- [ ] Supplier cards/rows are displayed
- [ ] Search input filters with 300ms debounce
- [ ] "Show archived" checkbox reveals archived suppliers
- [ ] View toggle switches between Grid and List layouts
- [ ] Pagination shows 30 items per page
- [ ] "Add supplier" button opens a create modal
- [ ] Creating a supplier adds it to the list

**Edge Cases**
- [ ] Creating a supplier with an empty name is rejected with a validation error
- [ ] Creating a supplier with a duplicate name shows an appropriate error or is allowed
- [ ] Email field with an invalid email format shows inline validation error
- [ ] Phone field with non-numeric characters shows validation error or is accepted (per business rule)
- [ ] Toggling "Show archived" resets pagination to page 1
- [ ] Searching while "Show archived" is enabled searches across both active and archived suppliers

### Supplier Detail Page (`/suppliers/[id]`)
- [ ] Supplier metadata (name, address, phone, email) is displayed
- [ ] All fields are editable inline
- [ ] Ingredients linked to this supplier are listed with pagination
- [ ] "Add ingredient" button links an ingredient to this supplier
- [ ] Remove ingredient link works with confirmation
- [ ] Archive/restore supplier action changes status

**Edge Cases**
- [ ] Navigating to a non-existent supplier ID shows a 404 or "not found" state
- [ ] Supplier with no linked ingredients shows an empty ingredients list (not an error)
- [ ] Removing the last ingredient link leaves an empty list (not an error)
- [ ] Adding an ingredient already linked to this supplier is prevented or shows an error
- [ ] Archiving a supplier that is the preferred supplier for ingredients updates those records appropriately
- [ ] Address field with very long text (multi-line) renders without breaking the layout

---

## 7. Outlets

### Outlets Page (`/outlets`) — Admin only
- [ ] Outlet cards are displayed with name, location, hierarchy badge, and status
- [ ] "Add outlet" button opens a create modal
- [ ] Creating an outlet adds it to the grid
- [ ] Editing an outlet (name, location, parent) updates the card
- [ ] Parent outlet selection validates against cycles (prevents circular hierarchy)
- [ ] Archive/restore button changes outlet status
- [ ] Delete button removes outlet with confirmation
- [ ] Outlet hierarchy tree is visualized correctly
- [ ] Non-admin users cannot access this page (redirect or 403)

**Edge Cases**
- [ ] Creating an outlet with an empty name is rejected with a validation error
- [ ] Setting an outlet as its own parent is rejected (self-cycle)
- [ ] Setting outlet A's parent to outlet B, then outlet B's parent to outlet A is rejected (2-step cycle)
- [ ] Deleting an outlet that has child outlets: children are either orphaned or deletion is blocked (verify behaviour)
- [ ] Deleting an outlet that has recipes linked: recipes are unlinked or deletion is blocked (verify behaviour)
- [ ] Archived outlet cannot be selected as a parent for a new outlet
- [ ] Hierarchy tree with many levels renders without overflow or crash
- [ ] Non-admin user directly navigating to `/outlets` via URL is redirected or shown a 403 (not just nav-hidden)

### Outlet Detail Page (`/outlets/[id]`)
- [ ] Outlet metadata is displayed and editable
- [ ] Child outlets are listed
- [ ] Recipes assigned to the outlet are listed with pagination
- [ ] Per-recipe price override is editable
- [ ] "Add recipe" button assigns a recipe to the outlet
- [ ] Remove recipe from outlet works with confirmation

**Edge Cases**
- [ ] Outlet with no child outlets shows an empty child list (not an error)
- [ ] Outlet with no recipes assigned shows an empty recipes list and an "Add recipe" prompt
- [ ] Price override set to `0` is accepted
- [ ] Price override set to a negative number is rejected
- [ ] Adding a recipe already assigned to this outlet is prevented or shows an error
- [ ] Removing the last recipe from the outlet leaves an empty list (not an error)

---

## 8. Tasting Sessions

### Tasting Sessions List Page (`/tastings`)
- [ ] Sessions are grouped into "Upcoming & Today" and "Past Sessions"
- [ ] Search input filters sessions with debounce
- [ ] Session cards show: name, date, location, participant count, owner/invited badge
- [ ] Clicking a session card navigates to `/tastings/[id]`
- [ ] Past session cards show a past/expired status badge
- [ ] Pagination shows 30 items per page

**Edge Cases**
- [ ] Session scheduled exactly at midnight today appears in "Upcoming & Today" (not "Past")
- [ ] User with no sessions (neither owner nor participant) sees an empty state in both groups
- [ ] Very long session name truncates correctly on the card without breaking layout
- [ ] Session with no participants shows `0 participants` (not an error or blank)
- [ ] Session with no location shows a dash or empty location field gracefully

### New Tasting Session Page (`/tastings/new`)
- [ ] Session name field is required; empty submit shows validation error
- [ ] Date picker opens a calendar and allows date selection
- [ ] Time selector (hour, minute, AM/PM) works within the date picker
- [ ] "Done" closes the calendar picker
- [ ] Location field is optional
- [ ] Participant picker allows searching by username or email
- [ ] Multi-selecting participants shows badges
- [ ] Removing a participant badge deselects them
- [ ] Session notes textarea accepts multi-line input
- [ ] Create button is disabled during submission
- [ ] Successful creation redirects to the session detail page
- [ ] Invitations are sent to selected participants (email shown; SMS if phone present)
- [ ] Toast notification confirms session creation

**Edge Cases**
- [ ] Selecting a past date is allowed or rejected (per business rule — verify)
- [ ] Selecting the same participant twice is prevented
- [ ] Searching for a non-existent user in participant picker shows an empty state (not an error)
- [ ] Creating a session with no participants is allowed (solo session)
- [ ] Session name with only whitespace is rejected with a validation error
- [ ] Invitation email failure (SendGrid error) does not prevent session creation; a warning toast appears
- [ ] Invitation SMS failure (Twilio error) does not prevent session creation; graceful degradation occurs
- [ ] Creating a session with 10+ participants completes without timeout or visible lag

### Tasting Session Detail Page (`/tastings/[id]`)
- [ ] Session metadata (name, date, location, participants) is displayed
- [ ] Metadata fields are editable inline
- [ ] Recipes linked to the session are displayed
- [ ] "Add recipe" button opens a recipe search modal
- [ ] Removing a recipe from the session works with confirmation
- [ ] Tasting notes per recipe are listed
- [ ] "Add feedback" button opens a feedback modal (rating, notes, images)
- [ ] Existing notes can be edited
- [ ] Delete session button removes it with confirmation
- [ ] Non-participant, non-admin users receive a 403 error

**Edge Cases**
- [ ] Non-participant navigating directly to the URL via address bar receives a 403 (not just hidden in nav)
- [ ] Adding a recipe already in the session is prevented or shows an error
- [ ] Removing the last recipe from a session leaves an empty recipe list (not an error)
- [ ] Editing session date to a past date shows a warning or is allowed (per business rule — verify)
- [ ] Deleting a session that has tasting notes removes all notes and images (cascade confirm)
- [ ] Session with many recipes (10+) renders without performance degradation
- [ ] Changing participant list after creation sends new invitations or shows a warning

### Tasting Note Detail Page (`/tastings/[id]/r/[recipeId]`)
- [ ] Recipe being tasted and its notes are displayed
- [ ] "Add note" button opens a note form
- [ ] Image upload area accepts drag-and-drop and file picker
- [ ] Uploaded images appear in the gallery
- [ ] Images can be removed individually
- [ ] Note rating and text fields are editable
- [ ] Deleting a note removes it with confirmation

**Edge Cases**
- [ ] Uploading an image in an unsupported format (e.g., `.pdf`, `.svg`) is rejected with an error
- [ ] Uploading a very large image (>10MB) shows an error or is resized before upload
- [ ] Uploading multiple images simultaneously completes all uploads without partial failure
- [ ] Removing an image while another upload is in progress does not corrupt the gallery state
- [ ] Note with no rating set is allowed (optional) or prompts the user (per business rule — verify)
- [ ] Note with no text and only an image is allowed or rejected (per business rule — verify)
- [ ] Navigating to this page for a recipe not in the session shows a 404 or redirect
- [ ] Gallery with many images (10+) renders without layout overflow

---

## 9. R&D Workspace

### R&D List Page (`/rnd`)
- [ ] Three columns are displayed: To Do, In Progress, Review
- [ ] Search input filters across all columns with debounce
- [ ] Column item counts are accurate

**Edge Cases**
- [ ] All three columns empty: each shows an empty state (not a collapsed or hidden column)
- [ ] Search matching items in multiple columns highlights results in all columns simultaneously
- [ ] Search with no matches shows empty states in all three columns (not an error)
- [ ] Column item count updates immediately after forking a recipe (no stale count)

### To Do Column
- [ ] Recipes not yet started are listed
- [ ] Each card shows name, yield, cost, and status badge
- [ ] "Fork" button creates an editable copy and moves it to In Progress
- [ ] Feedback summary toggle collapses/expands the summary section
- [ ] AI feedback summary is generated on first open (if none exists)
- [ ] "Regenerate" button triggers a new summary
- [ ] Clicking the card navigates to the recipe detail page

**Edge Cases**
- [ ] Forking a recipe with no ingredients creates a fork with an empty ingredient list
- [ ] Forking a recipe with images does not copy the image (per implementation spec)
- [ ] "Fork" button is disabled during fork operation to prevent duplicate forks
- [ ] AI summary generation failure shows an error toast; the toggle still works (collapsing/expanding empty state)
- [ ] "Regenerate" while a summary is already generating is disabled or queued (no duplicate requests)
- [ ] Recipe with no tasting history shows an appropriate "no feedback yet" message in the summary section

### In Progress Column
- [ ] Forked recipes owned by the current user are listed
- [ ] Cards show fork indicator and any linked tasting session badges
- [ ] "Add new session" button opens a session creation modal
- [ ] Creating a session from here marks the parent recipe as `review_ready`
- [ ] Clicking the card navigates to the recipe detail page

**Edge Cases**
- [ ] Forked recipe with no linked sessions shows an empty session badge area (not an error)
- [ ] Creating a session from here and cancelling mid-creation does not mark the parent as `review_ready`
- [ ] Multiple forked recipes from the same parent all appear in this column for the current user

### Review Column
- [ ] Tasting sessions containing `review_ready` recipes are listed
- [ ] Session cards show name, date, location, and participant count
- [ ] Clicking a session card navigates to `/tastings/[id]`

**Edge Cases**
- [ ] Review column with no sessions shows an empty state
- [ ] Session card for a past session correctly shows the past date (no "upcoming" badge)
- [ ] A session containing both `review_ready` and non-`review_ready` recipes still appears in this column

---

## 10. Menu Management

### Menu List Page (`/menu`)
- [ ] Menu cards are displayed with name, version, and status badge
- [ ] "New Menu" button is visible only to admin/manager users
- [ ] Edit button is visible only for active menus and admin/manager users
- [ ] "Show archived" toggle reveals archived menus
- [ ] Archive/restore action works on menu cards
- [ ] "View" button navigates to the preview page

**Edge Cases**
- [ ] Normal user does not see the "New Menu" or "Edit" buttons (not just disabled — fully hidden)
- [ ] Archived menu shows a "Restore" button instead of "Archive"
- [ ] "Show archived" toggle resets pagination to page 1
- [ ] Menu with a very long name truncates correctly on the card
- [ ] No menus exist: empty state is shown (not a blank page)

### New Menu / Edit Menu Page
- [ ] Menu name input is present and required
- [ ] "Add section" button adds a new section
- [ ] Section title is editable inline
- [ ] "Add item" button within a section adds a new item
- [ ] Item fields are editable: name, description, `key_highlights` (first), `additional_info` (second)
- [ ] Sections can be reordered via drag-and-drop (grip icon present)
- [ ] Items within a section can be reordered via drag-and-drop
- [ ] Order numbers update automatically during drag
- [ ] Opacity feedback shows during drag
- [ ] Deleting a section removes it and its items
- [ ] Deleting an item removes it from the section
- [ ] "Publish" button publishes the menu
- [ ] "Save draft" button saves without publishing
- [ ] Cancel navigates back to menu list

**Edge Cases**
- [ ] Publishing a menu with no sections shows a validation error or confirmation
- [ ] Publishing a menu with sections but no items shows a validation error or is allowed (per business rule)
- [ ] Saving a draft with an empty menu name is rejected with a validation error
- [ ] Dragging a section over another section in a single-section menu does nothing (no crash)
- [ ] Dragging an item between sections moves it to the correct section
- [ ] Deleting the last section leaves the menu with an empty section list and an "Add section" prompt
- [ ] Item with `key_highlights` and `additional_info` both empty is allowed (optional fields)
- [ ] Very long `key_highlights` or `additional_info` wraps correctly in the preview page
- [ ] Cancel from edit mode with unsaved changes prompts a confirmation (or discards changes consistently)

### Menu Preview Page
- [ ] Menu is displayed in read-only mode
- [ ] Sections and items render correctly with highlights and additional info
- [ ] Print button triggers browser print dialog
- [ ] Back button navigates to menu list

**Edge Cases**
- [ ] Preview of a menu with no sections renders without error
- [ ] Preview of a menu with sections but no items renders section headers without error
- [ ] Print layout renders correctly (no nav bar or action buttons in print view)
- [ ] Very long menu (many sections and items) scrolls correctly without truncation

---

## 11. Recipe Categories Page (`/recipe-categories/[id]`)
- [ ] Category name and metadata are displayed
- [ ] Recipes in the category are listed
- [ ] "Add recipe" button links a recipe to this category
- [ ] Removing a recipe from the category works with confirmation
- [ ] Category name is editable inline

**Edge Cases**
- [ ] Navigating to a non-existent category ID shows a 404 or "not found" state
- [ ] Category with no recipes shows an empty list and an "Add recipe" prompt
- [ ] Adding a recipe already in this category is prevented or shows an error
- [ ] Removing the last recipe from a category leaves an empty list (not an error)
- [ ] Category name set to empty string is rejected or reverts to the previous value
- [ ] Category name with special characters renders correctly in the heading

---

## 12. UI Component Behaviors

### Search & Filtering
- [ ] Search inputs debounce at 300ms (no immediate API call per keystroke)
- [ ] Clearing search restores full results
- [ ] Multi-select filters accumulate and can be removed individually
- [ ] Filter changes reset pagination to page 1

**Edge Cases**
- [ ] Typing and immediately clearing the search field within 300ms sends no API request
- [ ] Search input with only whitespace does not send a search request (treated as empty)
- [ ] Applying a filter while a search is in flight does not produce a race condition (last result wins)
- [ ] All filters applied simultaneously produce a combined AND filter (not OR)
- [ ] Removing one multi-select filter from three does not remove the other two

### Drag and Drop
- [ ] Items being dragged show visual opacity feedback
- [ ] Releasing the drag updates the order immediately
- [ ] Grip icons are visible on draggable items

**Edge Cases**
- [ ] Dragging an item and pressing Escape cancels the drag and restores the original order
- [ ] Dragging an item to its original position does not trigger a reorder API call
- [ ] Drag-and-drop with a list of only one item does not crash
- [ ] Rapid drag-and-drop in quick succession does not send duplicate or out-of-order API requests
- [ ] Dragging on a touch screen (mobile/tablet) triggers the same reorder behaviour

### Inline Editing (EditableCell)
- [ ] Clicking or double-clicking enters edit mode
- [ ] Save and cancel buttons appear in edit mode
- [ ] Pressing Enter saves; pressing Escape cancels
- [ ] Saving shows updated value in read-only mode
- [ ] Failed save shows an error toast

**Edge Cases**
- [ ] Clicking outside the EditableCell (blur) saves or cancels consistently (not a mix of both)
- [ ] Pressing Enter in a multiline text field does not save (only Shift+Enter for newline, Enter for save)
- [ ] Editing a cell while another cell is already in edit mode closes the first before opening the second
- [ ] Saving an unchanged value does not trigger an API call
- [ ] Saving an empty value where the field is required reverts to the previous value and shows an error
- [ ] EditableCell in a read-only view does not enter edit mode on click

### Modals
- [ ] Modals open with correct title and content
- [ ] Pressing Escape closes the modal
- [ ] Clicking the backdrop closes the modal (where applicable)
- [ ] Loading state disables submit button and shows spinner
- [ ] Error messages appear inside the modal on failure

**Edge Cases**
- [ ] Opening a modal while another modal is already open either stacks correctly or prevents the second
- [ ] Pressing Escape while submit is in progress does not close the modal mid-request
- [ ] Backdrop click on a destructive action modal (e.g., confirm delete) does not proceed with the action
- [ ] Modal content with a very long form scrolls correctly within the modal (modal height does not expand past viewport)
- [ ] Tab key navigation stays within the modal (focus trap)

### Confirm Modal
- [ ] Destructive actions require confirmation before proceeding
- [ ] "Cancel" button dismisses the modal without action
- [ ] "Confirm" button proceeds and triggers the action
- [ ] Loading state disables confirm button during processing

**Edge Cases**
- [ ] Pressing Escape on the confirm modal cancels (same as clicking "Cancel")
- [ ] Double-clicking "Confirm" does not trigger the action twice
- [ ] If the action fails, the confirm modal closes and an error toast appears (not a silent hang)
- [ ] Backdrop click dismisses the confirm modal without performing the action

### Pagination
- [ ] Page size is 30 items
- [ ] "Next" and "Previous" buttons navigate pages
- [ ] Buttons are disabled at the first and last pages
- [ ] Current page and total count are displayed

**Edge Cases**
- [ ] With exactly 0 items, no pagination controls are shown
- [ ] With exactly 30 items (one full page), "Next" is disabled
- [ ] With exactly 31 items, "Next" goes to page 2 which contains one item; "Next" is then disabled
- [ ] Rapidly clicking "Next" does not navigate beyond the last page
- [ ] Deleting the last item on page 2 automatically moves back to page 1

### View Toggle (Grid / List)
- [ ] Toggling between grid and list switches the layout
- [ ] Active view is visually highlighted
- [ ] Both views display all relevant item data

**Edge Cases**
- [ ] View preference persists across page navigation (or resets consistently)
- [ ] Switching view while a search is active preserves the search results
- [ ] Grid view with a single item renders without stretching to fill the full grid width unexpectedly

### Toast Notifications
- [ ] Success toasts appear after mutations (create, update, delete)
- [ ] Error toasts appear on failed API calls
- [ ] Toasts auto-dismiss after a few seconds
- [ ] Toasts can be manually closed

**Edge Cases**
- [ ] Multiple rapid mutations produce multiple toasts without overlap or stacking overflow
- [ ] Error toast message is meaningful (not just "Something went wrong" for known errors)
- [ ] Toast appears even when the user has scrolled down the page (not hidden behind fixed nav)
- [ ] Closing a toast manually does not affect the auto-dismiss of subsequent toasts

### Loading & Empty States
- [ ] Skeleton loaders match the shape of the content being loaded
- [ ] Empty state message is shown when no results exist
- [ ] Empty state includes an action button where applicable (e.g., "Add recipe")

**Edge Cases**
- [ ] Skeleton loader does not flash briefly when data loads instantly (e.g., cached TanStack Query data)
- [ ] Empty state after applying filters includes a "clear filters" action (not just an "Add" prompt)
- [ ] Empty state after search includes a "clear search" prompt
- [ ] If data fails to load (API error), an error state is shown instead of an empty state

### Badges
- [ ] Status badges display correct colour per status (draft, active, archived, etc.)
- [ ] Allergen badges display on ingredients where allergens are set

**Edge Cases**
- [ ] Badge with a very long status string truncates or wraps without breaking layout
- [ ] Multiple allergen badges on one ingredient display without overflowing the row

---

## 13. Authorization & Access Control

- [ ] Normal users cannot access admin-only pages (Outlets, User Management)
- [ ] Normal users cannot see edit/delete controls on items they don't own
- [ ] Admin users can access and edit all resources
- [ ] Tasting sessions are only accessible to participants and admins (403 otherwise)
- [ ] Recipe edit controls are hidden for recipes not owned by the current user (read-only mode)
- [ ] Outlet-based access control restricts recipes visible to users assigned to specific outlets

**Edge Cases**
- [ ] Normal user directly navigating to `/outlets` via URL bar is redirected or shown a 403 (not just nav-hidden)
- [ ] Normal user attempts to edit a recipe via direct API URL (not UI); verify backend rejects with 403
- [ ] Admin user can edit another user's recipe without read-only mode
- [ ] User removed from a tasting session mid-session gets a 403 on next action (not a stale success)
- [ ] User assigned to outlet A cannot access recipes from outlet B (outlet-scoped filtering)
- [ ] User with no outlet assignment sees only recipes without outlet restrictions
- [ ] Token with admin role but expired signature is still rejected (not granted admin access)

---

## 14. Cross-cutting Concerns

### Autosave
- [ ] Recipe fields (name, description, yield) auto-save without a save button
- [ ] Ingredient fields (quantity, unit, price, wastage) auto-save on change
- [ ] No data loss on tab switch within recipe canvas

**Edge Cases**
- [ ] Autosave during a network outage queues or retries the save; user is notified on failure
- [ ] Switching tabs mid-autosave does not send duplicate save requests
- [ ] Two users editing the same recipe simultaneously: last write wins (or a conflict warning is shown)
- [ ] Autosave of an invalid value (e.g., empty required field) is rejected server-side; UI reverts or warns
- [ ] Page unload (browser close/refresh) while an autosave is in flight does not leave the record in a partial state

### Error Handling
- [ ] Network errors display a user-friendly error message (not a blank screen)
- [ ] API errors surface as toast notifications with a meaningful message
- [ ] Form validation errors are shown inline next to affected fields

**Edge Cases**
- [ ] HTTP 500 (server error) surfaces a user-friendly message, not a raw stack trace
- [ ] HTTP 422 (validation error) surfaces the specific field error, not a generic message
- [ ] HTTP 429 (rate limit) surfaces a "too many requests" message with guidance
- [ ] Network timeout (request never completes) does not leave UI in an indefinite loading state
- [ ] Intermittent network (offline → online) recovers gracefully; in-flight requests are retried or re-prompted
- [ ] Error in one section of the page (e.g., ingredient load failure) does not crash the entire page

### Responsiveness
- [ ] Pages are usable on a smaller viewport (tablet width ~768px)
- [ ] Grid layouts wrap correctly on narrower screens
- [ ] Navigation is accessible on smaller screens

**Edge Cases**
- [ ] Recipe canvas is usable at 768px (drag handles, panels not overlapping)
- [ ] Modals do not overflow the viewport on narrow screens
- [ ] Tables (e.g., Costs tab) scroll horizontally on narrow screens rather than overflowing
- [ ] Toast notifications stack vertically without obscuring primary content on narrow screens
- [ ] Date picker / calendar modal is usable on a touch screen at 768px
- [ ] Navigation collapses or scrolls horizontally at minimum supported width

### Performance
- [ ] TanStack Query caches data and avoids redundant API requests
- [ ] Stale data is refreshed automatically after mutations
- [ ] No visible layout shift after data loads

**Edge Cases**
- [ ] Cache invalidation after a mutation (e.g., adding an ingredient) refetches only affected queries (not all)
- [ ] Background refetch does not cause a visual flash or layout shift when new data arrives
- [ ] Navigating back to a list page uses cached data and does not show a full skeleton loader
- [ ] Large payload responses (e.g., BOM tree with 50 nodes) do not block the main thread visibly
- [ ] Multiple concurrent mutations (e.g., reorder + update price at same time) do not produce stale UI state
