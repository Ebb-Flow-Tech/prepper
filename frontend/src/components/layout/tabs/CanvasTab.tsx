'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { GripVertical, X, ChevronDown, ChevronUp, ImagePlus, Minus, Plus, Grid3x3, List, Table2 } from 'lucide-react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppState, setCanvasSaveHandler } from '@/lib/store';
import {
  useRecipes,
  useRecipe,
  useIngredients,
  useCreateRecipe,
  useUpdateRecipe,
  useAddRecipeIngredient,
  useUpdateRecipeIngredient,
  useRemoveRecipeIngredient,
  useAddSubRecipe,
  useUpdateSubRecipe,
  useRemoveSubRecipe,
  useRecipeIngredients,
  useSubRecipes,
  useCategories,
  useRecipeCategories,
  useAllRecipeRecipeCategories,
  useRecipeOutletsBatch,
} from '@/lib/hooks';
import { Button, Input, Select, ConfirmModal, Modal, Checkbox } from '@/components/ui';
import { toast } from 'sonner';
import type { RecipeStatus, Outlet, SupplierIngredient } from '@/types';
import { RightPanel } from '../RightPanel';
import { cn, formatCurrency, parseIngredientsText, fuzzyMatchIngredient } from '@/lib/utils';
import type { Ingredient, Recipe } from '@/types';
import { getIngredientSuppliers } from '@/lib/api';
import { convertUnit, convertUnitPrice, getCompatibleUnits } from '@/lib/unitConversion';

// Staged item with position on canvas
interface StagedIngredient {
  id: string; // unique id for this staged item
  ingredient: Ingredient;
  quantity: number;
  unit: string; // display/recipe unit (may differ from base_unit after conversion)
  unitPrice: number | null; // price per current display unit (auto-converts on unit change)
  wastage_percentage: number;
  selectedSupplierId: number | null; // user-selected supplier from the map
  x: number;
  y: number;
}

interface StagedRecipe {
  id: string;
  recipe: Recipe;
  quantity: number;
  x: number;
  y: number;
}

type DragItem =
  | { type: 'panel-ingredient'; ingredient: Ingredient }
  | { type: 'panel-recipe'; recipe: Recipe }
  | { type: 'staged-ingredient'; stagedId: string }
  | { type: 'staged-recipe'; stagedId: string };

interface RecipeMetadata {
  name: string;
  yield_quantity: number;
  yield_unit: string;
  status: RecipeStatus;
  is_public: boolean;
  selling_price: number;
}

const DEFAULT_METADATA: RecipeMetadata = {
  name: 'Untitled Recipe',
  yield_quantity: 10,
  yield_unit: 'portion',
  status: 'draft',
  is_public: false,
  selling_price: 0,
};

function DragOverlayContent({
  item,
  stagedIngredients,
  stagedRecipes,
}: {
  item: DragItem;
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
}) {
  if (item.type === 'panel-ingredient') {
    return (
      <div className="game-card game-card-ingredient game-card-dragging w-44 opacity-95">
        <div className="game-card-art game-card-art-ingredient h-20 flex items-center justify-center">
          <ImagePlus className="h-10 w-10 text-blue-300/50" />
        </div>
        <div className="game-card-title py-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-blue-300" />
            <span className="font-bold text-white text-sm truncate uppercase">{item.ingredient.name}</span>
          </div>
        </div>
        <div className="game-card-body py-2">
          <span className="game-card-stat game-card-stat-ingredient">{item.ingredient.base_unit}</span>
        </div>
      </div>
    );
  }

  if (item.type === 'panel-recipe') {
    return (
      <div className="game-card game-card-recipe game-card-dragging w-44 opacity-95">
        {item.recipe.image_url ? (
          <div className="h-20 relative overflow-hidden rounded-t-xl">
            <Image src={item.recipe.image_url} alt={item.recipe.name} fill className="object-cover" />
          </div>
        ) : (
          <div className="game-card-art game-card-art-recipe h-20 flex items-center justify-center">
            <ImagePlus className="h-10 w-10 text-green-300/50" />
          </div>
        )}
        <div className="game-card-title py-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-green-300" />
            <span className="font-bold text-white text-sm truncate uppercase">{item.recipe.name}</span>
          </div>
        </div>
        <div className="game-card-body py-2">
          <span className="game-card-stat game-card-stat-recipe">{item.recipe.yield_quantity} {item.recipe.yield_unit}</span>
        </div>
      </div>
    );
  }

  if (item.type === 'staged-ingredient') {
    const staged = stagedIngredients.find((s) => s.id === item.stagedId);
    if (!staged) return null;
    return (
      <div className="game-card game-card-ingredient game-card-dragging w-44 opacity-95">
        <div className="game-card-art game-card-art-ingredient h-20 flex items-center justify-center">
          <ImagePlus className="h-10 w-10 text-blue-300/50" />
        </div>
        <div className="game-card-title py-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-blue-300" />
            <span className="font-bold text-white text-sm truncate uppercase">{staged.ingredient.name}</span>
          </div>
        </div>
        <div className="game-card-body py-2">
          <span className="game-card-stat game-card-stat-ingredient">{staged.unit}</span>
        </div>
      </div>
    );
  }

  if (item.type === 'staged-recipe') {
    const staged = stagedRecipes.find((s) => s.id === item.stagedId);
    if (!staged) return null;
    return (
      <div className="game-card game-card-recipe game-card-dragging w-44 opacity-95">
        {staged.recipe.image_url ? (
          <div className="h-20 relative overflow-hidden rounded-t-xl">
            <Image src={staged.recipe.image_url} alt={staged.recipe.name} fill className="object-cover" />
          </div>
        ) : (
          <div className="game-card-art game-card-art-recipe h-20 flex items-center justify-center">
            <ImagePlus className="h-10 w-10 text-green-300/50" />
          </div>
        )}
        <div className="game-card-title py-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-green-300" />
            <span className="font-bold text-white text-sm truncate uppercase">{staged.recipe.name}</span>
          </div>
        </div>
        <div className="game-card-body py-2">
          <span className="game-card-stat game-card-stat-recipe">{staged.recipe.yield_quantity} {staged.recipe.yield_unit}</span>
        </div>
      </div>
    );
  }

  return null;
}

function StagedIngredientCard({
  staged,
  onRemove,
  onQuantityChange,
  onWastageChange,
  onUnitChange,
  onSupplierSelect,
  suppliers,
  categoryMap,
}: {
  staged: StagedIngredient;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  onWastageChange: (wastage: number) => void;
  onUnitChange: (unit: string) => void;
  onSupplierSelect: (supplierId: number | null) => void;
  suppliers: SupplierIngredient[];
  categoryMap: Record<number, string>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staged-ingredient-${staged.id}`,
    data: { type: 'staged-ingredient', stagedId: staged.id },
  });

  const categoryName = staged.ingredient.category_id ? categoryMap[staged.ingredient.category_id] : null;

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isExpanded ? 10 : 1,
  };

  const unitCost = staged.unitPrice;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="game-card game-card-ingredient game-card-hover w-56"
    >
      {/* Card frame */}
      <div className="game-card-frame" />

      {/* Rarity indicator */}
      <div className="game-card-rarity game-card-rarity-ingredient" />

      {/* Card Art */}
      <div className="game-card-art game-card-art-ingredient flex items-center justify-center">
        <ImagePlus className="h-12 w-12 text-blue-300/50" />
      </div>

      {/* Title Banner */}
      <div className="game-card-title">
        <div className="flex items-center gap-2">
          <button {...listeners} {...attributes} className="cursor-grab touch-none text-blue-300 hover:text-blue-100">
            <GripVertical className="h-5 w-5" />
          </button>
          <h3 className="flex-1 font-bold text-white truncate text-base tracking-wide uppercase">
            {staged.ingredient.name}
          </h3>
          <button
            onClick={onRemove}
            className="rounded p-1 text-blue-300 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="game-card-body">
        {/* Category Badge */}
        {categoryName && (
          <div className="mb-3 pb-3 border-b border-blue-400/20">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 inline-block">
              {categoryName}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newQty = Math.max(1, staged.quantity - 1);
                onQuantityChange(parseFloat(newQty.toFixed(1)));
              }}
              className="rounded p-1 text-blue-300 hover:text-white hover:bg-blue-500/20"
              title="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={staged.quantity}
              onChange={(e) => {
                e.stopPropagation();
                onQuantityChange(parseFloat(e.target.value) || 0);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded bg-black/30 border border-blue-400/30 px-2 py-1 text-base text-white text-center focus:border-blue-400 focus:outline-none"
              min="0"
              step="0.1"
            />
            <select
              value={staged.unit}
              onChange={(e) => { e.stopPropagation(); onUnitChange(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="rounded bg-black/30 border border-blue-400/30 px-1 py-0.5 text-sm text-blue-100 focus:border-blue-400 focus:outline-none"
            >
              {getCompatibleUnits(staged.unit).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded p-1.5 text-blue-300 hover:text-white hover:bg-white/10"
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* Cost display */}
        <div className="text-sm text-blue-200/80">
          {unitCost != null ? (
            <span>${unitCost.toFixed(2)}/{staged.unit}</span>
          ) : (
            <span className="text-blue-300/50">No pricing</span>
          )}
        </div>

        {/* Supplier dropdown */}
        {suppliers.length > 0 && (
          <div className="mt-2">
            <select
              value={staged.selectedSupplierId ?? ''}
              onChange={(e) => onSupplierSelect(e.target.value ? parseInt(e.target.value, 10) : null)}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded bg-black/30 border border-blue-400/30 px-2 py-1 text-xs text-blue-100 focus:border-blue-400 focus:outline-none"
            >
              <option value="">No supplier (median)</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name} — ${supplierUnitCost(s).toFixed(2)}/{s.pack_unit}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-blue-400/20 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-300/60">Unit Cost</span>
              <span className="text-blue-100 font-medium">
                {unitCost != null ? `$${unitCost.toFixed(2)}/${staged.unit}` : 'N/A'}
              </span>
            </div>
            <div>
              <label className="text-blue-300/60 flex items-center justify-between">
                <span>Wastage %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={staged.wastage_percentage}
                  onChange={(e) => {
                    e.stopPropagation();
                    const value = parseFloat(e.target.value) || 0;
                    onWastageChange(Math.min(100, Math.max(0, value)));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 rounded bg-black/30 border border-blue-400/30 px-2 py-1 text-sm text-white text-center focus:border-blue-400 focus:outline-none"
                />
              </label>
            </div>
            <div>
              <span className="text-blue-300/60">Suppliers</span>
              {suppliers.length > 0 ? (
                <ul className="mt-1 space-y-1.5">
                  {suppliers.map((supplier) => (
                    <li
                      key={supplier.supplier_id}
                      className="flex items-center justify-between text-blue-100"
                    >
                      <span className={supplier.is_preferred ? 'font-medium' : ''}>
                        {supplier.supplier_name}
                        {supplier.is_preferred && (
                          <span className="ml-1 text-xs bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded">
                            preferred
                          </span>
                        )}
                      </span>
                      <span className="text-blue-200/60">
                        ${supplier.pack_size > 0 ? (supplier.price_per_pack / supplier.pack_size).toFixed(2) : 'N/A'}/{supplier.pack_unit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-blue-300/50">No suppliers</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StagedIngredientListItem({
  staged,
  onRemove,
  onQuantityChange,
  onWastageChange,
  onUnitChange,
  onSupplierSelect,
  suppliers,
  categoryMap,
}: {
  staged: StagedIngredient;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  onWastageChange: (wastage: number) => void;
  onUnitChange: (unit: string) => void;
  onSupplierSelect: (supplierId: number | null) => void;
  suppliers: SupplierIngredient[];
  categoryMap: Record<number, string>;
}) {
  const unitCost = staged.unitPrice;
  const categoryName = staged.ingredient.category_id ? categoryMap[staged.ingredient.category_id] : null;

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 flex items-center gap-4 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors group">
      {/* Left accent pip */}
      <div className="w-0.5 h-8 rounded-full bg-blue-400 dark:bg-blue-500 shrink-0" />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-zinc-900 dark:text-white truncate">{staged.ingredient.name}</h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{staged.unit}</span>
          {categoryName && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{categoryName}</span>
            </>
          )}
          <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {unitCost != null ? `$${unitCost.toFixed(2)}/${staged.unit}` : 'No pricing'}
          </span>
        </div>
      </div>

      {/* Supplier dropdown */}
      {suppliers.length > 0 && (
        <select
          value={staged.selectedSupplierId ?? ''}
          onChange={(e) => onSupplierSelect(e.target.value ? parseInt(e.target.value, 10) : null)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-32 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 focus:border-blue-400 focus:outline-none"
        >
          <option value="">Median</option>
          {suppliers.map((s) => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {s.supplier_name}
            </option>
          ))}
        </select>
      )}

      {/* Quantity */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onQuantityChange(parseFloat(Math.max(1, staged.quantity - 1).toFixed(1)))}
          className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          value={staged.quantity}
          onChange={(e) => { e.stopPropagation(); onQuantityChange(parseFloat(e.target.value) || 0); }}
          onClick={(e) => e.stopPropagation()}
          className="w-14 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-center tabular-nums text-zinc-900 dark:text-white focus:border-blue-400 focus:outline-none"
          min="0"
          step="0.1"
        />
        <select
          value={staged.unit}
          onChange={(e) => { e.stopPropagation(); onUnitChange(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="w-14 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1 py-1 text-xs text-zinc-700 dark:text-zinc-300 focus:border-blue-400 focus:outline-none"
        >
          {getCompatibleUnits(staged.unit).map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {/* Wastage */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" min="0" max="100" step="0.1"
          value={staged.wastage_percentage}
          onChange={(e) => { e.stopPropagation(); onWastageChange(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))); }}
          onClick={(e) => e.stopPropagation()}
          className="w-12 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-sm text-center tabular-nums text-zinc-900 dark:text-white focus:border-blue-400 focus:outline-none"
        />
        <span className="text-xs text-zinc-400">%w</span>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StagedRecipeListItem({
  staged,
  onRemove,
  onQuantityChange,
  allRecipes,
  outletNames = [],
  categoryNames = [],
}: {
  staged: StagedRecipe;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  allRecipes?: Recipe[];
  outletNames?: string[];
  categoryNames?: string[];
}) {
  const { data: recipeIngredients } = useRecipeIngredients(staged.recipe.id);
  const { data: subRecipes } = useSubRecipes(staged.recipe.id);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors group">
      <div className="flex items-center gap-4">
        {/* Left accent pip */}
        <div className="w-0.5 h-8 rounded-full bg-green-400 dark:bg-green-500 shrink-0" />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-zinc-900 dark:text-white truncate">{staged.recipe.name}</h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{staged.recipe.yield_quantity} {staged.recipe.yield_unit}</span>
            {outletNames.length > 0 && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{outletNames.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onQuantityChange(parseFloat(Math.max(1, staged.quantity - 1).toFixed(1)))}
            className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            value={staged.quantity}
            onChange={(e) => { e.stopPropagation(); onQuantityChange(parseFloat(e.target.value) || 0); }}
            onClick={(e) => e.stopPropagation()}
            className="w-14 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-center tabular-nums text-zinc-900 dark:text-white focus:border-green-400 focus:outline-none"
            min="0"
            step="0.1"
          />
          <span className="text-xs text-zinc-400">portion</span>
        </div>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Expandable detail: ingredients + sub-recipes + tags */}
      {((recipeIngredients && recipeIngredients.length > 0) || (subRecipes && subRecipes.length > 0) || categoryNames.length > 0) && (
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 ml-6 space-y-1.5">
          {/* Tags */}
          {categoryNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {categoryNames.map((name) => (
                <span key={name} className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded">
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {recipeIngredients && recipeIngredients.length > 0 && (
            <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
              {recipeIngredients.map((ri) => (
                <li key={ri.id} className="flex justify-between">
                  <span>{ri.ingredient?.name || `#${ri.ingredient_id}`} · {ri.quantity} {ri.base_unit || ri.unit}</span>
                  <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">${ri.unit_price?.toFixed(2) ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Sub-recipes */}
          {subRecipes && subRecipes.length > 0 && (
            <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
              {subRecipes.map((sr) => {
                const childRecipe = allRecipes?.find((r) => r.id === sr.child_recipe_id);
                return (
                  <li key={sr.id} className="flex justify-between">
                    <span>{childRecipe?.name || `Recipe #${sr.child_recipe_id}`}</span>
                    <span className="tabular-nums">{sr.quantity} {sr.unit}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StagedRecipeCard({
  staged,
  onRemove,
  onQuantityChange,
  allRecipes,
  outletNames = [],
  categoryNames = [],
}: {
  staged: StagedRecipe;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  allRecipes?: Recipe[];
  outletNames?: string[];
  categoryNames?: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staged-recipe-${staged.id}`,
    data: { type: 'staged-recipe', stagedId: staged.id },
  });

  // Fetch recipe ingredients and sub-recipes when expanded
  const { data: recipeIngredients } = useRecipeIngredients(isExpanded ? staged.recipe.id : null);
  const { data: subRecipes } = useSubRecipes(isExpanded ? staged.recipe.id : null);

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isExpanded ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="game-card game-card-recipe game-card-hover w-56"
    >
      {/* Card frame */}
      <div className="game-card-frame" />

      {/* Rarity indicator */}
      <div className="game-card-rarity game-card-rarity-recipe" />

      {/* Card Art */}
      {staged.recipe.image_url ? (
        <div className="game-card-art relative">
          <Image
            src={staged.recipe.image_url}
            alt={staged.recipe.name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="game-card-art game-card-art-recipe flex items-center justify-center">
          <ImagePlus className="h-12 w-12 text-green-300/50" />
        </div>
      )}

      {/* Title Banner */}
      <div className="game-card-title">
        <div className="flex items-center gap-2">
          <button {...listeners} {...attributes} className="cursor-grab touch-none text-green-300 hover:text-green-100">
            <GripVertical className="h-5 w-5" />
          </button>
          <h3 className="flex-1 font-bold text-white truncate text-base tracking-wide uppercase">
            {staged.recipe.name}
          </h3>
          <button
            onClick={onRemove}
            className="rounded p-1 text-green-300 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="game-card-body">
        {/* Stats row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newQty = Math.max(1, staged.quantity - 1);
                onQuantityChange(parseFloat(newQty.toFixed(1)));
              }}
              className="rounded p-1 text-green-300 hover:text-white hover:bg-green-500/20"
              title="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={staged.quantity}
              onChange={(e) => {
                e.stopPropagation();
                onQuantityChange(parseFloat(e.target.value) || 0);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded bg-black/30 border border-green-400/30 px-2 py-1 text-base text-white text-center focus:border-green-400 focus:outline-none"
              min="0"
              step="0.1"
            />
            <span className="game-card-stat game-card-stat-recipe">portion</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded p-1.5 text-green-300 hover:text-white hover:bg-white/10"
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* Yield display */}
        <div className="text-sm text-green-200/80">
          Yield: {staged.recipe.yield_quantity} {staged.recipe.yield_unit}
        </div>

        {/* Outlets and Categories */}
        {(outletNames.length > 0 || categoryNames.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {outletNames.map((name) => (
              <span key={name} className="inline-block text-xs bg-green-500/30 text-green-200 px-2 py-0.5 rounded">
                {name}
              </span>
            ))}
            {categoryNames.map((name) => (
              <span key={name} className="inline-block text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded">
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-green-400/20 text-sm space-y-3 max-h-48 overflow-y-auto">
            {/* Ingredients Section */}
            <div>
              <span className="text-green-300/60 font-medium">Ingredients</span>
              {recipeIngredients && recipeIngredients.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5">
                  {recipeIngredients.map((ri) => {
                    const ingredient = ri.ingredient;
                    const suppliers = ingredient?.supplier_ingredients || [];
                    const preferredSupplier = suppliers.find((s) => s.is_preferred);
                    return (
                      <li key={ri.id} className="bg-black/20 rounded p-2">
                        <div className="font-medium text-green-100">{ingredient?.name || `Ingredient #${ri.ingredient_id}`}</div>
                        <div className="text-green-200/60 flex flex-wrap gap-x-2">
                          <span>{ri.quantity} {ri.base_unit || ri.unit}</span>
                          <span>@ ${ri.unit_price?.toFixed(2) ?? 'N/A'}/{ri.base_unit || ri.unit}</span>
                        </div>
                        {suppliers.length > 0 && (
                          <div className="text-green-300/50 mt-0.5">
                            {preferredSupplier?.supplier_name || suppliers[0]?.supplier_name}
                            {preferredSupplier && <span className="ml-1 text-xs bg-green-500/30 text-green-200 px-1.5 py-0.5 rounded">preferred</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-green-300/50">No ingredients</p>
              )}
            </div>

            {/* Sub-Recipes Section */}
            {subRecipes && subRecipes.length > 0 && (
              <div>
                <span className="text-green-300/60 font-medium">Sub-Recipes</span>
                <ul className="mt-1.5 space-y-1.5">
                  {subRecipes.map((sr) => {
                    const childRecipe = allRecipes?.find((r) => r.id === sr.child_recipe_id);
                    return (
                      <li key={sr.id} className="bg-black/20 rounded p-2">
                        <div className="font-medium text-green-100">{childRecipe?.name || `Recipe #${sr.child_recipe_id}`}</div>
                        <div className="text-green-200/60">
                          {sr.quantity} {sr.unit}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TableItemDropdown({
  staged,
  isIngredient,
  allIngredients,
  allRecipes,
  categoryMap,
  dropdownId,
  openDropdown,
  setOpenDropdown,
  onIngredientSelect,
  onRecipeSelect,
}: {
  staged: StagedIngredient | StagedRecipe;
  isIngredient: boolean;
  allIngredients?: Ingredient[];
  allRecipes?: Recipe[];
  categoryMap: Record<number, string>;
  dropdownId: string;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  onIngredientSelect?: (ingredient: Ingredient) => void;
  onRecipeSelect?: (recipe: Recipe) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const isOpen = openDropdown === dropdownId;
  const displayName = isIngredient ? (staged as StagedIngredient).ingredient.name : (staged as StagedRecipe).recipe.name;

  // Filter both ingredients and recipes based on search query
  const filteredIngredients = allIngredients?.filter((ing) =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const filteredRecipes = allRecipes?.filter((recipe) =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const selectedIngredientId = isIngredient ? (staged as StagedIngredient).ingredient.id : null;
  const selectedRecipeId = !isIngredient ? (staged as StagedRecipe).recipe.id : null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="w-full text-left px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white hover:border-zinc-400 dark:hover:border-zinc-500 flex items-center justify-between"
      >
        <span className="truncate">{displayName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded shadow-lg z-50 flex flex-col max-h-72">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none sticky top-0"
          />

          {/* Results List */}
          <div className="overflow-y-auto flex-1">
            {filteredIngredients.length === 0 && filteredRecipes.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No results found</div>
            ) : (
              <>
                {/* Ingredients Section */}
                {filteredIngredients.length > 0 && (
                  <>
                    {filteredRecipes.length > 0 && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                        Ingredients
                      </div>
                    )}
                    {filteredIngredients.map((ing) => (
                      <button
                        key={`ing-${ing.id}`}
                        onClick={() => {
                          onIngredientSelect?.(ing);
                          setOpenDropdown(null);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{ing.name}</p>
                            <div className="flex gap-1 flex-wrap mt-1">
                              <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded flex-shrink-0">
                                Ingredient
                              </span>
                              {categoryMap[ing.category_id || 0] && (
                                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">
                                  {categoryMap[ing.category_id || 0]}
                                </span>
                              )}
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">{ing.base_unit}</span>
                            </div>
                          </div>
                          {ing.id === selectedIngredientId && (
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Recipes Section */}
                {filteredRecipes.length > 0 && (
                  <>
                    {filteredIngredients.length > 0 && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                        Recipes
                      </div>
                    )}
                    {filteredRecipes.map((recipe) => (
                      <button
                        key={`recipe-${recipe.id}`}
                        onClick={() => {
                          onRecipeSelect?.(recipe);
                          setOpenDropdown(null);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{recipe.name}</p>
                            <div className="flex gap-1 flex-wrap mt-1">
                              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded flex-shrink-0">
                                Recipe
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                                Yield: {recipe.yield_quantity} {recipe.yield_unit}
                              </span>
                            </div>
                          </div>
                          {recipe.id === selectedRecipeId && (
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CanvasTable({
  stagedIngredients,
  stagedRecipes,
  onRemoveIngredient,
  onRemoveRecipe,
  onIngredientQuantityChange,
  onIngredientWastageChange,
  onIngredientUnitChange,
  onRecipeQuantityChange,
  onIngredientSelect,
  onRecipeSelect,
  allRecipes,
  allIngredients,
  categoryMap,
}: {
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: (id: string) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onIngredientWastageChange: (id: string, wastage: number) => void;
  onIngredientUnitChange: (id: string, unit: string) => void;
  onRecipeQuantityChange: (id: string, quantity: number) => void;
  onIngredientSelect: (id: string, ingredientOrRecipe: Ingredient | Recipe) => void;
  onRecipeSelect: (id: string, recipeOrIngredient: Recipe | Ingredient) => void;
  allRecipes?: Recipe[];
  allIngredients?: Ingredient[];
  categoryMap: Record<number, string>;
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  return (
    <div className="w-full h-full overflow-auto flex flex-col">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
            <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Qty</th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Unit</th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Wastage</th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Item</th>
            <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {/* Ingredients */}
          {stagedIngredients.map((staged) => (
            <tr key={staged.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onIngredientQuantityChange(staged.id, parseFloat(Math.max(1, staged.quantity - 1).toFixed(1)))}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    value={staged.quantity}
                    onChange={(e) => { e.stopPropagation(); onIngredientQuantityChange(staged.id, parseFloat(e.target.value) || 0); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-14 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-center tabular-nums text-zinc-900 dark:text-white focus:border-blue-400 focus:outline-none"
                    min="0"
                    step="0.1"
                  />
                  <button
                    onClick={() => onIngredientQuantityChange(staged.id, parseFloat((staged.quantity + 1).toFixed(1)))}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <select
                  value={staged.unit}
                  onChange={(e) => { e.stopPropagation(); onIngredientUnitChange(staged.id, e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-sm text-zinc-700 dark:text-zinc-300 focus:border-blue-400 focus:outline-none"
                >
                  {getCompatibleUnits(staged.unit).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={staged.wastage_percentage}
                    onChange={(e) => { e.stopPropagation(); onIngredientWastageChange(staged.id, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-14 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-center tabular-nums text-zinc-900 dark:text-white focus:border-blue-400 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-400">%</span>
                </div>
              </td>
              <td className="px-4 py-3 relative">
                <TableItemDropdown
                  staged={staged}
                  isIngredient={true}
                  allIngredients={allIngredients}
                  allRecipes={allRecipes}
                  categoryMap={categoryMap}
                  dropdownId={`ing-${staged.id}`}
                  openDropdown={openDropdown}
                  setOpenDropdown={setOpenDropdown}
                  onIngredientSelect={(ingredient) => onIngredientSelect(staged.id, ingredient)}
                  onRecipeSelect={(recipe) => onIngredientSelect(staged.id, recipe)}
                />
              </td>
              <td className="px-4 py-2.5">
                <button
                  onClick={() => onRemoveIngredient(staged.id)}
                  className="rounded p-1 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}

          {/* Recipes */}
          {stagedRecipes.map((staged) => (
            <tr key={staged.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onRecipeQuantityChange(staged.id, parseFloat(Math.max(1, staged.quantity - 1).toFixed(1)))}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    value={staged.quantity}
                    onChange={(e) => { e.stopPropagation(); onRecipeQuantityChange(staged.id, parseFloat(e.target.value) || 0); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-14 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-sm text-center tabular-nums text-zinc-900 dark:text-white focus:border-green-400 focus:outline-none"
                    min="0"
                    step="0.1"
                  />
                  <button
                    onClick={() => onRecipeQuantityChange(staged.id, parseFloat((staged.quantity + 1).toFixed(1)))}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </td>
              <td className="px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400">portion</td>
              <td className="px-4 py-2.5 text-sm text-zinc-400 dark:text-zinc-500">—</td>
              <td className="px-4 py-3 relative">
                <TableItemDropdown
                  staged={staged}
                  isIngredient={false}
                  allIngredients={allIngredients}
                  allRecipes={allRecipes}
                  categoryMap={categoryMap}
                  dropdownId={`recipe-${staged.id}`}
                  openDropdown={openDropdown}
                  setOpenDropdown={setOpenDropdown}
                  onRecipeSelect={(recipe) => onRecipeSelect(staged.id, recipe)}
                  onIngredientSelect={(ingredient) => onRecipeSelect(staged.id, ingredient)}
                />
              </td>
              <td className="px-4 py-2.5">
                <button
                  onClick={() => onRemoveRecipe(staged.id)}
                  className="rounded p-1 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CanvasDropZone({
  stagedIngredients,
  stagedRecipes,
  onRemoveIngredient,
  onRemoveRecipe,
  onIngredientQuantityChange,
  onIngredientWastageChange,
  onIngredientUnitChange,
  onSupplierSelect,
  supplierMap,
  onRecipeQuantityChange,
  onIngredientSelect,
  onRecipeSelect,
  canvasRef,
  allRecipes,
  allIngredients,
  viewMode = 'grid',
  categoryMap,
  getOutletNamesForRecipe,
  getCategoryNamesForRecipe,
}: {
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: (id: string) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onIngredientWastageChange: (id: string, wastage: number) => void;
  onIngredientUnitChange: (id: string, unit: string) => void;
  onSupplierSelect: (id: string, supplierId: number | null) => void;
  supplierMap: Record<number, SupplierIngredient[]>;
  onRecipeQuantityChange: (id: string, quantity: number) => void;
  onIngredientSelect: (id: string, ingredientOrRecipe: Ingredient | Recipe) => void;
  onRecipeSelect: (id: string, recipeOrIngredient: Recipe | Ingredient) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  allRecipes?: Recipe[];
  allIngredients?: Ingredient[];
  viewMode?: 'grid' | 'list' | 'table';
  categoryMap: Record<number, string>;
  getOutletNamesForRecipe: (recipeId: number) => string[];
  getCategoryNamesForRecipe: (recipeId: number) => string[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone',
  });

  const hasItems = stagedIngredients.length > 0 || stagedRecipes.length > 0;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (canvasRef && 'current' in canvasRef) {
          canvasRef.current = node;
        }
      }}
      className={`relative flex-1 min-h-[400px] overflow-auto rounded-xl border-2 border-dashed transition-colors ${isOver
          ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/20'
          : 'border-zinc-200 dark:border-zinc-800'
        } ${viewMode === 'list' ? 'flex flex-col' : ''}`}
      style={viewMode === 'table' ? {
        position: 'relative',
        padding: '0px',
        display: 'flex',
        flexDirection: 'column',
      } : {
        position: 'relative',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!hasItems && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Plus className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Drag or add items from the library
          </p>
        </div>
      )}
      {viewMode === 'grid' ? (
        <div className="flex flex-wrap gap-4">
          {stagedIngredients.map((staged) => (
            <StagedIngredientCard
              key={staged.id}
              staged={staged}
              onRemove={() => onRemoveIngredient(staged.id)}
              onQuantityChange={(q) => onIngredientQuantityChange(staged.id, q)}
              onWastageChange={(w) => onIngredientWastageChange(staged.id, w)}
              onUnitChange={(u) => onIngredientUnitChange(staged.id, u)}
              onSupplierSelect={(sid) => onSupplierSelect(staged.id, sid)}
              suppliers={supplierMap[staged.ingredient.id] ?? []}
              categoryMap={categoryMap}
            />
          ))}
          {stagedRecipes.map((staged) => (
            <StagedRecipeCard
              key={staged.id}
              staged={staged}
              onRemove={() => onRemoveRecipe(staged.id)}
              onQuantityChange={(q) => onRecipeQuantityChange(staged.id, q)}
              allRecipes={allRecipes}
              outletNames={getOutletNamesForRecipe(staged.recipe.id)}
              categoryNames={getCategoryNamesForRecipe(staged.recipe.id)}
            />
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <CanvasTable
          stagedIngredients={stagedIngredients}
          stagedRecipes={stagedRecipes}
          onRemoveIngredient={onRemoveIngredient}
          onRemoveRecipe={onRemoveRecipe}
          onIngredientQuantityChange={onIngredientQuantityChange}
          onIngredientWastageChange={onIngredientWastageChange}
          onIngredientUnitChange={onIngredientUnitChange}
          onRecipeQuantityChange={onRecipeQuantityChange}
          onIngredientSelect={onIngredientSelect}
          onRecipeSelect={onRecipeSelect}
          allRecipes={allRecipes}
          allIngredients={allIngredients}
          categoryMap={categoryMap}
        />
      ) : (
        <div className="space-y-3">
          {stagedIngredients.map((staged) => (
            <StagedIngredientListItem
              key={staged.id}
              staged={staged}
              onRemove={() => onRemoveIngredient(staged.id)}
              onQuantityChange={(q) => onIngredientQuantityChange(staged.id, q)}
              onWastageChange={(w) => onIngredientWastageChange(staged.id, w)}
              onUnitChange={(u) => onIngredientUnitChange(staged.id, u)}
              onSupplierSelect={(sid) => onSupplierSelect(staged.id, sid)}
              suppliers={supplierMap[staged.ingredient.id] ?? []}
              categoryMap={categoryMap}
            />
          ))}
          {stagedRecipes.map((staged) => (
            <StagedRecipeListItem
              key={staged.id}
              staged={staged}
              onRemove={() => onRemoveRecipe(staged.id)}
              onQuantityChange={(q) => onRecipeQuantityChange(staged.id, q)}
              allRecipes={allRecipes}
              outletNames={getOutletNamesForRecipe(staged.recipe.id)}
              categoryNames={getCategoryNamesForRecipe(staged.recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

function CanvasContent({
  stagedIngredients,
  stagedRecipes,
  metadata,
  onMetadataChange,
  onRemoveIngredient,
  onRemoveRecipe,
  onIngredientQuantityChange,
  onIngredientWastageChange,
  onIngredientUnitChange,
  onSupplierSelect,
  supplierMap,
  onRecipeQuantityChange,
  onIngredientSelect,
  onRecipeSelect,
  onSubmit,
  onFork,
  onReset,
  onClearAll,
  isSubmitting,
  isForking,
  canvasRef,
  rootRecipeName,
  currentVersion,
  allRecipes,
  allIngredients,
  hasUnsavedChanges,
  hasSelectedRecipe,
  isOwner,
  viewMode,
  onViewModeChange,
  categoryMap,
  canvasCost,
  getOutletNamesForRecipe,
  getCategoryNamesForRecipe,
  onShowAddIngredientsModal,
}: {
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
  metadata: RecipeMetadata;
  onMetadataChange: (updates: Partial<RecipeMetadata>) => void;
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: (id: string) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onIngredientWastageChange: (id: string, wastage: number) => void;
  onIngredientUnitChange: (id: string, unit: string) => void;
  onSupplierSelect: (id: string, supplierId: number | null) => void;
  supplierMap: Record<number, SupplierIngredient[]>;
  onRecipeQuantityChange: (id: string, quantity: number) => void;
  onIngredientSelect: (id: string, ingredientOrRecipe: Ingredient | Recipe) => void;
  onRecipeSelect: (id: string, recipeOrIngredient: Recipe | Ingredient) => void;
  onSubmit: () => void;
  onFork: () => void;
  onReset: () => void;
  onClearAll: () => void;
  isSubmitting: boolean;
  isForking: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  rootRecipeName: string | null;
  currentVersion: number | null;
  allRecipes?: Recipe[];
  allIngredients?: Ingredient[];
  hasUnsavedChanges: boolean;
  hasSelectedRecipe: boolean;
  isOwner: boolean;
  viewMode: 'grid' | 'list' | 'table';
  onViewModeChange: (mode: 'grid' | 'list' | 'table') => void;
  categoryMap: Record<number, string>;
  canvasCost: number;
  getOutletNamesForRecipe: (recipeId: number) => string[];
  getCategoryNamesForRecipe: (recipeId: number) => string[];
  onShowAddIngredientsModal: () => void;
}) {
  const hasItems = stagedIngredients.length > 0 || stagedRecipes.length > 0;
  const [showDetails, setShowDetails] = useState(true);

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* ── Header: Name + key info on one line ── */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <Input
            value={metadata.name}
            onChange={(e) => onMetadataChange({ name: e.target.value })}
            placeholder="Recipe name"
            className="text-base font-semibold flex-1 min-w-0 border-transparent bg-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors h-9"
          />

          {/* Compact cost summary pills */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {canvasCost > 0 && (
              <span className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2.5 py-1 tabular-nums">
                Batch {formatCurrency(canvasCost)}
              </span>
            )}
            {canvasCost > 0 && metadata.yield_quantity > 0 && (
              <span className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2.5 py-1 tabular-nums">
                {formatCurrency(canvasCost / metadata.yield_quantity)}/{metadata.yield_unit}
              </span>
            )}
            {metadata.selling_price > 0 && (
              <span className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2.5 py-1 tabular-nums">
                Sell {formatCurrency(metadata.selling_price)}
              </span>
            )}
            {canvasCost > 0 && metadata.yield_quantity > 0 && metadata.selling_price > 0 && (() => {
              const costPerPortion = canvasCost / metadata.yield_quantity;
              const profitPerPortion = metadata.selling_price - costPerPortion;
              const isProfit = profitPerPortion > 0.005;
              const isLoss = profitPerPortion < -0.005;
              return (
                <span className={cn(
                  'text-xs font-medium rounded-full px-2.5 py-1 tabular-nums',
                  isProfit && 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                  isLoss && 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                  !isProfit && !isLoss && 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                )}>
                  {isProfit ? '+' : ''}{formatCurrency(profitPerPortion)}/{metadata.yield_unit}
                </span>
              );
            })()}
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="shrink-0 p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={showDetails ? 'Hide details' : 'Show details'}
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Version info */}
        {(rootRecipeName || currentVersion) && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 pl-1">
            Based on: {rootRecipeName || 'N/A'}{currentVersion ? ` · v${currentVersion}` : ''}
          </p>
        )}

        {/* ── Collapsible details panel ── */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3">
            {/* Yield */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Yield</label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={metadata.yield_quantity}
                  onChange={(e) =>
                    onMetadataChange({ yield_quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="w-16 h-8 text-sm"
                  min="0"
                  step="1"
                />
                <Input
                  value={metadata.yield_unit}
                  onChange={(e) => onMetadataChange({ yield_unit: e.target.value })}
                  placeholder="unit"
                  className="w-20 h-8 text-sm"
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Status</label>
              <Select
                value={metadata.status}
                onChange={(e) => onMetadataChange({ status: e.target.value as RecipeStatus })}
                options={STATUS_OPTIONS}
                className="w-full h-8 text-sm"
              />
            </div>

            {/* Selling Price */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Selling Price</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-400">$</span>
                <Input
                  type="number"
                  value={metadata.selling_price}
                  onChange={(e) =>
                    onMetadataChange({ selling_price: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  className="w-20 h-8 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Options</label>
              <div className="flex items-center gap-3 h-8">
                <Checkbox
                  checked={metadata.is_public}
                  onChange={(e) => onMetadataChange({ is_public: e.target.checked })}
                  label="Public"
                />
              </div>
            </div>

            {/* View Mode */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">View</label>
              <div className="flex items-center gap-1 h-8">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={`p-1.5 rounded ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                  }`}
                  title="Card view"
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={`p-1.5 rounded ${
                    viewMode === 'list'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                  }`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onViewModeChange('table')}
                  className={`p-1.5 rounded ${
                    viewMode === 'table'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                  }`}
                  title="Table view"
                >
                  <Table2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 overflow-y-auto p-5">
        <CanvasDropZone
          stagedIngredients={stagedIngredients}
          stagedRecipes={stagedRecipes}
          onRemoveIngredient={onRemoveIngredient}
          onRemoveRecipe={onRemoveRecipe}
          onIngredientQuantityChange={onIngredientQuantityChange}
          onIngredientWastageChange={onIngredientWastageChange}
          onIngredientUnitChange={onIngredientUnitChange}
          onSupplierSelect={onSupplierSelect}
          supplierMap={supplierMap}
          onRecipeQuantityChange={onRecipeQuantityChange}
          onIngredientSelect={onIngredientSelect}
          onRecipeSelect={onRecipeSelect}
          canvasRef={canvasRef}
          allRecipes={allRecipes}
          allIngredients={allIngredients}
          viewMode={viewMode}
          categoryMap={categoryMap}
          getOutletNamesForRecipe={getOutletNamesForRecipe}
          getCategoryNamesForRecipe={getCategoryNamesForRecipe}
        />
      </div>

      {/* ── Bottom Bar — compact ── */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm px-5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">{stagedIngredients.length} ingredient{stagedIngredients.length !== 1 ? 's' : ''}</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="tabular-nums">{stagedRecipes.length} item{stagedRecipes.length !== 1 ? 's' : ''}</span>
            {hasUnsavedChanges && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">Unsaved</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReset}>
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
            >
              Clear
            </Button>
            {hasSelectedRecipe && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFork}
                disabled={!hasItems || isForking}
                className="border-purple-500 text-purple-500 hover:bg-purple-50 hover:text-purple-600 dark:border-purple-500 dark:text-purple-500 dark:hover:bg-purple-950 dark:hover:text-purple-400"
              >
                {isForking ? 'Forking...' : 'Fork'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onShowAddIngredientsModal}
            >
              + Ingredients
            </Button>
            <Button size="sm" onClick={onSubmit} disabled={
              isSubmitting ||
              !metadata.name.trim() ||
              (hasSelectedRecipe && !isOwner) ||
              (hasSelectedRecipe && !hasUnsavedChanges)
            }>
              {isSubmitting
                ? hasSelectedRecipe ? 'Saving...' : 'Creating...'
                : hasSelectedRecipe ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

// Compute the unit cost for a given supplier
function supplierUnitCost(s: SupplierIngredient): number {
  return s.pack_size > 0 ? s.price_per_pack / s.pack_size : 0;
}

// Get the display cost for a staged ingredient:
//  1. If a supplier is selected → that supplier's cost
//  2. If no selection but suppliers exist → median cost
//  3. If no suppliers → ingredient.cost_per_base_unit
function getIngredientUnitCost(
  staged: StagedIngredient,
  suppliers: SupplierIngredient[],
): { cost: number | null; label: string; supplierId: number | null } {
  if (staged.selectedSupplierId != null) {
    const selected = suppliers.find((s) => s.supplier_id === staged.selectedSupplierId);
    if (selected) {
      return { cost: supplierUnitCost(selected), label: selected.supplier_name ?? 'Supplier', supplierId: selected.supplier_id };
    }
  }

  if (suppliers.length > 0) {
    const costs = suppliers.map(supplierUnitCost).sort((a, b) => a - b);
    const mid = Math.floor(costs.length / 2);
    const median = costs.length % 2 !== 0 ? costs[mid] : (costs[mid - 1] + costs[mid]) / 2;
    return { cost: median, label: 'Median', supplierId: null };
  }

  return { cost: staged.ingredient.cost_per_base_unit, label: 'Base', supplierId: null };
}

// Calculate total cost from staged ingredients and recipes
function calculateCanvasCost(
  stagedIngredients: StagedIngredient[],
  stagedRecipes: StagedRecipe[],
  allRecipes?: Recipe[],
) {
  let totalCost = 0;

  for (const staged of stagedIngredients) {
    if (staged.unitPrice != null) {
      const wastageMultiplier = staged.wastage_percentage > 0
        ? 1 / (1 - staged.wastage_percentage / 100)
        : 1;
      totalCost += staged.quantity * staged.unitPrice * wastageMultiplier;
    }
  }

  for (const staged of stagedRecipes) {
    const recipe = allRecipes?.find((r) => r.id === staged.recipe.id);
    if (recipe?.cost_price != null) {
      totalCost += staged.quantity * recipe.cost_price;
    }
  }

  return totalCost;
}

interface CanvasTabProps {
  outlets?: Outlet[];
}

export function CanvasTab({ outlets }: CanvasTabProps) {
  const router = useRouter();
  const { userId, selectedRecipeId, userType, isDragDropEnabled, canvasViewMode, setCanvasViewMode } = useAppState();
  const { data: recipesData } = useRecipes({ page_size: 30 });
  const recipes = recipesData?.items;
  const { data: selectedRecipeData } = useRecipe(selectedRecipeId);
  const { data: ingredientsData } = useIngredients({ page_size: 30 });
  const ingredients = ingredientsData?.items;
  const { data: recipeIngredients } = useRecipeIngredients(selectedRecipeId);
  const { data: subRecipes } = useSubRecipes(selectedRecipeId);
  const { data: categories } = useCategories();
  const { data: recipeCategoriesData } = useRecipeCategories({ page_size: 30 });
  const recipeCategories = recipeCategoriesData?.items;
  const { data: recipeCategoryLinks } = useAllRecipeRecipeCategories();

  // Create a mapping of category ID to name for efficient lookups
  const categoryMap = useMemo(() => {
    if (!categories) return {} as Record<number, string>;
    return categories.reduce<Record<number, string>>((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {});
  }, [categories]);

  // Fetch outlets for all recipes (with TanStack Query caching)
  const { data: recipeOutlets = new Map() } = useRecipeOutletsBatch(
    recipes && recipes.length > 0 ? recipes.map((r) => r.id) : null
  );

  // Map category_id -> name
  const recipeCategoryNameMap = useMemo(() => {
    if (!recipeCategories) return new Map<number, string>();
    return new Map(recipeCategories.map((c) => [c.id, c.name]));
  }, [recipeCategories]);

  // Build a map of recipe_id -> category_ids[]
  const recipeCategoryMap = useMemo(() => {
    const map = new Map<number, number[]>();

    if (!recipeCategoryLinks) return map;

    recipeCategoryLinks.forEach((link) => {
      if (link.is_active) {
        const existing = map.get(link.recipe_id) || [];
        map.set(link.recipe_id, [...existing, link.category_id]);
      }
    });

    return map;
  }, [recipeCategoryLinks]);

  // Map outlet_id -> name
  const outletNameMap = useMemo(() => {
    if (!outlets) return new Map<number, string>();
    return new Map(outlets.map((o) => [o.id, o.name]));
  }, [outlets]);

  // Get outlet names for a recipe
  const getOutletNamesForRecipe = (recipeId: number): string[] => {
    const recipeOutletLinks = recipeOutlets.get(recipeId) || [];
    return recipeOutletLinks
      .filter((link: { is_active: boolean; outlet_id: number }) => link.is_active)
      .map((link: { is_active: boolean; outlet_id: number }) => outletNameMap.get(link.outlet_id))
      .filter((name: string | undefined): name is string => name !== undefined);
  };

  // Get category names for a recipe
  const getCategoryNamesForRecipe = (recipeId: number): string[] => {
    const categoryIds = recipeCategoryMap.get(recipeId) || [];
    return categoryIds
      .map((catId) => recipeCategoryNameMap.get(catId))
      .filter((name): name is string => name !== undefined);
  };

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const addIngredient = useAddRecipeIngredient();
  const updateIngredient = useUpdateRecipeIngredient();
  const removeIngredient = useRemoveRecipeIngredient();
  const addSubRecipe = useAddSubRecipe();
  const updateSubRecipeHook = useUpdateSubRecipe();
  const removeSubRecipe = useRemoveSubRecipe();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [stagedIngredients, setStagedIngredients] = useState<StagedIngredient[]>([]);
  const [stagedRecipes, setStagedRecipes] = useState<StagedRecipe[]>([]);
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showForkModal, setShowForkModal] = useState(false);
  const [showAddIngredientsModal, setShowAddIngredientsModal] = useState(false);
  const [addIngredientsText, setAddIngredientsText] = useState('');
  const [loadedRecipeId, setLoadedRecipeId] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<RecipeMetadata>(DEFAULT_METADATA);

  // Supplier data dictionary — keyed by ingredient ID, populated lazily on drop
  const [supplierMap, setSupplierMap] = useState<Record<number, SupplierIngredient[]>>({});

  // Fetch suppliers for an ingredient and store in the map (no-op if already loaded)
  const fetchedIdsRef = useRef<Set<number>>(new Set());

  const fetchSuppliersForIngredient = useCallback((ingredientId: number) => {
    if (fetchedIdsRef.current.has(ingredientId)) return; // already fetched or in-flight
    fetchedIdsRef.current.add(ingredientId);
    getIngredientSuppliers(ingredientId)
      .then((data) => {
        setSupplierMap((prev) => ({ ...prev, [ingredientId]: data }));
      })
      .catch(() => {
        // silently ignore — map will stay empty for this ingredient
      });
  }, []);

  // Track initial state for unsaved changes detection
  const [initialState, setInitialState] = useState<{
    ingredientIds: string[];
    ingredientQuantities: Record<string, number>;
    recipeIds: string[];
    recipeQuantities: Record<string, number>;
    metadata: RecipeMetadata;
  } | null>(null);

  // Calculate total cost from staged items
  const canvasCost = useMemo(() => {
    return calculateCanvasCost(stagedIngredients, stagedRecipes, recipes);
  }, [stagedIngredients, stagedRecipes, recipes]);

  // Handle custom events from RightPanel "Add" buttons
  useEffect(() => {
    const handleAddIngredient = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { ingredient } = customEvent.detail;

      // Check if ingredient already exists on canvas
      const existingIndex = stagedIngredients.findIndex(
        (s) => s.ingredient.id === ingredient.id
      );

      if (existingIndex >= 0) {
        // Increment quantity of existing ingredient
        setStagedIngredients((prev) =>
          prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
        toast.success(`Increased ${ingredient.name} quantity`);
      } else {
        // Add new ingredient
        const newStaged: StagedIngredient = {
          id: `ing-${Date.now()}-${Math.random()}`,
          ingredient,
          quantity: 1,
          unit: ingredient.base_unit,
          unitPrice: ingredient.cost_per_base_unit ?? null,
          wastage_percentage: 0,
          selectedSupplierId: null,
          x: 0,
          y: 0,
        };
        setStagedIngredients((prev) => [...prev, newStaged]);
        fetchSuppliersForIngredient(ingredient.id);
        toast.success(`Added ${ingredient.name} to canvas`);
      }
    };

    const handleAddRecipe = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { recipe } = customEvent.detail;

      // Check if recipe already exists on canvas
      const existingIndex = stagedRecipes.findIndex(
        (s) => s.recipe.id === recipe.id
      );

      if (existingIndex >= 0) {
        // Increment quantity of existing recipe
        setStagedRecipes((prev) =>
          prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
        toast.success(`Increased ${recipe.name} quantity`);
      } else {
        // Add new recipe
        const newStaged: StagedRecipe = {
          id: `rec-${Date.now()}-${Math.random()}`,
          recipe,
          quantity: 1,
          x: 0,
          y: 0,
        };
        setStagedRecipes((prev) => [...prev, newStaged]);
        toast.success(`Added ${recipe.name} to canvas`);
      }
    };

    window.addEventListener('canvas-add-ingredient', handleAddIngredient);
    window.addEventListener('canvas-add-recipe', handleAddRecipe);

    return () => {
      window.removeEventListener('canvas-add-ingredient', handleAddIngredient);
      window.removeEventListener('canvas-add-recipe', handleAddRecipe);
    };
  }, [stagedIngredients, stagedRecipes]);

  const handleMetadataChange = useCallback((updates: Partial<RecipeMetadata>) => {
    setMetadata((prev) => ({ ...prev, ...updates }));
  }, []);

  // Eagerly load recipe metadata (name, yield, status) as soon as the recipe
  // data is available, without waiting for ingredients/subRecipes to load.
  // This prevents a flash of "Untitled Recipe" on initial page load.
  useEffect(() => {
    if (selectedRecipeId === null) return;
    if (!selectedRecipeData) return;
    if (loadedRecipeId === selectedRecipeId) return;

    setMetadata({
      name: selectedRecipeData.name,
      yield_quantity: selectedRecipeData.yield_quantity,
      yield_unit: selectedRecipeData.yield_unit,
      status: selectedRecipeData.status,
      is_public: selectedRecipeData.is_public,
      selling_price: selectedRecipeData.selling_price_est ?? 0,
    });
  }, [selectedRecipeId, selectedRecipeData, loadedRecipeId]);

  // Load existing recipe data when a recipe is selected
  useEffect(() => {
    if (selectedRecipeId === null) {
      if (loadedRecipeId !== null) {
        setStagedIngredients([]);
        setStagedRecipes([]);
        setMetadata(DEFAULT_METADATA);
        setLoadedRecipeId(null);
        setInitialState({
          ingredientIds: [],
          ingredientQuantities: {},
          recipeIds: [],
          recipeQuantities: {},
          metadata: DEFAULT_METADATA,
        });
      }
      return;
    }

    if (loadedRecipeId === selectedRecipeId) return;
    if (!recipeIngredients || !subRecipes) return;

    // Load recipe metadata from selected recipe
    const selectedRecipe = selectedRecipeData ?? recipes?.find((r) => r.id === selectedRecipeId);
    const loadedMetadata: RecipeMetadata = selectedRecipe
      ? {
        name: selectedRecipe.name,
        yield_quantity: selectedRecipe.yield_quantity,
        yield_unit: selectedRecipe.yield_unit,
        status: selectedRecipe.status,
        is_public: selectedRecipe.is_public,
        selling_price: selectedRecipe.selling_price_est ?? 0,
      }
      : DEFAULT_METADATA;

    setMetadata(loadedMetadata);

    // Load ingredients onto canvas
    const loadedIngredients: StagedIngredient[] = recipeIngredients.map((ri) => {
      // Convert unit_price from base_unit to display unit if they differ
      const baseUnit = ri.base_unit || ri.unit;
      const rawPrice = ri.unit_price;
      const displayPrice = rawPrice != null && baseUnit !== ri.unit
        ? (convertUnitPrice(rawPrice, baseUnit, ri.unit) ?? rawPrice)
        : rawPrice;
      return {
        id: `existing-ing-${ri.id}`,
        ingredient: ri.ingredient || {
          id: ri.ingredient_id,
          name: `Ingredient #${ri.ingredient_id}`,
          base_unit: ri.unit,
          cost_per_base_unit: ri.unit_price,
          is_active: true,
          is_halal: false,
          category_id: null,
          created_at: '',
          updated_at: '',
        },
        quantity: ri.quantity,
        unit: ri.unit,
        unitPrice: displayPrice ?? null,
        wastage_percentage: ri.wastage_percentage,
        selectedSupplierId: ri.supplier_id ?? null,
        x: 0,
        y: 0,
      };
    });

    // Fetch suppliers for all loaded ingredients
    for (const ri of recipeIngredients) {
      fetchSuppliersForIngredient(ri.ingredient_id);
    }

    // Load sub-recipes onto canvas
    const loadedSubRecipes: StagedRecipe[] = subRecipes.map((sr) => {
      const childRecipe = recipes?.find((r) => r.id === sr.child_recipe_id);
      return {
        id: `existing-rec-${sr.id}`,
        recipe: childRecipe || ({
          id: sr.child_recipe_id,
          name: `Recipe #${sr.child_recipe_id}`,
          instructions_raw: null,
          instructions_structured: null,
          yield_quantity: 1,
          yield_unit: 'portion',
          cost_price: null,
          selling_price_est: null,
          status: 'draft' as const,
          is_prep_recipe: false,
          is_public: false,
          owner_id: null,
          version: 1,
          root_id: null,
          image_url: null,
          description: null,
          summary_feedback: null,
          rnd_started: false,
          review_ready: false,
          created_at: '',
          updated_at: '',
          created_by: '',
        } as Recipe),
        quantity: sr.quantity,
        x: 0, // Placeholder - will be set by position recalculation effect
        y: 0,
      };
    });

    setStagedIngredients(loadedIngredients);
    setStagedRecipes(loadedSubRecipes);
    setLoadedRecipeId(selectedRecipeId);

    // Save initial state for change detection
    const ingredientQuantities: Record<string, number> = {};
    loadedIngredients.forEach((ing) => {
      ingredientQuantities[ing.ingredient.id.toString()] = ing.quantity;
    });

    const recipeQuantities: Record<string, number> = {};
    loadedSubRecipes.forEach((rec) => {
      recipeQuantities[rec.recipe.id.toString()] = rec.quantity;
    });

    setInitialState({
      ingredientIds: loadedIngredients.map((ing) => ing.ingredient.id.toString()),
      ingredientQuantities,
      recipeIds: loadedSubRecipes.map((rec) => rec.recipe.id.toString()),
      recipeQuantities,
      metadata: loadedMetadata,
    });
  }, [selectedRecipeId, selectedRecipeData, recipeIngredients, subRecipes, recipes, loadedRecipeId, fetchSuppliersForIngredient]);


  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as {
      type?: string;
      ingredient?: Ingredient;
      recipe?: Recipe;
      stagedId?: string;
    } | undefined;

    if (!data) return;

    if (data.type === 'ingredient' && data.ingredient) {
      setActiveDragItem({ type: 'panel-ingredient', ingredient: data.ingredient });
    } else if (data.type === 'recipe' && data.recipe) {
      setActiveDragItem({ type: 'panel-recipe', recipe: data.recipe });
    } else if (data.type === 'staged-ingredient' && data.stagedId) {
      setActiveDragItem({ type: 'staged-ingredient', stagedId: data.stagedId });
    } else if (data.type === 'staged-recipe' && data.stagedId) {
      setActiveDragItem({ type: 'staged-recipe', stagedId: data.stagedId });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dragItem = activeDragItem;
      setActiveDragItem(null);

      const { over } = event;

      if (!dragItem) return;

      // Handle dropping new items from panel onto canvas
      if (!over || over.id !== 'canvas-drop-zone') return;

      if (dragItem.type === 'panel-ingredient') {
        // Check if ingredient already exists on canvas
        const existingIndex = stagedIngredients.findIndex(
          (s) => s.ingredient.id === dragItem.ingredient.id
        );

        if (existingIndex >= 0) {
          // Increment quantity of existing ingredient
          setStagedIngredients((prev) =>
            prev.map((item, idx) =>
              idx === existingIndex
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          );
          toast.success(`Increased ${dragItem.ingredient.name} quantity`);
        } else {
          // Add new ingredient - position will be calculated by effect
          const newStaged: StagedIngredient = {
            id: `ing-${Date.now()}-${Math.random()}`,
            ingredient: dragItem.ingredient,
            quantity: 1,
            unit: dragItem.ingredient.base_unit,
            unitPrice: dragItem.ingredient.cost_per_base_unit ?? null,
            wastage_percentage: 0,
            selectedSupplierId: null,
            x: 0, // Placeholder - will be set by position recalculation effect
            y: 0,
          };
          setStagedIngredients((prev) => [...prev, newStaged]);
          fetchSuppliersForIngredient(dragItem.ingredient.id);
          toast.success(`Added ${dragItem.ingredient.name} to canvas`);
        }
      }

      if (dragItem.type === 'panel-recipe') {
        // Check if recipe already exists on canvas
        const existingIndex = stagedRecipes.findIndex(
          (s) => s.recipe.id === dragItem.recipe.id
        );

        if (existingIndex >= 0) {
          // Increment quantity of existing recipe
          setStagedRecipes((prev) =>
            prev.map((item, idx) =>
              idx === existingIndex
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          );
          toast.success(`Increased ${dragItem.recipe.name} quantity`);
        } else {
          // Add new recipe - position will be calculated by effect
          const newStaged: StagedRecipe = {
            id: `rec-${Date.now()}-${Math.random()}`,
            recipe: dragItem.recipe,
            quantity: 1,
            x: 0, // Placeholder - will be set by position recalculation effect
            y: 0,
          };
          setStagedRecipes((prev) => [...prev, newStaged]);
          toast.success(`Added ${dragItem.recipe.name} to canvas`);
        }
      }
    },
    [activeDragItem, stagedIngredients, stagedRecipes]
  );

  const handleRemoveIngredient = useCallback((id: string) => {
    setStagedIngredients((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleRemoveRecipe = useCallback((id: string) => {
    setStagedRecipes((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleIngredientQuantityChange = useCallback((id: string, quantity: number) => {
    setStagedIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const handleIngredientWastageChange = useCallback((id: string, wastage_percentage: number) => {
    setStagedIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, wastage_percentage } : item))
    );
  }, []);

  const handleIngredientUnitChange = useCallback((id: string, newUnit: string) => {
    setStagedIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const converted = convertUnit(item.quantity, item.unit, newUnit);
        const convertedPrice = item.unitPrice != null
          ? convertUnitPrice(item.unitPrice, item.unit, newUnit)
          : null;
        return {
          ...item,
          unit: newUnit,
          quantity: converted != null ? parseFloat(converted.toPrecision(6)) : item.quantity,
          unitPrice: convertedPrice ?? item.unitPrice,
        };
      })
    );
  }, []);

  const handleSupplierSelect = useCallback((id: string, supplierId: number | null) => {
    setStagedIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const suppliers = supplierMap[item.ingredient.id] ?? [];
        // Compute base cost from the new supplier selection
        const updatedStaged = { ...item, selectedSupplierId: supplierId };
        const { cost: baseCost } = getIngredientUnitCost(updatedStaged, suppliers);
        // Convert from supplier's pack_unit (or ingredient base_unit) to the current display unit
        const baseUnit = supplierId != null
          ? (suppliers.find((s) => s.supplier_id === supplierId)?.pack_unit ?? item.ingredient.base_unit)
          : item.ingredient.base_unit;
        const convertedPrice = baseCost != null
          ? (convertUnitPrice(baseCost, baseUnit, item.unit) ?? baseCost)
          : null;
        return { ...updatedStaged, unitPrice: convertedPrice };
      })
    );
  }, [supplierMap]);

  // When suppliers load asynchronously, update unitPrice for staged ingredients that don't have
  // a user-selected supplier (so they pick up the median price)
  useEffect(() => {
    setStagedIngredients((prev) => {
      let changed = false;
      const updated = prev.map((item) => {
        // Only auto-update if no supplier is explicitly selected
        if (item.selectedSupplierId != null) return item;
        const suppliers = supplierMap[item.ingredient.id];
        if (!suppliers || suppliers.length === 0) return item;
        // Compute median supplier cost
        const { cost: baseCost } = getIngredientUnitCost(item, suppliers);
        if (baseCost == null) return item;
        // Convert from ingredient base_unit to current display unit
        const convertedPrice = convertUnitPrice(baseCost, item.ingredient.base_unit, item.unit) ?? baseCost;
        // Only update if the price actually changed
        if (item.unitPrice != null && Math.abs(item.unitPrice - convertedPrice) < 0.0001) return item;
        changed = true;
        return { ...item, unitPrice: convertedPrice };
      });
      return changed ? updated : prev;
    });
  }, [supplierMap]);

  const handleRecipeQuantityChange = useCallback((id: string, quantity: number) => {
    setStagedRecipes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const handleIngredientSelect = useCallback((id: string, ingredientOrRecipe: Ingredient | Recipe): void => {
    // Check if this is actually a recipe (has yield_quantity property)
    const isRecipe = 'yield_quantity' in ingredientOrRecipe;

    if (isRecipe) {
      // Type switch: ingredient -> recipe (quantity set to 1)
      const quantity = 1;

      // Remove from ingredients
      setStagedIngredients((prev) => prev.filter((item) => item.id !== id));

      // Add to recipes
      setStagedRecipes((prev) => {
        const recipe = ingredientOrRecipe as Recipe;
        const existingRecipe = prev.find((item) => item.recipe.id === recipe.id);

        if (existingRecipe) {
          // Merge with existing recipe
          return prev.map((item) =>
            item.id === existingRecipe.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }

        // Add as new recipe
        return [
          ...prev,
          {
            id,
            recipe,
            quantity,
            x: 0,
            y: 0,
          },
        ];
      });
    } else {
      // Ingredient selected - check for duplicates in ingredients
      setStagedIngredients((prev) => {
        const currentItem = prev.find((item) => item.id === id);
        if (!currentItem) return prev;

        const ingredient = ingredientOrRecipe as Ingredient;
        const existingIngredient = prev.find(
          (item) => item.id !== id && item.ingredient.id === ingredient.id
        );

        if (existingIngredient) {
          // Merge: increase quantity of existing item and remove current row
          return prev
            .map((item) =>
              item.id === existingIngredient.id
                ? { ...item, quantity: item.quantity + currentItem.quantity }
                : item
            )
            .filter((item) => item.id !== id);
        }

        // No duplicate found, just update the ingredient (reset unit to match new ingredient)
        return prev.map((item) => (item.id === id ? { ...item, ingredient, unit: ingredient.base_unit } : item));
      });
    }
  }, []);

  const handleRecipeSelect = useCallback((id: string, recipeOrIngredient: Recipe | Ingredient): void => {
    // Check if this is actually an ingredient (no yield_quantity property)
    const isIngredient = !('yield_quantity' in recipeOrIngredient);

    if (isIngredient) {
      // Type switch: recipe -> ingredient (quantity set to 1)
      const quantity = 1;

      // Remove from recipes
      setStagedRecipes((prev) => prev.filter((item) => item.id !== id));

      // Add to ingredients
      setStagedIngredients((prev) => {
        const ingredient = recipeOrIngredient as Ingredient;
        const existingIngredient = prev.find(
          (item) => item.ingredient.id === ingredient.id
        );

        if (existingIngredient) {
          // Merge with existing ingredient
          return prev.map((item) =>
            item.id === existingIngredient.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }

        // Add as new ingredient
        fetchSuppliersForIngredient(ingredient.id);
        return [
          ...prev,
          {
            id,
            ingredient,
            quantity,
            unit: ingredient.base_unit,
            unitPrice: ingredient.cost_per_base_unit ?? null,
            wastage_percentage: 0,
            selectedSupplierId: null,
            x: 0,
            y: 0,
          },
        ];
      });
    } else {
      // Recipe selected - check for duplicates in recipes
      setStagedRecipes((prev) => {
        const currentItem = prev.find((item) => item.id === id);
        if (!currentItem) return prev;

        const recipe = recipeOrIngredient as Recipe;
        const existingRecipe = prev.find(
          (item) => item.id !== id && item.recipe.id === recipe.id
        );

        if (existingRecipe) {
          // Merge: increase quantity of existing item and remove current row
          return prev
            .map((item) =>
              item.id === existingRecipe.id
                ? { ...item, quantity: item.quantity + currentItem.quantity }
                : item
            )
            .filter((item) => item.id !== id);
        }

        // No duplicate found, just update the recipe
        return prev.map((item) => (item.id === id ? { ...item, recipe } : item));
      });
    }
  }, []);

  // Reset to initial loaded state
  const handleReset = useCallback(() => {
    if (!initialState) {
      // No initial state - reset to defaults
      setMetadata(DEFAULT_METADATA);
      setStagedIngredients([]);
      setStagedRecipes([]);
      return;
    }

    // Restore metadata from initial state
    setMetadata(initialState.metadata);

    // Restore ingredients based on initial state
    if (selectedRecipeId && recipeIngredients && initialState.ingredientIds.length > 0) {
      const loadedIngredients: StagedIngredient[] = recipeIngredients.map((ri, index) => {
        const baseUnit = ri.base_unit || ri.unit;
        const rawPrice = ri.unit_price;
        const displayPrice = rawPrice != null && baseUnit !== ri.unit
          ? (convertUnitPrice(rawPrice, baseUnit, ri.unit) ?? rawPrice)
          : rawPrice;
        return {
          id: `existing-ing-${ri.id}`,
          ingredient: ri.ingredient || {
            id: ri.ingredient_id,
            name: `Ingredient #${ri.ingredient_id}`,
            base_unit: ri.unit,
            cost_per_base_unit: ri.unit_price,
            is_active: true,
            is_halal: false,
            category_id: null,
            created_at: '',
            updated_at: '',
          },
          quantity: ri.quantity,
          unit: ri.unit,
          unitPrice: displayPrice ?? null,
          wastage_percentage: ri.wastage_percentage,
          selectedSupplierId: ri.supplier_id ?? null,
          x: 20 + (index % 3) * 220,
          y: 20 + Math.floor(index / 3) * 100,
        };
      });
      setStagedIngredients(loadedIngredients);
    } else {
      setStagedIngredients([]);
    }

    // Restore sub-recipes based on initial state
    if (selectedRecipeId && subRecipes && initialState.recipeIds.length > 0) {
      const loadedSubRecipes: StagedRecipe[] = subRecipes.map((sr, index) => {
        const childRecipe = recipes?.find((r) => r.id === sr.child_recipe_id);
        return {
          id: `existing-rec-${sr.id}`,
          recipe: childRecipe || ({
            id: sr.child_recipe_id,
            name: `Recipe #${sr.child_recipe_id}`,
            instructions_raw: null,
            instructions_structured: null,
            yield_quantity: 1,
            yield_unit: 'portion',
            cost_price: null,
            selling_price_est: null,
            status: 'draft' as const,
            is_prep_recipe: false,
            is_public: false,
            owner_id: null,
            version: 1,
            root_id: null,
            image_url: null,
            description: null,
            summary_feedback: null,
            rnd_started: false,
            review_ready: false,
            created_at: '',
            updated_at: '',
            created_by: '',
          } as Recipe),
          quantity: sr.quantity,
          x: 20 + (index % 3) * 220,
          y: 20 + Math.floor(index / 3) * 100,
        };
      });
      setStagedRecipes(loadedSubRecipes);
    } else {
      setStagedRecipes([]);
    }
  }, [initialState, selectedRecipeId, recipeIngredients, subRecipes, recipes]);

  // Clear all ingredients and recipes from canvas (keep metadata)
  const handleClearAll = useCallback(() => {
    setStagedIngredients([]);
    setStagedRecipes([]);
  }, []);

  // Fork button click handler
  const handleForkClick = useCallback(() => {
    if (stagedIngredients.length === 0 && stagedRecipes.length === 0) {
      toast.error('Add some ingredients or recipes first');
      return;
    }
    if (!selectedRecipeId) {
      toast.error('No recipe selected to fork');
      return;
    }
    setShowForkModal(true);
  }, [stagedIngredients.length, stagedRecipes.length, selectedRecipeId]);

  // Fork confirm handler - creates a new recipe with incremented version
  const handleForkConfirm = useCallback(async () => {
    setShowForkModal(false);
    setIsForking(true);

    const selectedRecipe = selectedRecipeId
      ? recipes?.find((r) => r.id === selectedRecipeId)
      : null;

    if (!selectedRecipe) {
      toast.error('No recipe selected to fork');
      setIsForking(false);
      return;
    }

    // Version is incremented by 1, root_id points to the original recipe
    const version = selectedRecipe.version + 1;
    const root_id = selectedRecipe.id;

    try {
      // Create a new forked recipe with "(Fork)" appended to the name
      const newRecipe = await createRecipe.mutateAsync({
        name: `${metadata.name} (Fork)`,
        yield_quantity: metadata.yield_quantity,
        yield_unit: metadata.yield_unit,
        selling_price_est: metadata.selling_price || null,
        status: metadata.status,
        created_by: userId || undefined,
        is_public: metadata.is_public,
        owner_id: userId || undefined,
        version,
        root_id,
      });

      // Add all staged ingredients to the new recipe
      for (const staged of stagedIngredients) {
        await addIngredient.mutateAsync({
          recipeId: newRecipe.id,
          data: {
            ingredient_id: staged.ingredient.id,
            quantity: staged.quantity,
            unit: staged.unit,
            base_unit: staged.unit,
            unit_price: staged.unitPrice ?? staged.ingredient.cost_per_base_unit ?? 0,
            supplier_id: staged.selectedSupplierId,
            wastage_percentage: staged.wastage_percentage,
          },
        });
      }

      // Add all staged sub-recipes to the new recipe
      for (const staged of stagedRecipes) {
        await addSubRecipe.mutateAsync({
          recipeId: newRecipe.id,
          data: {
            child_recipe_id: staged.recipe.id,
            quantity: staged.quantity,
          },
        });
      }

      // Clear the canvas
      setStagedIngredients([]);
      setStagedRecipes([]);
      setMetadata(DEFAULT_METADATA);

      toast.success(`Recipe forked successfully! Version ${version} created.`);

      // Redirect to the new recipe
      router.push(`/recipes/${newRecipe.id}`);
    } catch {
      toast.error('Failed to fork recipe');
    } finally {
      setIsForking(false);
    }
  }, [selectedRecipeId, recipes, metadata, stagedIngredients, stagedRecipes, createRecipe, addIngredient, addSubRecipe, userId, router]);

  const handleSubmitClick = useCallback(() => {
    if (stagedIngredients.length === 0 && stagedRecipes.length === 0) {
      toast.error('Add some ingredients or recipes first');
      return;
    }

    // Validate all ingredients have at least 1 supplier before publishing
    if (metadata.status === 'active') {
      const ingredientsWithoutSupplier = stagedIngredients.filter(
        (si) => !(supplierMap[si.ingredient.id]?.length > 0)
      );
      if (ingredientsWithoutSupplier.length > 0) {
        const names = ingredientsWithoutSupplier.map((si) => si.ingredient.name).join(', ');
        toast.error(`Cannot publish: the following ingredients have no supplier — ${names}`);
        return;
      }
    }

    setShowSubmitModal(true);
  }, [stagedIngredients, stagedRecipes.length, metadata.status, supplierMap]);

  const handleSubmitConfirm = useCallback(async () => {
    setShowSubmitModal(false);
    setIsSubmitting(true);

    try {
      if (selectedRecipeId) {
        // UPDATE existing recipe
        const recipeId = selectedRecipeId;

        // Capture current server state at the start (these are from React Query cache)
        const serverIngredients = recipeIngredients || [];
        const serverSubRecipes = subRecipes || [];

        // Update recipe metadata
        await updateRecipe.mutateAsync({
          id: recipeId,
          data: {
            name: metadata.name,
            yield_quantity: metadata.yield_quantity,
            yield_unit: metadata.yield_unit,
            status: metadata.status,
            is_public: metadata.is_public,
            cost_price: canvasCost,
            selling_price_est: metadata.selling_price || null,
          },
        });

        // Build maps for efficient lookups
        // Map: ingredient_id -> RecipeIngredient record
        const serverIngredientMap = new Map(
          serverIngredients.map((ri) => [ri.ingredient_id, ri])
        );
        // Map: child_recipe_id -> SubRecipe record
        const serverSubRecipeMap = new Map(
          serverSubRecipes.map((sr) => [sr.child_recipe_id, sr])
        );

        // Get staged ingredient and recipe IDs
        const stagedIngredientIds = new Set(
          stagedIngredients.map((si) => si.ingredient.id)
        );
        const stagedSubRecipeIds = new Set(
          stagedRecipes.map((sr) => sr.recipe.id)
        );

        // Remove ingredients that are no longer staged
        for (const ri of serverIngredients) {
          if (!stagedIngredientIds.has(ri.ingredient_id)) {
            await removeIngredient.mutateAsync({
              recipeId,
              ingredientId: ri.id,
            });
          }
        }

        // Remove sub-recipes that are no longer staged
        for (const sr of serverSubRecipes) {
          if (!stagedSubRecipeIds.has(sr.child_recipe_id)) {
            await removeSubRecipe.mutateAsync({
              recipeId,
              linkId: sr.id,
            });
          }
        }

        // Add or update ingredients
        for (const staged of stagedIngredients) {
          const unit_price = staged.unitPrice ?? staged.ingredient.cost_per_base_unit ?? 0;

          const existingRi = serverIngredientMap.get(staged.ingredient.id);
          if (existingRi) {
            // Update existing ingredient
            await updateIngredient.mutateAsync({
              recipeId,
              ingredientId: existingRi.id,
              data: {
                quantity: staged.quantity,
                unit: staged.unit,
                base_unit: staged.unit,
                unit_price,
                supplier_id: staged.selectedSupplierId,
                wastage_percentage: staged.wastage_percentage,
              },
            });
          } else {
            // Add new ingredient
            await addIngredient.mutateAsync({
              recipeId,
              data: {
                ingredient_id: staged.ingredient.id,
                quantity: staged.quantity,
                unit: staged.unit,
                base_unit: staged.unit,
                unit_price,
                supplier_id: staged.selectedSupplierId,
                wastage_percentage: staged.wastage_percentage,
              },
            });
          }
        }

        // Add or update sub-recipes
        for (const staged of stagedRecipes) {
          const existingSr = serverSubRecipeMap.get(staged.recipe.id);
          if (existingSr) {
            // Update existing sub-recipe
            await updateSubRecipeHook.mutateAsync({
              recipeId,
              linkId: existingSr.id,
              data: {
                quantity: staged.quantity,
              },
            });
          } else {
            // Add new sub-recipe
            await addSubRecipe.mutateAsync({
              recipeId,
              data: {
                child_recipe_id: staged.recipe.id,
                quantity: staged.quantity,
              },
            });
          }
        }

        // Update initial state to match current canvas (so unsaved changes detection resets)
        const ingredientQuantities: Record<string, number> = {};
        stagedIngredients.forEach((ing) => {
          ingredientQuantities[ing.ingredient.id.toString()] = ing.quantity;
        });
        const recipeQuantities: Record<string, number> = {};
        stagedRecipes.forEach((rec) => {
          recipeQuantities[rec.recipe.id.toString()] = rec.quantity;
        });
        setInitialState({
          ingredientIds: stagedIngredients.map((ing) => ing.ingredient.id.toString()),
          ingredientQuantities,
          recipeIds: stagedRecipes.map((rec) => rec.recipe.id.toString()),
          recipeQuantities,
          metadata,
        });

        toast.success('Recipe updated successfully!');
      } else {
        // CREATE new recipe
        const newRecipe = await createRecipe.mutateAsync({
          name: metadata.name,
          yield_quantity: metadata.yield_quantity,
          yield_unit: metadata.yield_unit,
          cost_price: canvasCost,
          selling_price_est: metadata.selling_price || null,
          status: metadata.status,
          created_by: userId || undefined,
          is_public: metadata.is_public,
          owner_id: userId || undefined,
          version: 1,
          root_id: null,
        });

        // Add all staged ingredients
        for (const staged of stagedIngredients) {
          await addIngredient.mutateAsync({
            recipeId: newRecipe.id,
            data: {
              ingredient_id: staged.ingredient.id,
              quantity: staged.quantity,
              unit: staged.unit,
              base_unit: staged.unit,
              unit_price: staged.unitPrice ?? staged.ingredient.cost_per_base_unit ?? 0,
              supplier_id: staged.selectedSupplierId,
              wastage_percentage: staged.wastage_percentage,
            },
          });
        }

        // Add all staged sub-recipes
        for (const staged of stagedRecipes) {
          await addSubRecipe.mutateAsync({
            recipeId: newRecipe.id,
            data: {
              child_recipe_id: staged.recipe.id,
              quantity: staged.quantity,
            },
          });
        }

        toast.success('Recipe created successfully!');

        // Navigate to the new recipe page. The destination page's load effect
        // handles state initialization. No need to reset local state here since
        // the component unmounts during navigation.
        router.push(`/recipes/${newRecipe.id}`);
      }
    } catch {
      toast.error(selectedRecipeId ? 'Failed to update recipe' : 'Failed to create recipe');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    stagedIngredients,
    stagedRecipes,
    metadata,
    createRecipe,
    updateRecipe,
    addIngredient,
    updateIngredient,
    removeIngredient,
    addSubRecipe,
    updateSubRecipeHook,
    removeSubRecipe,
    userId,
    selectedRecipeId,
    recipeIngredients,
    subRecipes,
    router,
    supplierMap,
  ]);

  // Determine if there are  by comparing to initial state
  const hasUnsavedChanges = (() => {
    if (!initialState) {
      // No initial state yet - check if anything has been added
      return (
        stagedIngredients.length > 0 ||
        stagedRecipes.length > 0 ||
        metadata.name !== DEFAULT_METADATA.name ||
        metadata.yield_quantity !== DEFAULT_METADATA.yield_quantity ||
        metadata.yield_unit !== DEFAULT_METADATA.yield_unit ||
        metadata.status !== DEFAULT_METADATA.status ||
        metadata.is_public !== DEFAULT_METADATA.is_public
      );
    }

    // Check metadata changes
    if (
      metadata.name !== initialState.metadata.name ||
      metadata.yield_quantity !== initialState.metadata.yield_quantity ||
      metadata.yield_unit !== initialState.metadata.yield_unit ||
      metadata.status !== initialState.metadata.status ||
      metadata.is_public !== initialState.metadata.is_public
    ) {
      return true;
    }

    // Check ingredient changes (added/removed)
    const currentIngredientIds = stagedIngredients.map((ing) => ing.ingredient.id.toString());
    if (currentIngredientIds.length !== initialState.ingredientIds.length) {
      return true;
    }
    const ingredientIdsMatch =
      currentIngredientIds.every((id) => initialState.ingredientIds.includes(id)) &&
      initialState.ingredientIds.every((id) => currentIngredientIds.includes(id));
    if (!ingredientIdsMatch) {
      return true;
    }

    // Check ingredient quantity changes
    for (const ing of stagedIngredients) {
      const initialQty = initialState.ingredientQuantities[ing.ingredient.id.toString()];
      if (initialQty !== ing.quantity) {
        return true;
      }
    }

    // Check recipe changes (added/removed)
    const currentRecipeIds = stagedRecipes.map((rec) => rec.recipe.id.toString());
    if (currentRecipeIds.length !== initialState.recipeIds.length) {
      return true;
    }
    const recipeIdsMatch =
      currentRecipeIds.every((id) => initialState.recipeIds.includes(id)) &&
      initialState.recipeIds.every((id) => currentRecipeIds.includes(id));
    if (!recipeIdsMatch) {
      return true;
    }

    // Check recipe quantity changes
    for (const rec of stagedRecipes) {
      const initialQty = initialState.recipeQuantities[rec.recipe.id.toString()];
      if (initialQty !== rec.quantity) {
        return true;
      }
    }

    return false;
  })();

  // Sync unsaved changes state to the global store for tab switching prompt
  const { setCanvasHasUnsavedChanges } = useAppState();
  useEffect(() => {
    setCanvasHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setCanvasHasUnsavedChanges]);

  // Register save handler for "Save & Leave" modal — module-level to avoid re-render loops
  const handleSubmitConfirmRef = useRef(handleSubmitConfirm);
  handleSubmitConfirmRef.current = handleSubmitConfirm;
  useEffect(() => {
    setCanvasSaveHandler(() => handleSubmitConfirmRef.current());
    return () => setCanvasSaveHandler(null);
  }, []);

  const canvasContent = (
    <CanvasContent
      stagedIngredients={stagedIngredients}
      stagedRecipes={stagedRecipes}
      metadata={metadata}
      onMetadataChange={handleMetadataChange}
      onRemoveIngredient={handleRemoveIngredient}
      onRemoveRecipe={handleRemoveRecipe}
      onIngredientQuantityChange={handleIngredientQuantityChange}
      onIngredientWastageChange={handleIngredientWastageChange}
      onIngredientUnitChange={handleIngredientUnitChange}
      onSupplierSelect={handleSupplierSelect}
      supplierMap={supplierMap}
      onRecipeQuantityChange={handleRecipeQuantityChange}
      onIngredientSelect={handleIngredientSelect}
      onRecipeSelect={handleRecipeSelect}
      onSubmit={handleSubmitClick}
      onFork={handleForkClick}
      onReset={handleReset}
      onClearAll={handleClearAll}
      isSubmitting={isSubmitting}
      isForking={isForking}
      canvasRef={canvasRef}
      rootRecipeName={(() => {
        const selectedRecipe = selectedRecipeId ? recipes?.find((r) => r.id === selectedRecipeId) : null;
        if (!selectedRecipe?.root_id) return null;
        return recipes?.find((r) => r.id === selectedRecipe.root_id)?.name ?? null;
      })()}
      currentVersion={(() => {
        const selectedRecipe = selectedRecipeId ? recipes?.find((r) => r.id === selectedRecipeId) : null;
        return selectedRecipe?.version ?? null;
      })()}
      allRecipes={recipes}
      allIngredients={ingredients}
      hasUnsavedChanges={hasUnsavedChanges}
      hasSelectedRecipe={selectedRecipeId !== null}
      isOwner={(() => {
        if (userType === 'admin') return true; // Admins bypass ownership restrictions
        if (!selectedRecipeId) return true; // Creating new recipe, user is the owner
        const selectedRecipe = recipes?.find((r) => r.id === selectedRecipeId);
        return selectedRecipe?.owner_id === userId;
      })()}
      viewMode={canvasViewMode}
      onViewModeChange={setCanvasViewMode}
      categoryMap={categoryMap}
      canvasCost={canvasCost}
      getOutletNamesForRecipe={getOutletNamesForRecipe}
      getCategoryNamesForRecipe={getCategoryNamesForRecipe}
      onShowAddIngredientsModal={() => setShowAddIngredientsModal(true)}
    />
  );

  return (
    <>
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={isDragDropEnabled ? handleDragStart : undefined}
        onDragEnd={isDragDropEnabled ? handleDragEnd : undefined}
      >
        <div className="flex h-full w-full">
          {canvasContent}
          <RightPanel outlets={outlets} />
        </div>
        {isDragDropEnabled && (
          <DragOverlay>
            {activeDragItem && (
              <DragOverlayContent
                item={activeDragItem}
                stagedIngredients={stagedIngredients}
                stagedRecipes={stagedRecipes}
              />
            )}
          </DragOverlay>
        )}
      </DndContext>

      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitConfirm}
        title={selectedRecipeId ? 'Update Recipe' : 'Create Recipe'}
        message={
          selectedRecipeId
            ? `Are you sure you want to update "${metadata.name}" with ${stagedIngredients.length} ingredient(s) and ${stagedRecipes.length} sub-recipe(s)?`
            : `Are you sure you want to create "${metadata.name}" with ${stagedIngredients.length} ingredient(s) and ${stagedRecipes.length} sub-recipe(s)?`
        }
        confirmLabel={selectedRecipeId ? 'Update' : 'Create'}
        cancelLabel="Cancel"
      />

      <ConfirmModal
        isOpen={showForkModal}
        onClose={() => setShowForkModal(false)}
        onConfirm={handleForkConfirm}
        title="Fork Recipe"
        message={`Are you sure you want to fork "${metadata.name}"? This will create a new version (v${(recipes?.find((r) => r.id === selectedRecipeId)?.version ?? 0) + 1}) based on the current recipe.`}
        confirmLabel="Fork"
        cancelLabel="Cancel"
      />

      <Modal
        isOpen={showAddIngredientsModal}
        onClose={() => setShowAddIngredientsModal(false)}
        title="Add Ingredients"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <textarea
            value={addIngredientsText}
            onChange={(e) => setAddIngredientsText(e.target.value)}
            placeholder="Enter ingredients (one per line or comma-separated)"
            className="w-full h-48 p-3 border border-zinc-300 rounded-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddIngredientsModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!addIngredientsText.trim()) {
                  toast.error('Please enter ingredients');
                  return;
                }

                const parsedLines = parseIngredientsText(addIngredientsText);
                if (parsedLines.length === 0) {
                  toast.error('No valid ingredients found');
                  return;
                }

                const unmatchedIngredients: string[] = [];
                const newIngredientsToAdd: StagedIngredient[] = [];

                // Process each parsed line
                for (const parsed of parsedLines) {
                  const matchedIngredient = fuzzyMatchIngredient(
                    parsed.ingredientText,
                    (ingredients || []) as unknown as Array<{ id: number; name: string; [key: string]: unknown }>
                  ) as Ingredient | null;

                  if (!matchedIngredient) {
                    unmatchedIngredients.push(
                      `${parsed.ingredientText}${parsed.quantity ? ` (${parsed.quantity}${parsed.unit})` : ''}`
                    );
                    continue;
                  }

                  // Check if this ingredient already exists on canvas
                  const existingIndex = stagedIngredients.findIndex(
                    (s) => s.ingredient.id === matchedIngredient.id
                  );

                  if (existingIndex >= 0) {
                    // Increment quantity if exists
                    setStagedIngredients((prev) =>
                      prev.map((item, idx) =>
                        idx === existingIndex
                          ? { ...item, quantity: item.quantity + parsed.quantity }
                          : item
                      )
                    );
                  } else {
                    // Add new ingredient
                    const newStaged: StagedIngredient = {
                      id: `ing-${Date.now()}-${Math.random()}`,
                      ingredient: matchedIngredient,
                      quantity: parsed.quantity,
                      unit: matchedIngredient.base_unit,
                      unitPrice: matchedIngredient.cost_per_base_unit ?? null,
                      wastage_percentage: 0,
                      selectedSupplierId: null,
                      x: 0,
                      y: 0,
                    };
                    newIngredientsToAdd.push(newStaged);
                    fetchSuppliersForIngredient(matchedIngredient.id);
                  }
                }

                // Add new ingredients to state
                if (newIngredientsToAdd.length > 0) {
                  setStagedIngredients((prev) => [...prev, ...newIngredientsToAdd]);
                }

                // Show feedback
                const totalAdded = newIngredientsToAdd.length +
                  parsedLines.filter(p =>
                    stagedIngredients.some(s => s.ingredient.id === (fuzzyMatchIngredient(p.ingredientText, (ingredients || []) as unknown as Array<{ id: number; name: string; [key: string]: unknown }>) as Ingredient | null)?.id)
                  ).length;

                if (totalAdded > 0) {
                  toast.success(`Added ${totalAdded} ingredient${totalAdded !== 1 ? 's' : ''}`);
                }

                if (unmatchedIngredients.length > 0) {
                  toast.warning(
                    `${unmatchedIngredients.length} ingredient${unmatchedIngredients.length !== 1 ? 's' : ''} not found: ${unmatchedIngredients.join(', ')}`
                  );
                }

                // Clear and close modal
                setAddIngredientsText('');
                setShowAddIngredientsModal(false);
              }}
            >
              Add Ingredients
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
