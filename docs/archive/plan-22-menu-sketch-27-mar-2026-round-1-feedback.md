# Plan 22: Menu Sketch UI Refinements

## Context

A round of UX feedback identified several polish issues in the menu sketch feature. All changes are contained to the `/menu-sketch` list page and the `/menu-sketch/[id]` editor page. No backend model or service changes are required.

---

## Changes

### 1. Comment badge — orange background when 1+ unresolved (edit mode)

**Files:** `frontend/src/app/menu-sketch/[id]/page.tsx`

**DishCard** (~line 333-342):
```tsx
// Before
className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"

// After — orange when commentCount > 0
className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors
  ${commentCount > 0
    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 hover:bg-orange-500/25'
    : 'text-muted-foreground hover:text-foreground'
  }`}
```

**DishRow** (~line 472-483): same pattern on the comment button and the count `<span>` inside it.

---

### 2. Description auto-expands to fit existing content (edit mode)

**Files:** `frontend/src/app/menu-sketch/[id]/page.tsx`

Both `DishCard` and `DishRow` initialise `descOpen` from `!!dish.description?.trim()` — correct. But the inline `ref={(el) => autoResize(el)}` can fire before layout is stable.

Fix: add `descRef = useRef<HTMLTextAreaElement>(null)` in each component and a `useEffect` that calls `autoResize(descRef.current)` when `descOpen` transitions to `true`:

```tsx
const descRef = useRef<HTMLTextAreaElement>(null);
useEffect(() => {
  if (descOpen) autoResize(descRef.current);
}, [descOpen]);
```

Attach `ref={descRef}` to the description `<textarea>` (replacing the inline ref callback).

---

### 3. Cost % displayed in edit mode (non-editable, auto-calculated)

**Files:** `frontend/src/app/menu-sketch/[id]/page.tsx`

Compute:
```ts
const costPct = dish.sales_price > 0
  ? ((dish.cost_price / dish.sales_price) * 100).toFixed(1) + '%'
  : '—';
```

**DishRow (list view)**:
- Column template: `grid-cols-[1fr_1fr_80px_80px]` → `grid-cols-[1fr_1fr_80px_80px_56px]`
- Add a read-only 5th cell displaying `costPct`, styled `text-xs tabular-nums text-muted-foreground text-right px-3 py-2`
- Header row in `SectionCard` (~line 641): `grid-cols-[32px_1fr_1fr_80px_80px_32px]` → `grid-cols-[32px_1fr_1fr_80px_80px_56px_32px]`, add `<span>%</span>` header

**DishCard (card view)**:
- Change 2-col price grid to 3 columns: `grid-cols-3`
- Third column shows `costPct` as a read-only display, with a `%` label, styled consistently with the other two fields

---

### 4. Preview mode — comment badge always visible, orange when 1+ unresolved

**Files:** `frontend/src/app/menu-sketch/[id]/page.tsx` — `DishPreviewCell`

Badge is always rendered (even with 0 comments). Colour changes based on count:

```tsx
className={`shrink-0 flex items-center gap-0.5 rounded-full border px-1.5 text-[10px] transition-colors hover:opacity-80
  ${commentCount > 0
    ? 'border-orange-400/50 bg-orange-500/15 text-orange-600 dark:text-orange-400'
    : 'border-border bg-muted/60 text-muted-foreground'
  }`}
```

---

### 5. Preview mode — row spacing + font size hierarchy + ingredient clarity

**Files:** `frontend/src/app/menu-sketch/[id]/page.tsx` — `DishPreviewCell`

**Row spacing** — change outer container from `space-y-0.5` to `space-y-2` for clear separation between dish name, ingredients, and description rows.

**Font hierarchy** — dish name `<p>` (~line 102): add `text-base` so it's visually larger than the `text-sm` ingredients/description beneath it.

**Ingredient chips** — render each ingredient as a separate inline chip instead of a comma-joined string:
```tsx
// Containing element changes from <p> to <div>
<div className="text-sm text-muted-foreground leading-relaxed">
  <span className="font-semibold">Ingredients:</span>{' '}
  {dish.ingredients.length > 0
    ? (
      <span className="flex flex-wrap gap-1 mt-0.5">
        {dish.ingredients.map((ing, i) => (
          <span key={i} className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs">
            {ing}
          </span>
        ))}
      </span>
    )
    : '—'}
</div>
```

---

### 6. Fix `updated_at` timezone (frontend only)

**Problem:** The backend serialises naive datetimes without a `Z` suffix (e.g. `2026-03-27T01:33:31`). Browsers parse naive ISO strings as **local time**, so `formatDistanceToNow` shows the wrong relative time.

**`frontend/src/app/menu-sketch/page.tsx` — defensive parse:**
```tsx
const updatedAt = new Date(
  sketch.updated_at.endsWith('Z') || sketch.updated_at.includes('+')
    ? sketch.updated_at
    : sketch.updated_at + 'Z'
);
// formatDistanceToNow(updatedAt, { addSuffix: true })
```
This guards against rows stored without a timezone offset by appending `Z` when absent.

---

### 7. Delete menu sketch

**Problem:** No way to delete a sketch from the list page.

**Backend — `backend/app/domain/menu_sketch_service.py`:**
```python
def delete_sketch(self, sketch_id: int) -> bool:
    sketch = self.session.get(MenuSketch, sketch_id)
    if sketch is None:
        return False
    self.session.delete(sketch)
    self.session.commit()
    return True
```

**Backend — `backend/app/api/menu_sketches.py`:**
```python
@router.delete("/{sketch_id}", status_code=204)
def delete_menu_sketch(sketch_id: int, session: Session = Depends(get_session)) -> None:
    deleted = MenuSketchService(session).delete_sketch(sketch_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sketch not found")
```

**Frontend — `frontend/src/lib/api.ts`:**
```ts
export async function deleteMenuSketch(id: number): Promise<void> {
  return fetchApi<void>(`/menu-sketches/${id}`, { method: 'DELETE' });
}
```

**Frontend — `frontend/src/lib/hooks/useMenuSketches.ts`:**
```ts
export function useDeleteMenuSketch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteMenuSketch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SKETCHES_KEY] });
      toast.success('Sketch deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete sketch');
    },
  });
}
```

**Frontend — `frontend/src/app/menu-sketch/page.tsx`:**
- Add `Trash2` delete button inline next to the version badge (always visible, no hover required)
- Remove `GitFork` icon from version badge (text-only: `v{n}`)
- On click, open `ConfirmModal` with destructive variant
- On confirm, call `deleteSketch.mutate(id)` for hard delete

---

### 8. List page width fix

**Files:** `frontend/src/app/menu-sketch/page.tsx`

Change container from `mx-auto max-w-5xl px-4 py-10` to `p-6 max-w-7xl mx-auto` to match the pattern used by other list pages (ingredients, tastings, suppliers, etc.).

---

## Critical Files

| File | Changes |
|------|---------|
| `frontend/src/app/menu-sketch/[id]/page.tsx` | All edit/preview UI changes (1–5) |
| `frontend/src/app/menu-sketch/page.tsx` | Defensive `updated_at` parse (6), delete button + width fix (7, 8) |
| `frontend/src/lib/api.ts` | `deleteMenuSketch` function (7) |
| `frontend/src/lib/hooks/useMenuSketches.ts` | `useDeleteMenuSketch` hook (7) |
| `backend/app/domain/menu_sketch_service.py` | `delete_sketch` method (7) |
| `backend/app/api/menu_sketches.py` | `DELETE /{sketch_id}` endpoint (7) |

---

## Verification

1. `/menu-sketch` list — verify "updated X ago" timestamps are correct after saving a sketch
2. `/menu-sketch` list — delete button visible next to version badge; clicking shows confirm modal; confirming hard-deletes the sketch
3. Editor (list view) — add/edit a dish, confirm a cost `%` column appears next to Cost, read-only
4. Editor (card view) — same % check in the card layout
5. Enter a description on a dish, save, reload — description textarea is pre-expanded with full content on open
6. Add an unresolved comment — orange badge in both edit and preview modes
7. Resolve all comments — badge reverts to neutral in both modes; badge still visible in preview (not hidden)
8. Preview — dish names visually larger than ingredients/description text, with clear row spacing
9. Preview — ingredients render as individual chips, not comma-separated text
