# Plan 20 Part 3: Product Tags

## Goal

Introduce a product-level tagging system for supplier ingredients. This requires new database tables, migrations, backend CRUD endpoints with tests, and a Tags column with management modal in the Products tab.

---

## 1. Database Schema

Two new tables, modelled after the existing `categories` / `recipe_recipe_categories` pattern.

### `supplier_ingredient_tags`

Stores the tag definitions (name only, soft-delete supported).

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | auto-increment |
| `name` | String(100) | unique, not null |
| `is_active` | Boolean | default `True`; soft-delete flag |

### `supplier_ingredient_supplier_ingredient_tags`

Join table for the many-to-many relationship between supplier ingredients and tags.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | auto-increment |
| `supplier_ingredient_id` | Integer FK → `supplier_ingredients.id` | cascade delete |
| `supplier_ingredient_tag_id` | Integer FK → `supplier_ingredient_tags.id` | cascade delete |

Unique constraint on `(supplier_ingredient_id, supplier_ingredient_tag_id)`.

---

## 2. SQLModel Models

**File:** `backend/app/models/supplier_ingredient_tag.py` *(new)*

```python
class SupplierIngredientTag(SQLModel, table=True):
    __tablename__ = "supplier_ingredient_tags"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    is_active: bool = Field(default=True)

class SupplierIngredientTagLink(SQLModel, table=True):
    __tablename__ = "supplier_ingredient_supplier_ingredient_tags"
    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_ingredient_id: int = Field(foreign_key="supplier_ingredients.id")
    supplier_ingredient_tag_id: int = Field(foreign_key="supplier_ingredient_tags.id")

# Read / Create DTOs
class SupplierIngredientTagRead(SQLModel):
    id: int
    name: str
    is_active: bool

class SupplierIngredientTagCreate(SQLModel):
    name: str
```

Register both models in `backend/app/models/__init__.py`.

---

## 3. Alembic Migration

**File:** `backend/alembic/versions/<hash>_add_supplier_ingredient_tags.py`

- Create `supplier_ingredient_tags` table
- Create `supplier_ingredient_supplier_ingredient_tags` table with FK constraints and unique constraint
- `downgrade()` drops both tables in reverse order

---

## 4. Service Layer

**File:** `backend/app/domain/supplier_ingredient_tag_service.py` *(new)*

Functions (each takes a SQLModel `Session`):

| Function | Description |
|----------|-------------|
| `list_tags(session)` | Returns all active `SupplierIngredientTag` records |
| `create_tag(session, name)` | Creates a new tag; raises 409 if name already exists |
| `delete_tag(session, tag_id)` | Soft-delete (sets `is_active = False`) |
| `get_tags_for_supplier_ingredient(session, si_id)` | Returns tags linked to a supplier ingredient |
| `add_tag_to_supplier_ingredient(session, si_id, tag_id)` | Creates link; ignores duplicate |
| `remove_tag_from_supplier_ingredient(session, si_id, tag_id)` | Deletes link |

---

## 5. API Endpoints

**File:** `backend/app/api/supplier_ingredient_tags.py` *(new)*

Mount at `/api/v1/supplier-ingredient-tags`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all active tags |
| `POST` | `/` | Create a new tag |
| `DELETE` | `/{tag_id}` | Soft-delete a tag |
| `GET` | `/supplier-ingredient/{si_id}` | Get tags for a supplier ingredient |
| `POST` | `/supplier-ingredient/{si_id}/{tag_id}` | Link tag to supplier ingredient |
| `DELETE` | `/supplier-ingredient/{si_id}/{tag_id}` | Unlink tag from supplier ingredient |

Register the router in `backend/app/main.py`.

---

## 6. Unit Tests

**File:** `backend/tests/test_supplier_ingredient_tags.py` *(new)*

Cover:
- Create tag (success + duplicate name 409)
- List tags (returns only active)
- Soft-delete tag (no longer returned in list)
- Get tags for a supplier ingredient (empty + with links)
- Add tag link (success + duplicate is idempotent)
- Remove tag link

Follow the pattern in `tests/test_categories.py`.

---

## 7. Frontend — API + Hook

**File:** `frontend/src/lib/api.ts`

```ts
export async function getSupplierIngredientTags(): Promise<SupplierIngredientTag[]>
export async function createSupplierIngredientTag(name: string): Promise<SupplierIngredientTag>
export async function deleteSupplierIngredientTag(tagId: number): Promise<void>
export async function getTagsForSupplierIngredient(siId: number): Promise<SupplierIngredientTag[]>
export async function addTagToSupplierIngredient(siId: number, tagId: number): Promise<void>
export async function removeTagFromSupplierIngredient(siId: number, tagId: number): Promise<void>
```

**File:** `frontend/src/lib/hooks/useSupplierIngredientTags.ts` *(new)*

```ts
export function useSupplierIngredientTags()        // all tags
export function useCreateSupplierIngredientTag()   // mutation
export function useDeleteSupplierIngredientTag()   // mutation
export function useTagsForSupplierIngredient(siId) // per-product tags
export function useAddTagToSupplierIngredient()    // mutation
export function useRemoveTagFromSupplierIngredient() // mutation
```

Cache keys should invalidate each other appropriately (e.g., adding a tag invalidates the per-product tags query).

Add `SupplierIngredientTag` to `frontend/src/lib/types/index.ts`.

---

## 8. Frontend — Tags Column + Modal

### 8a. TagsCell component

**File:** `frontend/src/components/ingredients/TagsCell.tsx` *(new)*

- Displays tags for a supplier ingredient as small badges
- An "Edit" icon button opens the tag management modal

### 8b. TagManagementModal component

**File:** `frontend/src/components/ingredients/TagManagementModal.tsx` *(new)*

- Lists all existing tags with a checkbox/toggle per tag to link/unlink it from the current supplier ingredient
- A text input + button to create a new global tag (calls `createSupplierIngredientTag` then links it)
- An X icon beside each tag to soft-delete the global tag (with a confirm prompt)
- Uses existing `<Modal>` component

### 8c. Wire into Products tab

**File:** `frontend/src/components/ingredients/ProductsTab.tsx`

- Add `Tags` as the last column in the table
- Render `<TagsCell siId={row.id} />` in each row

---

## Verification

1. Tags CRUD endpoints return correct data; tests all pass (`pytest tests/test_supplier_ingredient_tags.py`).
2. Migration applies cleanly (`alembic upgrade head`) and rolls back cleanly (`alembic downgrade -1`).
3. Products tab now shows a Tags column; clicking the edit icon opens the modal.
4. Linking/unlinking a tag updates the cell without a page reload.
5. Creating a new tag from the modal adds it globally and links it immediately.
6. Soft-deleting a tag removes it from all dropdowns; existing links are hidden.
7. `npm run build` and `npm run lint` pass with no errors.
