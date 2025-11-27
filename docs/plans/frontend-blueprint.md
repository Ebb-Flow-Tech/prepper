Here’s a **full-page spec** you can hand straight to an LLM or a frontend dev.

Think: **single-page app**, no auth, talking to your FastAPI backend.

---

## 0. Page Identity

* **Route**: `/`
* **Purpose**: A single workspace where users:

  * Create/select a recipe
  * Attach ingredients via drag & drop
  * Edit quantities
  * Write instructions (freeform)
  * Format instructions into steps
  * See costing outputs

No marketing, no multi-page navigation. Just this.

---

## 1. Overall Layout

The layout is **three-column, fixed header**, optimized for iPad landscape:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Top App Bar                                                        │
├───────────────┬───────────────────────────────┬────────────────────┤
│ Left Panel    │           Recipe Canvas       │ Right Panel        │
│ (Recipes)     │           (Spotlight)         │ (Ingredients)      │
└───────────────┴───────────────────────────────┴────────────────────┘
```

### 1.1. Dimensions (guidance)

* Top bar: ~56–64px height.
* Left/right panels: ~260–320px width on tablet/desktop.
* Middle canvas: takes remaining width.
* Use a **single scroll container** for the middle canvas; left/right can scroll independently.

---

## 2. Top App Bar

**Always visible**, fixed at top.

### 2.1 Content (from left to right)

1. **App Name / Logo**

   * Left-aligned text: “Recipe Builder” (or logo container).
   * Acts as purely decorative for now (no click action).

2. **Current Recipe Name (center-left)**

   * If a recipe is selected:

     * Show as a large, inline-editable text field.
     * UX:

       * When recipe selected: `<h1>`-style text.
       * On click/tap: turns into text input.
       * On blur or Enter:

         * Fire `PATCH /recipes/{id}` with `{ "name": "<value>" }`.
   * If no recipe selected:

     * Show placeholder text: “No recipe selected”.

3. **Recipe Metadata / Info (center-right area)**

   A horizontal group of pill-like info blocks:

   * **Yield**

     * Label: “Yield”
     * Value: e.g. `10 portions`
     * On click: opens small inline editing popover:

       * Input: numeric (yield_quantity)
       * Select: text/enum dropdown (yield_unit)
       * On save:

         * `PATCH /recipes/{id}` with `{ "yield_quantity": x, "yield_unit": "portion" }`
         * Then optionally re-fetch costing: `GET /recipes/{id}/costing`
   * **Status**

     * Small dropdown: `Draft`, `Active`, `Archived`
     * On change:

       * `PATCH /recipes/{id}` with `{ "status": "<value>" }`

4. **Cost & Selling Price Summary (right area)**

   Display two key values, stylized as tags or small cards:

   * **Cost per portion**

     * Label: `Cost/portion`
     * Value: e.g. `$3.20`
     * Read-only.
     * Obtained from:

       * `GET /recipes/{id}/costing`
     * If unavailable: show `—` or `N/A`.
   * **Est. Selling Price**

     * Label: `Est. price`
     * Value: editable numeric.
     * On tap:

       * Turns into an inline input.
     * On blur/Enter:

       * `PATCH /recipes/{id}` with `{ "selling_price_est": <number> }`

If **no recipe selected**, right-hand area can be blank or show disabled placeholders.

---

## 3. Left Panel – Recipes List

Panel title: **“Recipes”**.

### 3.1 Header Area

* Title: `Recipes`
* To the right of title: a **primary button**:

  * Label: `+ New Recipe`
  * On click:

    * `POST /recipes` with a minimal payload, e.g.:

      ```json
      {
        "name": "Untitled Recipe",
        "yield_quantity": 10,
        "yield_unit": "portion",
        "status": "draft"
      }
      ```
    * On success:

      * Add new recipe to the local list.
      * Mark it as selected.
      * Fetch full recipe details if needed: `GET /recipes/{id}`.
      * Update Recipe Canvas with this new recipe.

### 3.2 Search

Under header:

* Input field full width:

  * Placeholder: `Search recipes…`
  * Behavior:

    * On change (debounced, e.g. 300ms):

      * Option A: filter client-side if all recipes are loaded.
      * Option B: call `GET /recipes?search=<query>` if backend supports.

### 3.3 Recipes List

Scrollable list of recipe rows/cards.

For each recipe:

* Layout:

  * **Name** (bold).
  * Subtext: `Yield: <yield_quantity> <yield_unit>`.
  * Status chip: small label (`Draft`, `Active`, etc.)
* On click:

  * Set as current recipe in state.
  * Either:

    * Use cached data if already loaded; or
    * `GET /recipes/{id}` to fetch details (ingredients, instructions).
  * Then:

    * `GET /recipes/{id}/ingredients` (or included inline in recipe details, depending on your backend design).
    * `GET /recipes/{id}/costing` (optional, or computed client-side / included).

**Context actions** (optional, but recommended):

* Swipe-left or “more” icon (`⋮`) per row.

  * Actions:

    * `Duplicate`:

      * `POST /recipes/{id}/duplicate` (if you implement) or client-side clone via `POST /recipes` using existing data.
    * `Archive`:

      * `PATCH /recipes/{id}` with `{ "status": "archived" }`.
      * Remove from default list view.

Simple error handling: on failure show toast/snackbar.

---

## 4. Right Panel – Ingredients Palette

Panel title: **“Ingredients”**.

### 4.1 Header Area

* Title: `Ingredients`
* To the right: `+ New Ingredient` button.

On click:

* Show inline expandable form at the top of the ingredient list:

  * Fields:

    * Name (text)
    * Base unit (dropdown: `g`, `kg`, `ml`, `l`, `pcs`)
    * Cost per base unit (numeric, optional)
  * Buttons: `Add` | `Cancel`

* On `Add`:

  * `POST /ingredients` with e.g.:

    ```json
    {
      "name": "Olive Oil",
      "base_unit": "l",
      "cost_per_base_unit": 6.5
    }
    ```
  * On success:

    * Insert new ingredient into the list.
    * Collapse the form.
  * On error:

    * Show inline error message or toast.

### 4.2 Ingredient Search

Below header:

* Input field: `Search ingredients…`
* Debounced filter or `GET /ingredients?search=<query>`.

### 4.3 Ingredient List

Scrollable list of ingredient rows.

Each row shows:

* Name (bold).
* Subtext line:

  * If cost known:

    * `<base_unit> • $<cost_per_base_unit>/<base_unit>`

      * Example: `kg • $3.20/kg`
  * If cost unknown:

    * `<base_unit> • no cost set`
* On the left: **drag handle** icon (for drag-and-drop to Recipe Canvas).
* On tap (no drag):

  * Optional: show small popover with ingredient details and “Edit ingredient” action (can open a small inline form or modal, but not required for MVP).

### Drag & Drop Behavior

* Ingredient rows are **draggable**.
* Valid drop zone: the **Ingredients section** in the Recipe Canvas.
* When an ingredient is dropped onto the recipe:

  1. Frontend immediately:

     * Adds a temporary row in the Recipe Ingredients list with:

       * ingredient name
       * default `quantity = 1`
       * default `unit = ingredient.base_unit`.
       * mark it as “pending save” visually (optional).
  2. Backend call:

     * `POST /recipes/{recipe_id}/ingredients` with body:

       ```json
       {
         "ingredient_id": "<id>",
         "quantity": 1,
         "unit": "<ingredient.base_unit>"
       }
       ```
  3. On success:

     * Replace temporary ID with real `recipe_ingredient_id` from backend.
     * Clear “pending” state.
     * Optionally re-fetch costing: `GET /recipes/{id}/costing`.
  4. On error:

     * Remove the temporary row.
     * Show toast: “Couldn’t add ingredient. Please try again.”

If no recipe is selected and user tries to drag:

* Either:

  * Block drag with subtle disabled styles, or
  * On drop, show message: “Select or create a recipe first.”

---

## 5. Middle Panel – Recipe Canvas (Spotlight)

This is the main workspace.

### 5.1 When No Recipe Is Selected

Show a large, centered placeholder:

* Icon + text:

  * “No recipe selected”
  * Button: `+ Create your first recipe`

    * Calls the same `POST /recipes` as from left panel and selects it.

### 5.2 When a Recipe Is Selected

The canvas is vertically stacked:

1. **Recipe Header Strip (within the canvas)**
2. **Ingredients Section**
3. **Instructions Section**

(NOTE: The top app bar already contains name, yield, status, cost; the header strip can be very light or skipped. If you keep it, keep it minimal.)

---

### 5.3 Ingredients Section (Inside Recipe Canvas)

#### Layout

* Section header:

  * Text: `Ingredients`
  * Subtext: “Drag ingredients from the right panel to add them.”

* Under header: a list/table of ingredients **for this recipe**.

Each row (recipe-ingredient) includes:

* Drag handle (to reorder within this recipe).
* Ingredient name (non-editable text).
* Quantity input:

  * Numeric input (stepper + direct typing).
* Unit dropdown:

  * Options: `g`, `kg`, `ml`, `l`, `pcs` (and any others from your system).
* Line cost (optional but ideal):

  * Read-only text showing `$X.XX` derived from quantity × ingredient.base cost.
* Delete icon (trash).

#### Data Loading

On selecting a recipe:

* Call:

  * Either `GET /recipes/{id}` including ingredients, or
  * `GET /recipes/{id}/ingredients`
* Render recipe ingredients sorted by `sort_order`.

#### Interactions

**1. Update quantity**

* When the quantity input changes (on blur or slight debounce):

  * `PATCH /recipes/{recipe_id}/ingredients/{recipe_ingredient_id}` with `{ "quantity": <value> }`
  * On success:

    * Update local state quantity.
    * Optionally re-fetch costing: `GET /recipes/{id}/costing`.
  * On error:

    * Revert to previous value.
    * Show toast: “Couldn’t update quantity.”

**2. Update unit**

* On unit change:

  * `PATCH /recipes/{recipe_id}/ingredients/{recipe_ingredient_id}` with `{ "unit": "<value>" }`
  * Same success/error behavior as above.

**3. Delete ingredient from recipe**

* On trash icon click:

  * Show quick confirmation (inline or toast-like: “Remove ingredient? [Undo]”).
  * Immediately delete row from UI (optimistic).
  * Call:

    * `DELETE /recipes/{recipe_id}/ingredients/{recipe_ingredient_id}`
  * On error:

    * Restore row.
    * Show error toast.

**4. Reorder ingredients within the recipe**

* Implement drag-and-drop vertically.
* On drop:

  * Get new order of `recipe_ingredient_ids`.
  * Call:

    * `POST /recipes/{recipe_id}/ingredients/reorder` with:

      ```json
      {
        "ordered_ids": [1, 5, 3, 8]
      }
      ```
  * On success:

    * Update local order.
  * On error:

    * Revert to previous order.
    * Show toast.

#### Cost Summary Row (Bottom of Ingredients Section)

At the bottom of the ingredients list:

* Show:

  ```text
  Total batch cost:  $XX.XX
  Cost per portion:  $X.XX    (info icon)
  ```

* Data from:

  * `GET /recipes/{id}/costing` response.

* Info icon on tap:

  * Small popover:

    * “Calculated from ingredient base costs and current yield of <yield_quantity> <yield_unit>.”

---

### 5.4 Instructions Section

Section header: `Instructions`.

Under header, a **tab-like toggle**:

* `Freeform` | `Steps`

#### A. Freeform Tab

* Full-width multiline textarea.
* Placeholder: “Type the recipe as you’d explain it to another chef…”
* Value bound to `recipe.instructions_raw`.

**Events:**

* On blur or every X keystrokes debounced:

  * `PATCH /recipes/{id}` with:

    ```json
    {
      "instructions_raw": "<text>"
    }
    ```

**Format button:**

* Below textarea, aligned right:

  * Button label: `Format into steps`.
  * On click:

    * Call:

      * `POST /recipes/{id}/instructions/parse`
        Body:

        ```json
        {
          "instructions_raw": "<current freeform text>"
        }
        ```

    * Backend:

      * Uses LLM to parse into structured steps.
      * Returns:

        ```json
        {
          "steps": [
            {
              "order": 1,
              "text": "Preheat oven to 180°C.",
              "timer_seconds": 0,
              "temperature_c": 180
            },
            ...
          ]
        }
        ```

    * On success:

      * Store structured JSON in state.
      * Also call:

        * `PATCH /recipes/{id}` with:

          ```json
          {
            "instructions_structured": { "steps": [...] }
          }
          ```
      * Automatically switch to `Steps` tab.

    * On error:

      * Show error toast: “Couldn’t format steps. Check your connection or try again later.”

#### B. Steps Tab

Display each step as a card in a vertical list.

Each step card includes:

* Step number (1,2,3… based on current order).
* Multiline text field for the step description.
* Optional fields:

  * Timer:

    * Input or segmented fields: mm:ss
  * Temperature:

    * Numeric input with “°C” suffix.
* Drag handle on left to reorder steps.
* Trash icon to delete step.

**Interactions:**

1. **Edit step text**

   * On blur of step text:

     * Update local `instructions_structured`.
     * `PATCH /recipes/{id}` with updated `instructions_structured`.

2. **Edit timer / temperature**

   * Same pattern: update local JSON, then `PATCH /recipes/{id}`.

3. **Reorder steps**

   * On drag-and-drop reorder:

     * Update `order` fields locally.
     * `PATCH /recipes/{id}` with full updated `instructions_structured`.

4. **Delete step**

   * On trash click:

     * Remove step locally.
     * Renumber orders.
     * `PATCH /recipes/{id}` with updated `instructions_structured`.

---

## 6. Global Behaviors

### 6.1 Loading States

* On initial load of `/`:

  * `GET /recipes` → show skeleton list in left panel.
  * `GET /ingredients` → show skeleton list in right panel.
* When a recipe is selected:

  * Show spinner overlay inside Recipe Canvas until:

    * `GET /recipes/{id}` (and /ingredients /costing if separate) resolves.

### 6.2 Error Handling

* All API failures should show a non-intrusive toast/snackbar at bottom:

  * e.g. “Failed to update ingredient. Changes were reverted.”
* For critical failures (like failed initial load), show a retry button.

### 6.3 Autosave & Debounce

* Use **debounced PATCH** for:

  * Recipe name
  * Yield quantity/unit
  * Selling price
  * Instructions raw
  * Instructions structured edits
  * Recipe-ingredient quantity/unit changes

Suggested debounce: 400–800ms after last change.

### 6.4 Optimistic UI

* For ingredient add/remove and quantity changes:

  * Update UI immediately.
  * If backend fails, revert.

