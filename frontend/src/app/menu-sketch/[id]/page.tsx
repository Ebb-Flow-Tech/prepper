'use client';

import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  useMenuSketch,
  useUpdateMenuSketch,
  useForkMenuSketch,
  useRecipes,
  useMenuSketchSections,
  useCreateMenuSketchSection,
  useUpdateMenuSketchSection,
  useDeleteMenuSketchSection,
  useMenuSketchSectionItems,
  useCreateMenuSketchSectionItem,
  useUpdateMenuSketchSectionItem,
  useDeleteMenuSketchSectionItem,
  useMenuSketchComments,
  useRecipeIngredients,
  useAddRecipeIngredient,
  useRemoveRecipeIngredient,
  useCreateIngredient,
} from '@/lib/hooks';
import * as api from '@/lib/api';
import type { Recipe, Ingredient } from '@/types';
import type {
  MenuSketchSection,
  MenuSketchSectionItem,
  MenuSketchSectionItemComment,
} from '@/types';
import {
  GitFork,
  X,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  ArrowLeft,
  GripVertical,
  Eye,
  Pencil,
  MessageSquare,
  SlidersHorizontal,
  Check,
  Plus,
  FlaskConical,
  SendHorizontal,
} from 'lucide-react';
import { CommentsPanel } from './CommentsPanel';
import { DishCommentsModal } from './DishCommentsModal';
import { DishFeedbackModal } from './DishFeedbackModal';
import dynamic from 'next/dynamic';
const NotesEditor = dynamic(() => import('./NotesEditor').then((m) => m.NotesEditor), { ssr: false });
import { ConfirmModal } from '@/components/ui';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

const ICON_DEFS = [
  { key: '⭐', label: 'Signature' },
  { key: '🌶️', label: 'Spicy' },
  { key: '🌿', label: 'Vegetarian' },
  { key: '🐟', label: 'Seafood' },
  { key: '🥩', label: 'Beef' },
  { key: '🐷', label: 'Pork' },
  { key: '🥜', label: 'Nuts' },
];

interface DisplayOptions {
  description: boolean;
  ingredients: boolean;
  cost: boolean;
  costMargins: boolean;
  comments: boolean;
  feedback: boolean;
}

// ─── Preview components ────────────────────────────────────────────────────────
function DishPreviewCell({
  item,
  comments,
  onOpenComments,
  display,
}: {
  item: MenuSketchSectionItem;
  comments: MenuSketchSectionItemComment[];
  onOpenComments?: () => void;
  display: DisplayOptions;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const commentCount = comments.filter((c) => !c.resolved).length;
  const costPct =
    item.sales_price && item.cost_price && Number(item.sales_price) > 0
      ? ((Number(item.cost_price) / Number(item.sales_price)) * 100).toFixed(2) + '%'
      : '—';
  const { data: recipeIngredients = [] } = useRecipeIngredients(
    display.ingredients ? item.recipe_id : null
  );

  return (
    <div className={`relative px-4 py-3 space-y-2${item.is_highlight ? ' bg-[var(--surface-selected)]' : ''}`}>
      {/* Dish name + icons + prices + badges on one row */}
      <div className="flex items-center gap-2">
        <p className="flex-1 text-base font-medium text-foreground leading-snug">
          {item.recipe_name || '—'}
        </p>
        {(item.icons ?? []).length > 0 && (
          <div className="flex shrink-0 gap-0.5">
            {(item.icons ?? []).map((ic) => (
              <span key={ic} className="text-sm leading-none">{ic}</span>
            ))}
          </div>
        )}
        <div className="flex shrink-0 gap-3 text-right text-xs tabular-nums items-center">
          <span className="text-foreground w-14 text-right">
            {item.sales_price != null ? `$${Number(item.sales_price).toFixed(2)}` : '—'}
          </span>
          {display.cost && (
            <span className="text-muted-foreground w-14 text-right">
              {item.cost_price != null ? `$${Number(item.cost_price).toFixed(2)}` : '—'}
            </span>
          )}
          {display.costMargins && (
            <span className="text-muted-foreground/70 w-12 font-medium text-right">{costPct}</span>
          )}
        </div>
      </div>

      {/* Description + actions row — always rendered; feedback/comment buttons always present */}
      <div className="flex items-start gap-2">
        {display.description && item.description?.trim() ? (
          <p className="flex-1 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex items-center gap-1 shrink-0">
          {display.feedback && (
            <button
              type="button"
              onClick={() => setShowFeedback((v) => !v)}
              className={`shrink-0 flex items-center gap-0.5 rounded-full border px-1.5 text-[10px] transition-colors hover:opacity-80 ${
                showFeedback
                  ? 'border-[var(--color-feedback-info)] bg-[var(--color-feedback-info-tint)] text-[var(--color-feedback-info)]'
                  : item.tasting_notes.length > 0
                  ? 'border-border bg-[var(--color-feedback-info-tint)] text-[var(--color-feedback-info)]'
                  : 'border-border bg-muted/60 text-muted-foreground'
              }`}
              title="Tasting feedback"
            >
              <FlaskConical className="h-2.5 w-2.5" />
              {item.tasting_notes.length}
            </button>
          )}
          {display.comments && (
            <button
              type="button"
              onClick={onOpenComments}
              className={`shrink-0 flex items-center gap-0.5 rounded-full border px-1.5 text-[10px] transition-colors hover:opacity-80 ${
                commentCount > 0
                  ? 'border-[var(--color-feedback-warning)] bg-[var(--color-feedback-warning-tint)] text-[var(--color-feedback-warning)]'
                  : 'border-border bg-muted/60 text-muted-foreground'
              }`}
            >
              <MessageSquare className="h-2.5 w-2.5" />
              {commentCount}
            </button>
          )}
        </div>
      </div>

      {/* Ingredient chips */}
      {display.ingredients && recipeIngredients.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipeIngredients.map((ri) => (
            <span
              key={ri.id}
              className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {ri.ingredient?.name ?? `Ingredient #${ri.ingredient_id}`}
            </span>
          ))}
        </div>
      )}

      {showFeedback && (
        <DishFeedbackModal
          dishName={item.recipe_name ?? ''}
          notes={item.tasting_notes}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

function MenuSketchPreview({
  name,
  sections,
  itemsBySection,
  commentsByItemId,
  onOpenComments,
  display,
}: {
  name: string;
  sections: MenuSketchSection[];
  itemsBySection: Record<number, MenuSketchSectionItem[]>;
  commentsByItemId: Record<number, MenuSketchSectionItemComment[]>;
  onOpenComments: (itemId: number, dishName: string) => void;
  display: DisplayOptions;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8 text-sm">
      {name && (
        <h1 className="text-center text-2xl font-medium tracking-[-0.015em] text-foreground">
          {name}
        </h1>
      )}
      {sections.map((section) => {
        const items = itemsBySection[section.id] ?? [];
        const pairs = chunk(items, 2);
        return (
          <div key={section.id} className="rounded-xl overflow-hidden border border-border shadow-elevation-1">
            {/* Section header */}
            <div className="text-center font-medium text-sm py-2.5 px-4 bg-muted text-foreground">
              {section.name || 'Unnamed section'}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border bg-muted/30">
              {[0, 1].map((col) => (
                <div key={col} className="flex items-center gap-2 px-4 py-1.5">
                  <span className="flex-1" />
                  <div className="flex shrink-0 gap-3 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                    <span className="w-14 text-right">Price</span>
                    {display.cost && <span className="w-14 text-right">Cost</span>}
                    {display.costMargins && <span className="w-12 text-right">%</span>}
                  </div>
                </div>
              ))}
            </div>

            {pairs.length === 0 && (
              <div className="px-4 py-4 text-muted-foreground italic text-xs text-center">No dishes</div>
            )}

            {pairs.map(([d1, d2], pi) => (
              <div
                key={pi}
                className={`grid grid-cols-2 divide-x divide-border ${pi > 0 ? 'border-t border-border' : ''}`}
              >
                <DishPreviewCell
                  item={d1}
                  comments={commentsByItemId[d1.id] ?? []}
                  onOpenComments={() => onOpenComments(d1.id, d1.recipe_name ?? '')}
                  display={display}
                />
                {d2 ? (
                  <DishPreviewCell
                    item={d2}
                    comments={commentsByItemId[d2.id] ?? []}
                    onOpenComments={() => onOpenComments(d2.id, d2.recipe_name ?? '')}
                    display={display}
                  />
                ) : (
                  <div className="px-4 py-3" />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── DishCard ─────────────────────────────────────────────────────────────────
function DishCard({
  item,
  unresolvedCount,
  onOpenComments,
  recipes,
  dragHandleProps,
  isSelected,
  onToggle,
}: {
  item: MenuSketchSectionItem;
  unresolvedCount: number;
  onOpenComments: () => void;
  recipes: Recipe[];
  dragHandleProps?: Record<string, unknown>;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const updateItem = useUpdateMenuSketchSectionItem();
  const deleteItem = useDeleteMenuSketchSectionItem();
  const addIngredient = useAddRecipeIngredient();
  const removeIngredient = useRemoveRecipeIngredient();
  const createIngredient = useCreateIngredient();
  const { data: recipeIngredients = [] } = useRecipeIngredients(item.recipe_id);
  const [showIcons, setShowIcons] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.recipe_name ?? '');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [showIngredientSuggestions, setShowIngredientSuggestions] = useState(false);
  const [ingPageSize, setIngPageSize] = useState(8);
  const [selectedIngIndex, setSelectedIngIndex] = useState(-1);

  const linkedIngredientIds = new Set(recipeIngredients.map((ri) => ri.ingredient_id));
  const ingSearchTerm = ingredientSearch.trim();
  const { data: ingSearchData } = useQuery({
    queryKey: ['ingredients-search', ingSearchTerm, ingPageSize],
    queryFn: () => api.getIngredients({ search: ingSearchTerm, page_size: ingPageSize, active_only: true }),
    enabled: !!ingSearchTerm,
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  });
  const suggestedIngredients = (ingSearchData?.items ?? []).filter(
    (ing) => !linkedIngredientIds.has(ing.id)
  );
  const hasMoreIngredients = ingSearchData
    ? ingSearchData.total_count > ingPageSize
    : false;

  const doAddIngredient = (recipeId: number, ing: Ingredient) => {
    addIngredient.mutate({
      recipeId,
      data: {
        ingredient_id: ing.id,
        quantity: 1,
        unit: ing.base_unit,
        base_unit: ing.base_unit,
        unit_price: ing.cost_per_base_unit ?? 0,
        supplier_id: null,
      },
    });
    setIngredientSearch('');
    setIngPageSize(8);
    setSelectedIngIndex(-1);
    setShowIngredientSuggestions(false);
  };

  const handleAddIngredient = (ing: Ingredient) => {
    if (!item.recipe_id) return;
    if (item.tasting_notes.length > 0 && item.recipe_name) {
      updateItem.mutate(
        { id: item.id, data: { name: item.recipe_name }, prevRecipeId: item.recipe_id },
        { onSuccess: (updated) => { if (updated.recipe_id) doAddIngredient(updated.recipe_id, ing); } }
      );
    } else {
      doAddIngredient(item.recipe_id, ing);
    }
  };

  const handleCreateAndAddIngredient = (name: string) => {
    if (!item.recipe_id) return;
    const doCreate = (recipeId: number) => {
      createIngredient.mutate(
        { name, base_unit: 'unit' },
        {
          onSuccess: (newIng) => {
            addIngredient.mutate({
              recipeId,
              data: {
                ingredient_id: newIng.id,
                quantity: 1,
                unit: newIng.base_unit,
                base_unit: newIng.base_unit,
                unit_price: 0,
                supplier_id: null,
              },
            });
          },
        }
      );
      setIngredientSearch('');
      setIngPageSize(8);
      setShowIngredientSuggestions(false);
    };
    if (item.tasting_notes.length > 0 && item.recipe_name) {
      updateItem.mutate(
        { id: item.id, data: { name: item.recipe_name }, prevRecipeId: item.recipe_id },
        { onSuccess: (updated) => { if (updated.recipe_id) doCreate(updated.recipe_id); } }
      );
    } else {
      doCreate(item.recipe_id);
    }
  };

  const filtered = nameDraft.trim()
    ? recipes.filter(
        (r) =>
          r.name.toLowerCase().includes(nameDraft.toLowerCase()) &&
          r.name.toLowerCase() !== (item.recipe_name ?? '').toLowerCase()
      )
    : [];

  const save = (data: Parameters<typeof updateItem.mutate>[0]['data']) => {
    updateItem.mutate({ id: item.id, data, prevRecipeId: item.recipe_id });
  };

  const costPct =
    item.sales_price && item.cost_price && Number(item.sales_price) > 0
      ? Math.round((Number(item.cost_price) / Number(item.sales_price)) * 100)
      : null;

  return (
    <div
      className={`relative rounded-lg border border-border p-3 space-y-2 ${
        item.is_highlight ? 'bg-[var(--surface-selected)]' : 'bg-card'
      }`}
    >
      {/* Drag handle + remove */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="h-3 w-3 rounded accent-primary"
          />
          <span
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...(dragHandleProps ?? {})}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          title="Remove dish"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Dish name (searches & links existing recipes; creates new recipe on blur) */}
      <div className="relative">
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => {
            setNameDraft(e.target.value);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            setShowSuggestions(false);
            if (nameDraft.trim() !== (item.recipe_name ?? '')) save({ name: nameDraft.trim() });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setNameDraft(item.recipe_name ?? '');
              setShowSuggestions(false);
            }
          }}
          placeholder="Dish name…"
          className="w-full rounded border border-border bg-muted px-2 py-1 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-0.5 w-full rounded-xl border border-border bg-card shadow-elevation-2">
            {filtered.slice(0, 5).map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={() => {
                  setNameDraft(r.name);
                  setShowSuggestions(false);
                  save({ name: r.name, recipe_id: r.id });
                }}
                className="w-full px-2 py-1 text-left text-xs hover:bg-muted"
              >
                {r.name}
              </button>
            ))}
            {filtered.length > 5 && (
              <p className="px-2 py-1 text-[10px] text-muted-foreground">+{filtered.length - 5} more</p>
            )}
          </div>
        )}
      </div>

      {/* Ingredients */}
      {(recipeIngredients.length > 0 || item.recipe_id) && (
        <div className="space-y-1">
          {recipeIngredients.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipeIngredients.map((ri) => (
                <span
                  key={ri.id}
                  className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {ri.ingredient?.name ?? `Ingredient #${ri.ingredient_id}`}
                  <button
                    type="button"
                    onClick={() =>
                      removeIngredient.mutate({ recipeId: item.recipe_id!, ingredientId: ri.id })
                    }
                    className="ml-0.5 rounded-full text-muted-foreground hover:text-destructive"
                    title="Remove ingredient"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {item.recipe_id && (
            <div className="relative">
              <input
                type="text"
                value={ingredientSearch}
                onChange={(e) => { setIngredientSearch(e.target.value); setIngPageSize(8); setSelectedIngIndex(-1); setShowIngredientSuggestions(true); }}
                onFocus={() => setShowIngredientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowIngredientSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIngIndex((i) => Math.min(i + 1, suggestedIngredients.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIngIndex((i) => Math.max(i - 1, -1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIngIndex >= 0 && selectedIngIndex < suggestedIngredients.length) {
                      handleAddIngredient(suggestedIngredients[selectedIngIndex]);
                    } else if (suggestedIngredients.length > 0) {
                      handleAddIngredient(suggestedIngredients[0]);
                    } else if (ingSearchTerm) {
                      handleCreateAndAddIngredient(ingSearchTerm);
                    }
                  }
                }}
                placeholder="Add ingredient…"
                className="w-full rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {showIngredientSuggestions && (suggestedIngredients.length > 0 || ingSearchTerm) && (
                <div className="absolute left-0 top-full z-50 mt-0.5 max-h-40 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-elevation-2">
                  {suggestedIngredients.map((ing, idx) => (
                    <button
                      key={ing.id}
                      type="button"
                      onMouseDown={() => handleAddIngredient(ing)}
                      className={`w-full px-2 py-1 text-left text-[10px] hover:bg-muted${idx === selectedIngIndex ? ' bg-muted' : ''}`}
                    >
                      {ing.name}
                    </button>
                  ))}
                  {hasMoreIngredients && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setIngPageSize((p) => p + 8); }}
                      className="w-full px-2 py-1 text-left text-[10px] text-muted-foreground hover:bg-muted"
                    >
                      Load more…
                    </button>
                  )}
                  {ingSearchTerm && (
                    <button
                      type="button"
                      onMouseDown={() => handleCreateAndAddIngredient(ingSearchTerm)}
                      className="w-full px-2 py-1 text-left text-[10px] text-primary hover:bg-muted"
                    >
                      + Create &ldquo;{ingSearchTerm}&rdquo;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prices */}
      <div className="grid grid-cols-3 gap-1 text-xs">
        <div>
          <span className="text-muted-foreground">Sale</span>
          <input
            type="text"
            inputMode="decimal"
            defaultValue={item.sales_price ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : parseFloat(e.target.value);
              if (val !== null && !isNaN(val)) e.target.value = String(val);
              if (val !== item.sales_price) save({ sales_price: val });
            }}
            placeholder="0.00"
            className="mt-0.5 w-full rounded border border-border bg-muted px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <span className="text-muted-foreground">Cost</span>
          <input
            type="text"
            inputMode="decimal"
            defaultValue={item.cost_price ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : parseFloat(e.target.value);
              if (val !== null && !isNaN(val)) e.target.value = String(val);
              if (val !== item.cost_price) save({ cost_price: val });
            }}
            placeholder="0.00"
            className="mt-0.5 w-full rounded border border-border bg-muted px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <span className="text-muted-foreground">%</span>
          <div className="mt-0.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            {costPct != null ? `${costPct}%` : '—'}
          </div>
        </div>
      </div>

      {/* Description */}
      <textarea
        rows={1}
        defaultValue={item.description ?? ''}
        onFocus={(e) => autoResize(e.currentTarget)}
        onChange={(e) => autoResize(e.currentTarget)}
        onBlur={(e) => {
          const val = e.target.value.trim() || null;
          if (val !== item.description) save({ description: val });
        }}
        placeholder="Description…"
        className="w-full resize-none rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Footer actions */}
      <div className="flex items-center gap-1.5">
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={item.is_highlight}
            onChange={(e) => save({ is_highlight: e.target.checked })}
            className="h-3 w-3 rounded accent-amber-500"
          />
          Highlight
        </label>
        <button
          onClick={() => setShowIcons((v) => !v)}
          className="ml-auto rounded p-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Tags
        </button>
        <button
          onClick={() => setShowFeedback(true)}
          className={`flex items-center gap-0.5 rounded p-0.5 text-xs hover:opacity-80 ${
            item.tasting_notes.length > 0 ? 'text-[var(--color-feedback-info)]' : 'text-muted-foreground'
          }`}
          title="Tasting feedback"
        >
          <FlaskConical className="h-3 w-3" />
          {item.tasting_notes.length > 0 && <span>{item.tasting_notes.length}</span>}
        </button>
        <button
          onClick={onOpenComments}
          className={`flex items-center gap-0.5 rounded p-0.5 text-xs ${
            unresolvedCount > 0 ? 'text-[var(--color-feedback-warning)]' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Comments"
        >
          <MessageSquare className="h-3 w-3" />
          {unresolvedCount > 0 && <span>{unresolvedCount}</span>}
        </button>
      </div>

      {showFeedback && (
        <DishFeedbackModal
          dishName={item.recipe_name ?? ''}
          notes={item.tasting_notes}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showIcons && (
        <div className="flex flex-wrap gap-1">
          {ICON_DEFS.map(({ key, label }) => {
            const active = (item.icons ?? []).includes(key);
            return (
              <button
                key={key}
                title={label}
                onClick={() => {
                  const icons = active
                    ? (item.icons ?? []).filter((i) => i !== key)
                    : [...(item.icons ?? []), key];
                  save({ icons });
                }}
                className={`rounded px-1.5 py-0.5 text-xs ${
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { deleteItem.mutate(item.id); setConfirmDelete(false); }}
        title="Remove dish"
        message={`Remove "${item.recipe_name || 'this dish'}" from the menu?`}
        confirmLabel="Remove"
        variant="destructive"
      />
    </div>
  );
}

// ─── SortableDishCard ─────────────────────────────────────────────────────────
function SortableDishCard(props: Omit<React.ComponentProps<typeof DishCard>, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <DishCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── DishRow ─────────────────────────────────────────────────────────────────
function DishRow({
  item,
  unresolvedCount,
  onOpenComments,
  recipes,
  dragHandleProps,
  isSelected,
  onToggle,
}: {
  item: MenuSketchSectionItem;
  unresolvedCount: number;
  onOpenComments: () => void;
  recipes: Recipe[];
  dragHandleProps?: Record<string, unknown>;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const updateItem = useUpdateMenuSketchSectionItem();
  const deleteItem = useDeleteMenuSketchSectionItem();
  const addIngredient = useAddRecipeIngredient();
  const removeIngredient = useRemoveRecipeIngredient();
  const createIngredient = useCreateIngredient();
  const { data: recipeIngredients = [] } = useRecipeIngredients(item.recipe_id);
  const [showIcons, setShowIcons] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.recipe_name ?? '');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [showIngredientSuggestions, setShowIngredientSuggestions] = useState(false);
  const [ingPageSize, setIngPageSize] = useState(8);
  const [selectedIngIndex, setSelectedIngIndex] = useState(-1);

  const linkedIngredientIds = new Set(recipeIngredients.map((ri) => ri.ingredient_id));
  const ingSearchTerm = ingredientSearch.trim();
  const { data: ingSearchData } = useQuery({
    queryKey: ['ingredients-search', ingSearchTerm, ingPageSize],
    queryFn: () => api.getIngredients({ search: ingSearchTerm, page_size: ingPageSize, active_only: true }),
    enabled: !!ingSearchTerm,
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  });
  const suggestedIngredients = (ingSearchData?.items ?? []).filter(
    (ing) => !linkedIngredientIds.has(ing.id)
  );
  const hasMoreIngredients = ingSearchData
    ? ingSearchData.total_count > ingPageSize
    : false;

  const doAddIngredient = (recipeId: number, ing: Ingredient) => {
    addIngredient.mutate({
      recipeId,
      data: {
        ingredient_id: ing.id,
        quantity: 1,
        unit: ing.base_unit,
        base_unit: ing.base_unit,
        unit_price: ing.cost_per_base_unit ?? 0,
        supplier_id: null,
      },
    });
    setIngredientSearch('');
    setIngPageSize(8);
    setSelectedIngIndex(-1);
    setShowIngredientSuggestions(false);
  };

  const handleAddIngredient = (ing: Ingredient) => {
    if (!item.recipe_id) return;
    if (item.tasting_notes.length > 0 && item.recipe_name) {
      updateItem.mutate(
        { id: item.id, data: { name: item.recipe_name }, prevRecipeId: item.recipe_id },
        { onSuccess: (updated) => { if (updated.recipe_id) doAddIngredient(updated.recipe_id, ing); } }
      );
    } else {
      doAddIngredient(item.recipe_id, ing);
    }
  };

  const handleCreateAndAddIngredient = (name: string) => {
    if (!item.recipe_id) return;
    const doCreate = (recipeId: number) => {
      createIngredient.mutate(
        { name, base_unit: 'unit' },
        {
          onSuccess: (newIng) => {
            addIngredient.mutate({
              recipeId,
              data: {
                ingredient_id: newIng.id,
                quantity: 1,
                unit: newIng.base_unit,
                base_unit: newIng.base_unit,
                unit_price: 0,
                supplier_id: null,
              },
            });
          },
        }
      );
      setIngredientSearch('');
      setIngPageSize(8);
      setShowIngredientSuggestions(false);
    };
    if (item.tasting_notes.length > 0 && item.recipe_name) {
      updateItem.mutate(
        { id: item.id, data: { name: item.recipe_name }, prevRecipeId: item.recipe_id },
        { onSuccess: (updated) => { if (updated.recipe_id) doCreate(updated.recipe_id); } }
      );
    } else {
      doCreate(item.recipe_id);
    }
  };

  const filtered = nameDraft.trim()
    ? recipes.filter(
        (r) =>
          r.name.toLowerCase().includes(nameDraft.toLowerCase()) &&
          r.name.toLowerCase() !== (item.recipe_name ?? '').toLowerCase()
      )
    : [];

  const save = (data: Parameters<typeof updateItem.mutate>[0]['data']) => {
    updateItem.mutate({ id: item.id, data, prevRecipeId: item.recipe_id });
  };

  const costPct =
    item.sales_price && item.cost_price && Number(item.sales_price) > 0
      ? Math.round((Number(item.cost_price) / Number(item.sales_price)) * 100)
      : null;

  return (
    <div
      className={`rounded-lg border ${
        isSelected ? 'border-primary/50' : 'border-border'
      } ${item.is_highlight ? 'bg-[var(--surface-selected)]' : 'bg-card'}`}
    >
      {/* Main row — table-like with column dividers */}
      <div
        className="grid items-stretch text-sm"
        style={{ gridTemplateColumns: '44px 1fr 2fr 88px 72px 52px' }}
      >
        {/* Grip + select */}
        <div className="flex items-center justify-center gap-1 border-r border-border py-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="h-3 w-3 rounded accent-primary"
          />
          <span
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...(dragHandleProps ?? {})}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Dish name */}
        <div className="relative min-w-0 border-r border-border px-3 py-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => { setNameDraft(e.target.value); setShowSuggestions(true); }}
            onBlur={() => {
              setShowSuggestions(false);
              if (nameDraft.trim() !== (item.recipe_name ?? '')) save({ name: nameDraft.trim() });
            }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setNameDraft(item.recipe_name ?? ''); setShowSuggestions(false); } }}
            placeholder="Dish name…"
            className="w-full bg-transparent font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-0.5 w-56 rounded-xl border border-border bg-card shadow-elevation-2">
              {filtered.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={() => {
                    setNameDraft(r.name);
                    setShowSuggestions(false);
                    save({ name: r.name, recipe_id: r.id });
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-muted"
                >
                  {r.name}
                </button>
              ))}
              {filtered.length > 5 && (
                <p className="px-2 py-1 text-[10px] text-muted-foreground">+{filtered.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Key Ingredients — ingredient search input beside dish name */}
        <div className="relative border-r border-border px-3 py-2">
          {item.recipe_id ? (
            <>
              <input
                type="text"
                value={ingredientSearch}
                onChange={(e) => { setIngredientSearch(e.target.value); setIngPageSize(8); setSelectedIngIndex(-1); setShowIngredientSuggestions(true); }}
                onFocus={() => setShowIngredientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowIngredientSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIngIndex((i) => Math.min(i + 1, suggestedIngredients.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIngIndex((i) => Math.max(i - 1, -1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIngIndex >= 0 && selectedIngIndex < suggestedIngredients.length) {
                      handleAddIngredient(suggestedIngredients[selectedIngIndex]);
                    } else if (suggestedIngredients.length > 0) {
                      handleAddIngredient(suggestedIngredients[0]);
                    } else if (ingSearchTerm) {
                      handleCreateAndAddIngredient(ingSearchTerm);
                    }
                  }
                }}
                placeholder="Add ingredient…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {showIngredientSuggestions && (suggestedIngredients.length > 0 || ingSearchTerm) && (
                <div className="absolute left-0 top-full z-50 mt-0.5 max-h-40 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-elevation-2">
                  {suggestedIngredients.map((ing, idx) => (
                    <button
                      key={ing.id}
                      type="button"
                      onMouseDown={() => handleAddIngredient(ing)}
                      className={`w-full px-2 py-1.5 text-left text-xs hover:bg-muted${idx === selectedIngIndex ? ' bg-muted' : ''}`}
                    >
                      {ing.name}
                    </button>
                  ))}
                  {hasMoreIngredients && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setIngPageSize((p) => p + 8); }}
                      className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                    >
                      Load more…
                    </button>
                  )}
                  {ingSearchTerm && (
                    <button
                      type="button"
                      onMouseDown={() => handleCreateAndAddIngredient(ingSearchTerm)}
                      className="w-full px-2 py-1.5 text-left text-xs text-primary hover:bg-muted"
                    >
                      + Create &ldquo;{ingSearchTerm}&rdquo;
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground/40">—</span>
          )}
        </div>

        {/* Sale price */}
        <div className="border-r border-border px-2 py-2">
          <input
            type="text"
            inputMode="decimal"
            defaultValue={item.sales_price ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : parseFloat(e.target.value);
              if (val !== null && !isNaN(val)) e.target.value = String(val);
              if (val !== item.sales_price) save({ sales_price: val });
            }}
            placeholder="Sale"
            className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/60 focus:text-foreground focus:outline-none"
          />
        </div>

        {/* Cost price */}
        <div className="border-r border-border px-2 py-2">
          <input
            type="text"
            inputMode="decimal"
            defaultValue={item.cost_price ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : parseFloat(e.target.value);
              if (val !== null && !isNaN(val)) e.target.value = String(val);
              if (val !== item.cost_price) save({ cost_price: val });
            }}
            placeholder="Cost"
            className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/60 focus:text-foreground focus:outline-none"
          />
        </div>

        {/* Cost % */}
        <div className="flex items-center justify-center px-2 py-2 text-sm text-muted-foreground">
          {costPct != null ? `${costPct}%` : '—'}
        </div>
      </div>

      {/* Ingredient badges — always visible, not inside collapsible */}
      {recipeIngredients.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {recipeIngredients.map((ri) => (
              <span
                key={ri.id}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {ri.ingredient?.name ?? `Ingredient #${ri.ingredient_id}`}
                <button
                  type="button"
                  onClick={() =>
                    removeIngredient.mutate({ recipeId: item.recipe_id!, ingredientId: ri.id })
                  }
                  className="ml-0.5 rounded-full text-muted-foreground hover:text-destructive"
                  title="Remove ingredient"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description — always visible */}
      <div className="border-t border-border px-3 py-2">
        <textarea
          rows={1}
          defaultValue={item.description ?? ''}
          onFocus={(e) => autoResize(e.currentTarget)}
          onChange={(e) => autoResize(e.currentTarget)}
          onBlur={(e) => {
            const val = e.target.value.trim() || null;
            if (val !== item.description) save({ description: val });
          }}
          // placeholder="Description (optional)"
          // className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"

          placeholder="Description (optional)"
          className="w-full resize-none overflow-hidden rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Highlight — always visible */}
      <div className="border-t border-border px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={item.is_highlight}
            onChange={(e) => save({ is_highlight: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-amber-500"
          />
          ⭐ Highlight dish
        </label>
      </div>

      {/* Tags collapsible */}
      <div className="border-t border-border">
        {/* Comment + feedback icon row */}
        <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-1.5">
          <button
            onClick={() => setShowFeedback(true)}
            className={`flex items-center gap-1 rounded p-0.5 text-xs hover:opacity-80 ${
              item.tasting_notes.length > 0 ? 'text-[var(--color-feedback-info)]' : 'text-muted-foreground'
            }`}
            title="Tasting feedback"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {item.tasting_notes.length > 0 && <span>{item.tasting_notes.length}</span>}
          </button>
          <button
            onClick={onOpenComments}
            className={`flex items-center gap-1 rounded p-0.5 text-xs ${
              unresolvedCount > 0 ? 'text-[var(--color-feedback-warning)]' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Comments"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {unresolvedCount > 0 && <span>{unresolvedCount}</span>}
          </button>
        </div>

        {/* Tags + Remove */}
        <div className="px-3 py-2.5 space-y-2">
          <button
            onClick={() => setShowIcons((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showIcons ? 'rotate-180' : ''}`} />
            Tags{(item.icons ?? []).length > 0 ? ` (${item.icons!.length})` : ''}
          </button>
          {showIcons && (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
              {ICON_DEFS.map(({ key, label }) => {
                const active = (item.icons ?? []).includes(key);
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        const icons = active
                          ? (item.icons ?? []).filter((i) => i !== key)
                          : [...(item.icons ?? []), key];
                        save({ icons });
                      }}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    {key} {label}
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex justify-end pt-0.5">
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Remove dish
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { deleteItem.mutate(item.id); setConfirmDelete(false); }}
        title="Remove dish"
        message={`Remove "${item.recipe_name || 'this dish'}" from the menu?`}
        confirmLabel="Remove"
        variant="destructive"
      />

      {showFeedback && (
        <DishFeedbackModal
          dishName={item.recipe_name ?? ''}
          notes={item.tasting_notes}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

// ─── SortableDishRow ──────────────────────────────────────────────────────────
function SortableDishRow(props: Omit<React.ComponentProps<typeof DishRow>, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <DishRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({
  section,
  commentsByItemId,
  onOpenComments,
  viewMode,
  recipes,
  dragHandleProps,
  selectedItemIds,
  onToggleItem,
}: {
  section: MenuSketchSection;
  commentsByItemId: Record<number, MenuSketchSectionItemComment[]>;
  onOpenComments: (itemId: number, dishName: string) => void;
  viewMode: 'list' | 'card';
  recipes: Recipe[];
  dragHandleProps?: Record<string, unknown>;
  selectedItemIds: Set<number>;
  onToggleItem: (itemId: number) => void;
}) {
  const { data: serverItems = [] } = useMenuSketchSectionItems(section.id);
  const updateSection = useUpdateMenuSketchSection();
  const deleteSection = useDeleteMenuSketchSection();
  const createItem = useCreateMenuSketchSectionItem();
  const updateItem = useUpdateMenuSketchSectionItem();

  const [collapsed, setCollapsed] = useState(false);
  const [sectionName, setSectionName] = useState(section.name);
  const [newDishName, setNewDishName] = useState('');
  const [showDishSuggestions, setShowDishSuggestions] = useState(false);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState(false);
  const [itemOrder, setItemOrder] = useState<number[]>([]);

  // Keep local order in sync with server data
  const prevItemsRef = useRef<MenuSketchSectionItem[]>([]);
  if (prevItemsRef.current !== serverItems) {
    const newIds = serverItems.map((i) => i.id);
    const added = newIds.filter((id) => !itemOrder.includes(id));
    const removed = itemOrder.filter((id) => !newIds.includes(id));
    if (added.length > 0 || removed.length > 0) {
      setItemOrder(newIds);
    }
    prevItemsRef.current = serverItems;
  }

  const orderedItems = itemOrder
    .map((id) => serverItems.find((i) => i.id === id))
    .filter((i): i is MenuSketchSectionItem => i != null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedItems.findIndex((i) => i.id === active.id);
    const newIndex = orderedItems.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(orderedItems, oldIndex, newIndex);
    setItemOrder(newOrder.map((i) => i.id));
    // Persist new order_no values
    newOrder.forEach((item, idx) => {
      if (item.order_no !== idx) {
        updateItem.mutate({ id: item.id, data: { order_no: idx }, prevRecipeId: item.recipe_id });
      }
    });
  };

  const dishSuggestions = newDishName.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(newDishName.toLowerCase()))
    : [];

  const addDish = (name: string, recipeId?: number) => {
    if (!name.trim()) return;
    createItem.mutate({
      menu_sketch_section_id: section.id,
      name: name.trim(),
      recipe_id: recipeId,
      order_no: orderedItems.length,
    });
    setNewDishName('');
    setShowDishSuggestions(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-elevation-1">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...(dragHandleProps ?? {})}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          onBlur={() => {
            if (sectionName.trim() !== section.name && sectionName.trim()) {
              updateSection.mutate({ id: section.id, data: { name: sectionName.trim() } });
            }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Section name…"
        />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setConfirmDeleteSection(true)}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          title="Delete section"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="p-2 space-y-1.5">
          {/* Column headers (list view) */}
          {viewMode === 'list' && orderedItems.length > 0 && (
            <div
              className="grid items-center text-[10px] font-medium text-muted-foreground"
              style={{ gridTemplateColumns: '44px 1fr 2fr 88px 72px 52px' }}
            >
              <span />
              <span className="px-3">Dish</span>
              <span className="px-3">Key ingredients</span>
              <span className="px-2">Sale</span>
              <span className="px-2">Cost</span>
              <span className="px-2 text-center">%</span>
            </div>
          )}

          {/* Items */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext items={orderedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {viewMode === 'card' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {orderedItems.map((item) => (
                    <SortableDishCard
                      key={item.id}
                      item={item}
                      unresolvedCount={(commentsByItemId[item.id] ?? []).filter((c) => !c.resolved).length}
                      onOpenComments={() => onOpenComments(item.id, item.recipe_name ?? '')}
                      recipes={recipes}
                      isSelected={selectedItemIds.has(item.id)}
                      onToggle={() => onToggleItem(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {orderedItems.map((item) => (
                    <SortableDishRow
                      key={item.id}
                      item={item}
                      unresolvedCount={(commentsByItemId[item.id] ?? []).filter((c) => !c.resolved).length}
                      onOpenComments={() => onOpenComments(item.id, item.recipe_name ?? '')}
                      recipes={recipes}
                      isSelected={selectedItemIds.has(item.id)}
                      onToggle={() => onToggleItem(item.id)}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>

          {/* Add dish input */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2">
              <input
                type="text"
                value={newDishName}
                onChange={(e) => { setNewDishName(e.target.value); setShowDishSuggestions(true); }}
                onFocus={() => setShowDishSuggestions(true)}
                onBlur={() => setTimeout(() => setShowDishSuggestions(false), 150)}
                onKeyDown={(e) => { if (e.key === 'Enter') addDish(newDishName); }}
                placeholder="Type a dish name or search recipes..."
                className="flex-1 bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:text-foreground"
              />
              <button
                onClick={() => addDish(newDishName)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
            {showDishSuggestions && dishSuggestions.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-0.5 w-full rounded-xl border border-border bg-card shadow-elevation-2">
                {newDishName.trim() && (
                  <button
                    type="button"
                    onMouseDown={() => addDish(newDishName)}
                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" /> Add as new dish: <span className="font-medium">&quot;{newDishName}&quot;</span>
                  </button>
                )}
                {dishSuggestions.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={() => addDish(r.name, r.id)}
                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteSection}
        onClose={() => setConfirmDeleteSection(false)}
        onConfirm={() => { deleteSection.mutate(section.id); setConfirmDeleteSection(false); }}
        title="Delete section"
        message={`Delete "${section.name || 'this section'}" and all its dishes?`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}

// ─── SortableSectionCard ──────────────────────────────────────────────────────
function SortableSectionCard(props: Omit<React.ComponentProps<typeof SectionCard>, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.section.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <SectionCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MenuSketchEditorPage() {
  const params = useParams();
  const router = useRouter();
  const sketchId = params.id ? parseInt(params.id as string, 10) : null;

  const { data: sketch } = useMenuSketch(sketchId);
  const { data: sections = [] } = useMenuSketchSections(sketchId);
  const { data: commentsData } = useMenuSketchComments(sketchId);
  const { data: recipesData } = useRecipes();
  const recipes = recipesData?.items ?? [];

  const updateSketch = useUpdateMenuSketch();
  const forkSketch = useForkMenuSketch();
  const createSection = useCreateMenuSketchSection();
  const updateSection = useUpdateMenuSketchSection();

  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionOrder, setSectionOrder] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [previewMode, setPreviewMode] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [activeDishComments, setActiveDishComments] = useState<{ itemId: number; dishName: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const handleToggleItem = (itemId: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleCreateTasting = () => {
    const allItems = Object.values(itemsBySection).flat();
    const recipeIds = [...selectedItems]
      .map((itemId) => allItems.find((i) => i.id === itemId)?.recipe_id)
      .filter((id): id is number => id != null);
    if (recipeIds.length === 0) return;
    router.push(`/tastings/new?recipe_ids=${recipeIds.join(',')}`);
  };

  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    description: true,
    ingredients: true,
    cost: true,
    costMargins: true,
    comments: true,
    feedback: true,
  });
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);

  // Sync name from server
  const prevSketchRef = useRef<typeof sketch>(undefined);
  if (sketch && sketch !== prevSketchRef.current) {
    setName(sketch.name);
    prevSketchRef.current = sketch;
  }

  // Sync section order
  const prevSectionsRef = useRef<MenuSketchSection[]>([]);
  if (prevSectionsRef.current !== sections) {
    const newIds = sections.map((s) => s.id);
    const added = newIds.filter((id) => !sectionOrder.includes(id));
    const removed = sectionOrder.filter((id) => !newIds.includes(id));
    if (added.length > 0 || removed.length > 0) {
      setSectionOrder(newIds);
    }
    prevSectionsRef.current = sections;
  }

  const orderedSections = sectionOrder
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is MenuSketchSection => s != null);

  // Build commentsByItemId from aggregated response
  const commentsByItemId: Record<number, MenuSketchSectionItemComment[]> = {};
  (commentsData?.data ?? []).forEach(({ menu_sketch_section_item_id, comments }) => {
    commentsByItemId[menu_sketch_section_item_id] = comments;
  });

  // For CommentsPanel: build itemsBySection from per-section queries
  const itemQueries = useQueries({
    queries: sections.map((section) => ({
      queryKey: ['menu-sketch-section-items', section.id],
      queryFn: () => api.getMenuSketchSectionItems(section.id),
      enabled: sections.length > 0,
    })),
  });
  const itemsBySection: Record<number, MenuSketchSectionItem[]> = {};
  sections.forEach((section, i) => {
    itemsBySection[section.id] = itemQueries[i]?.data ?? [];
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedSections.findIndex((s) => s.id === active.id);
    const newIndex = orderedSections.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(orderedSections, oldIndex, newIndex);
    setSectionOrder(newOrder.map((s) => s.id));
    newOrder.forEach((section, idx) => {
      if (section.order_no !== idx) {
        updateSection.mutate({ id: section.id, data: { order_no: idx } });
      }
    });
  };

  const handleAddSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    createSection.mutate({ menu_sketch_id: sketchId!, name, order_no: sections.length });
    setNewSectionName('');
  };

  const handleNameSave = () => {
    if (sketchId && name.trim() && name.trim() !== sketch?.name) {
      updateSketch.mutate({ id: sketchId, data: { name: name.trim() } });
    }
    setEditingName(false);
  };

  const handleNotesSave = (html: string) => {
    if (sketchId) updateSketch.mutate({ id: sketchId, data: { notes: html } });
  };

  if (!sketch) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2">
        <button
          onClick={() => router.push('/menu-sketch')}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Sketch name */}
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') { setName(sketch.name); setEditingName(false); } }}
            className="w-48 rounded border border-border bg-muted px-2 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            {name || 'Untitled'}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}

        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          v{sketch.version}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* View toggle (edit mode only) */}
          {!previewMode && (
            <div className="flex rounded-lg border border-border">
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-l-md p-1.5 ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`rounded-r-md p-1.5 ${viewMode === 'card' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Display options (preview mode only) */}
          {previewMode && (
            <div className="relative">
              <button
                onClick={() => setShowDisplayMenu((v) => !v)}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Display
              </button>
              {showDisplayMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-border bg-card p-2 shadow-elevation-2">
                  {(Object.keys(displayOptions) as (keyof DisplayOptions)[]).map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={displayOptions[key]}
                        onChange={(e) => setDisplayOptions((o) => ({ ...o, [key]: e.target.checked }))}
                        className="h-3 w-3 rounded accent-primary"
                      />
                      <span className="text-xs capitalize text-foreground">
                        {key === 'costMargins' ? 'Cost margins' : key === 'feedback' ? 'Feedback' : key}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview / Edit toggle */}
          <button
            onClick={() => setPreviewMode((v) => !v)}
            className={`flex items-center gap-1 rounded border border-border px-2 py-1 text-xs ${
              previewMode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {previewMode ? 'Edit' : 'Preview'}
          </button>

          {/* Comments panel toggle */}
          <button
            onClick={() => setShowComments((v) => !v)}
            className={`flex items-center gap-1 rounded border border-border px-2 py-1 text-xs ${
              showComments ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Comments panel"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>

          {/* Create Tasting Session (shown when dishes are selected) */}
          {selectedItems.size > 0 && !previewMode && (
            <button
              onClick={handleCreateTasting}
              className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              title={`Create tasting session with ${selectedItems.size} dish${selectedItems.size !== 1 ? 'es' : ''}`}
            >
              <FlaskConical className="h-3 w-3" />
              Tasting ({selectedItems.size})
            </button>
          )}

          {/* Fork */}
          <button
            onClick={() => sketchId && forkSketch.mutate(sketchId)}
            disabled={forkSketch.isPending}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Fork sketch"
          >
            <GitFork className="h-3.5 w-3.5" />
            Fork
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main area */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
            {previewMode ? (
              <MenuSketchPreview
                name={name}
                sections={orderedSections}
                itemsBySection={itemsBySection}
                commentsByItemId={commentsByItemId}
                onOpenComments={(itemId, dishName) => setActiveDishComments({ itemId, dishName })}
                display={displayOptions}
              />
            ) : (
              <div className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd}
                >
                  <SortableContext
                    items={orderedSections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedSections.map((section) => (
                      <SortableSectionCard
                        key={section.id}
                        section={section}
                        commentsByItemId={commentsByItemId}
                        onOpenComments={(itemId, dishName) =>
                          setActiveDishComments({ itemId, dishName })
                        }
                        viewMode={viewMode}
                        recipes={recipes}
                        selectedItemIds={selectedItems}
                        onToggleItem={handleToggleItem}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add section */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); }}
                    placeholder="New section name…"
                    className="flex-1 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:text-foreground"
                  />
                  <button
                    onClick={handleAddSection}
                    disabled={!newSectionName.trim() || createSection.isPending}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes panel */}
          <div className="shrink-0 border-t border-border bg-card">
            <button
              onClick={() => setNotesOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {notesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              Notes
              {sketch.notes && !notesOpen && (
                <Check className="ml-auto h-3 w-3 text-[var(--color-feedback-success)]" />
              )}
            </button>
            {notesOpen && (
              <div className="max-h-48 overflow-y-auto px-4 pb-3">
                <NotesEditor
                  initialContent={sketch.notes ?? ''}
                  onChange={() => {}}
                  onSave={handleNotesSave}
                />
              </div>
            )}
          </div>
        </div>

        {/* Comments panel */}
        {showComments && (
          <div className="hidden w-72 shrink-0 md:block">
            <CommentsPanel
              sections={orderedSections}
              itemsBySection={itemsBySection}
              commentsByItemId={commentsByItemId}
            />
          </div>
        )}
      </div>

      {/* Dish comments modal */}
      {activeDishComments && (
        <DishCommentsModal
          itemId={activeDishComments.itemId}
          dishName={activeDishComments.dishName}
          comments={commentsByItemId[activeDishComments.itemId] ?? []}
          onClose={() => setActiveDishComments(null)}
        />
      )}
    </div>
  );
}
