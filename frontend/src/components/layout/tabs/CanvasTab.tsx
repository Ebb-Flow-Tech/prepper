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
import { GripVertical, X, ChevronDown, ChevronUp, ImagePlus, Minus, Grid3x3, List } from 'lucide-react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';
import {
  useRecipes,
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
} from '@/lib/hooks';
import { useAutoFlowLayout } from '@/lib/hooks/useAutoFlowLayout';
import { Button, Input, Select, ConfirmModal, Switch } from '@/components/ui';
import { toast } from 'sonner';
import type { RecipeStatus } from '@/types';
import { RightPanel } from '../RightPanel';
import type { Ingredient, Recipe } from '@/types';

// Staged item with position on canvas
interface StagedIngredient {
  id: string; // unique id for this staged item
  ingredient: Ingredient;
  quantity: number;
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
}

const DEFAULT_METADATA: RecipeMetadata = {
  name: 'Untitled Recipe',
  yield_quantity: 10,
  yield_unit: 'portion',
  status: 'draft',
  is_public: false,
};

// Grid configuration for auto-flow layout - responsive based on screen width
const getGridConfig = (screenWidth: number) => {
  // Adjust columns based on available width
  // Each card is 224px + 16px gap, plus padding
  const availableWidth = screenWidth - 40; // 40px for padding (20px each side)
  const itemWidth = 224 + 16; // card width + gap

  // Calculate how many columns fit
  let columns = Math.floor(availableWidth / itemWidth);

  // Clamp between 1 and 4 columns
  columns = Math.max(1, Math.min(4, columns));

  return {
    columns,
    cardWidth: 224, // w-56
    cardGap: 16,    // gap-4
    rowHeight: 400, // Increased to prevent overlaps (accounts for collapsed + some expanded cards)
    padding: 20,
  };
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
            <img src={item.recipe.image_url} alt={item.recipe.name} className="h-full w-full object-cover" />
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
          <span className="game-card-stat game-card-stat-ingredient">{staged.ingredient.base_unit}</span>
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
            <img src={staged.recipe.image_url} alt={staged.recipe.name} className="h-full w-full object-cover" />
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
  categoryMap,
}: {
  staged: StagedIngredient;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  categoryMap: Record<number, string>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staged-ingredient-${staged.id}`,
    data: { type: 'staged-ingredient', stagedId: staged.id },
  });

  const categoryName = staged.ingredient.category_id ? categoryMap[staged.ingredient.category_id] : null;

  const style = {
    position: 'absolute' as const,
    left: staged.x,
    top: staged.y,
    transition: isDragging ? 'none' : 'left 0.3s ease-out, top 0.3s ease-out',
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isExpanded ? 10 : 1,
  };

  const suppliers = staged.ingredient.suppliers || [];
  const preferredSupplier = suppliers.find((s) => s.is_preferred);
  const unitCost = preferredSupplier?.cost_per_unit ?? staged.ingredient.cost_per_base_unit;

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
            <span className="game-card-stat game-card-stat-ingredient">{staged.ingredient.base_unit}</span>
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
          {preferredSupplier ? (
            <span>{preferredSupplier.supplier_name} • ${preferredSupplier.cost_per_unit.toFixed(2)}/{preferredSupplier.pack_unit}</span>
          ) : suppliers.length > 0 ? (
            <span>{suppliers[0].supplier_name} • ${suppliers[0].cost_per_unit.toFixed(2)}/{suppliers[0].pack_unit}</span>
          ) : (
            <span className="text-blue-300/50">No supplier</span>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-blue-400/20 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-blue-300/60">Unit Cost</span>
              <span className="text-blue-100 font-medium">
                {unitCost != null ? `$${unitCost.toFixed(2)}/${staged.ingredient.base_unit}` : 'N/A'}
              </span>
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
                        ${supplier.cost_per_unit.toFixed(2)}/{supplier.pack_unit}
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
  categoryMap,
}: {
  staged: StagedIngredient;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  categoryMap: Record<number, string>;
}) {
  const suppliers = staged.ingredient.suppliers || [];
  const preferredSupplier = suppliers.find((s) => s.is_preferred);
  const categoryName = staged.ingredient.category_id ? categoryMap[staged.ingredient.category_id] : null;

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-zinc-900 dark:text-white truncate">{staged.ingredient.name}</h4>
        <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 space-y-1">
          <div className="flex items-center gap-2">
            <span>Base Unit: {staged.ingredient.base_unit}</span>
            {categoryName && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 truncate">
                {categoryName}
              </span>
            )}
          </div>
          {preferredSupplier ? (
            <div>{preferredSupplier.supplier_name} • ${preferredSupplier.cost_per_unit.toFixed(2)}/{preferredSupplier.pack_unit}</div>
          ) : suppliers.length > 0 ? (
            <div>{suppliers[0].supplier_name} • ${suppliers[0].cost_per_unit.toFixed(2)}/{suppliers[0].pack_unit}</div>
          ) : (
            <div className="text-zinc-400">No supplier</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
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
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{staged.ingredient.base_unit}</span>
        </div>
        <button
          onClick={onRemove}
          className="rounded p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function StagedRecipeListItem({
  staged,
  onRemove,
  onQuantityChange,
  allRecipes,
}: {
  staged: StagedRecipe;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  allRecipes?: Recipe[];
}) {
  const { data: recipeIngredients } = useRecipeIngredients(staged.recipe.id);
  const { data: subRecipes } = useSubRecipes(staged.recipe.id);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-zinc-900 dark:text-white truncate">{staged.recipe.name}</h4>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Yield: {staged.recipe.yield_quantity} {staged.recipe.yield_unit}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
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
            <span className="text-sm text-zinc-500 dark:text-zinc-400">portion</span>
          </div>
          <button
            onClick={onRemove}
            className="rounded p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Ingredients Section */}
      {recipeIngredients && recipeIngredients.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
          <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Ingredients:</h5>
          <ul className="space-y-1.5 text-sm">
            {recipeIngredients.map((ri) => {
              const ingredient = ri.ingredient;
              const suppliers = ingredient?.suppliers || [];
              const preferredSupplier = suppliers.find((s) => s.is_preferred);
              return (
                <li key={ri.id} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{ingredient?.name || `Ingredient #${ri.ingredient_id}`} ({ri.quantity} {ri.base_unit || ri.unit})</span>
                  <span className="text-zinc-500">@ ${ri.unit_price?.toFixed(2) ?? 'N/A'}/{ri.base_unit || ri.unit}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Sub-Recipes Section */}
      {subRecipes && subRecipes.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
          <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Sub-Recipes:</h5>
          <ul className="space-y-1.5 text-sm">
            {subRecipes.map((sr) => {
              const childRecipe = allRecipes?.find((r) => r.id === sr.child_recipe_id);
              return (
                <li key={sr.id} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{childRecipe?.name || `Recipe #${sr.child_recipe_id}`}</span>
                  <span className="text-zinc-500">{sr.quantity} {sr.unit}</span>
                </li>
              );
            })}
          </ul>
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
}: {
  staged: StagedRecipe;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  allRecipes?: Recipe[];
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
    position: 'absolute' as const,
    left: staged.x,
    top: staged.y,
    transition: isDragging ? 'none' : 'left 0.3s ease-out, top 0.3s ease-out',
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
          <img
            src={staged.recipe.image_url}
            alt={staged.recipe.name}
            className="absolute inset-0 h-full w-full object-cover"
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
                    const suppliers = ingredient?.suppliers || [];
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

function CanvasDropZone({
  stagedIngredients,
  stagedRecipes,
  onRemoveIngredient,
  onRemoveRecipe,
  onIngredientQuantityChange,
  onRecipeQuantityChange,
  canvasRef,
  allRecipes,
  gridConfig,
  viewMode = 'grid',
  categoryMap,
}: {
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: (id: string) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onRecipeQuantityChange: (id: string, quantity: number) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  allRecipes?: Recipe[];
  gridConfig: ReturnType<typeof getGridConfig>;
  viewMode?: 'grid' | 'list';
  categoryMap: Record<number, string>;
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
      className={`relative flex-1 min-h-[500px] overflow-auto rounded-lg border-2 border-dashed transition-colors mb-4 ${isOver
          ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30'
          : 'border-zinc-300 dark:border-zinc-700'
        } ${viewMode === 'list' ? 'flex flex-col' : ''}`}
      style={viewMode === 'grid' ? {
        position: 'relative',
        padding: '20px',
      } : {
        position: 'relative',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!hasItems && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-zinc-400 dark:text-zinc-500">
            Drag ingredients and recipes here from the right panel
          </p>
        </div>
      )}
      {viewMode === 'grid' ? (
        <>
          {stagedIngredients.map((staged) => (
            <StagedIngredientCard
              key={staged.id}
              staged={staged}
              onRemove={() => onRemoveIngredient(staged.id)}
              onQuantityChange={(q) => onIngredientQuantityChange(staged.id, q)}
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
            />
          ))}
        </>
      ) : (
        <div className="space-y-3">
          {stagedIngredients.map((staged) => (
            <StagedIngredientListItem
              key={staged.id}
              staged={staged}
              onRemove={() => onRemoveIngredient(staged.id)}
              onQuantityChange={(q) => onIngredientQuantityChange(staged.id, q)}
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
  onRecipeQuantityChange,
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
  hasUnsavedChanges,
  hasSelectedRecipe,
  isOwner,
  gridConfig,
  isDragDropEnabled,
  onDragDropEnabledChange,
  viewMode,
  onViewModeChange,
  categoryMap,
}: {
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
  metadata: RecipeMetadata;
  onMetadataChange: (updates: Partial<RecipeMetadata>) => void;
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: (id: string) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onRecipeQuantityChange: (id: string, quantity: number) => void;
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
  hasUnsavedChanges: boolean;
  hasSelectedRecipe: boolean;
  isOwner: boolean;
  gridConfig: ReturnType<typeof getGridConfig>;
  isDragDropEnabled: boolean;
  onDragDropEnabledChange: (enabled: boolean) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  categoryMap: Record<number, string>;
}) {
  const hasItems = stagedIngredients.length > 0 || stagedRecipes.length > 0;

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Recipe Metadata Header */}
        <div className="mb-6 space-y-4">
          <div>
            <Input
              value={metadata.name}
              onChange={(e) => onMetadataChange({ name: e.target.value })}
              placeholder="Recipe name"
              className="text-lg font-semibold h-12"
            />
            {(rootRecipeName || currentVersion) && (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                {<>Based on: {rootRecipeName ? rootRecipeName : "N/A "}</>}
                {currentVersion && <> . Version {currentVersion}</>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-500">Yield:</label>
              <Input
                type="number"
                value={metadata.yield_quantity}
                onChange={(e) =>
                  onMetadataChange({ yield_quantity: parseFloat(e.target.value) || 0 })
                }
                className="w-20"
                min="0"
                step="1"
              />
              <Input
                value={metadata.yield_unit}
                onChange={(e) => onMetadataChange({ yield_unit: e.target.value })}
                placeholder="unit"
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-500">Status:</label>
              <Select
                value={metadata.status}
                onChange={(e) => onMetadataChange({ status: e.target.value as RecipeStatus })}
                options={STATUS_OPTIONS}
                className="w-28"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={metadata.is_public}
                onChange={(e) => onMetadataChange({ is_public: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
              />
              <span className="text-sm text-zinc-500">Public</span>
            </label>
            <div className="flex items-center gap-2">
              <Switch
                checked={isDragDropEnabled}
                onChange={(e) => onDragDropEnabledChange(e.currentTarget.checked)}
              />
              <span className="text-sm text-zinc-500">Drag & Drop</span>
            </div>
            <div className="flex items-center gap-2 border-l border-zinc-300 dark:border-zinc-700 pl-4">
              <label className="text-sm text-zinc-500">View:</label>
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded ${
                  viewMode === 'grid'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded ${
                  viewMode === 'list'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500 mb-4">
          Drag ingredients and recipes from the right panel to build your recipe
        </p>
        <CanvasDropZone
          stagedIngredients={stagedIngredients}
          stagedRecipes={stagedRecipes}
          onRemoveIngredient={onRemoveIngredient}
          onRemoveRecipe={onRemoveRecipe}
          onIngredientQuantityChange={onIngredientQuantityChange}
          onRecipeQuantityChange={onRecipeQuantityChange}
          canvasRef={canvasRef}
          allRecipes={allRecipes}
          gridConfig={gridConfig}
          viewMode={viewMode}
          categoryMap={categoryMap}
        />
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            {stagedIngredients.length} ingredient{stagedIngredients.length !== 1 ? 's' : ''},{' '}
            {stagedRecipes.length} item{stagedRecipes.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
            <Button
              variant="outline"
              onClick={onReset}
            >
              Reset
            </Button>
            <Button
              variant="outline"
              onClick={onClearAll}
              className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              Clear All
            </Button>
            {hasSelectedRecipe && (
              <Button
                variant="outline"
                onClick={onFork}
                disabled={!hasItems || isForking}
                className="border-purple-500 text-purple-500 hover:bg-purple-50 hover:text-purple-600 dark:border-purple-500 dark:text-purple-500 dark:hover:bg-purple-950 dark:hover:text-purple-400"
              >
                {isForking ? 'Forking...' : 'Fork'}
              </Button>
            )}
            <Button onClick={onSubmit} disabled={!hasItems || isSubmitting || (hasSelectedRecipe && !isOwner)}>
              {isSubmitting
                ? hasSelectedRecipe
                  ? 'Updating...'
                  : 'Creating...'
                : hasSelectedRecipe
                  ? 'Update'
                  : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CanvasTab() {
  const router = useRouter();
  const { userId, selectedRecipeId, userType, isDragDropEnabled, setIsDragDropEnabled, canvasViewMode, setCanvasViewMode } = useAppState();
  const { data: recipes } = useRecipes();
  const { data: recipeIngredients } = useRecipeIngredients(selectedRecipeId);
  const { data: subRecipes } = useSubRecipes(selectedRecipeId);
  const { data: categories } = useCategories();

  // Create a mapping of category ID to name for efficient lookups
  const categoryMap = useMemo(() => {
    if (!categories) return {} as Record<number, string>;
    return categories.reduce<Record<number, string>>((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {});
  }, [categories]);

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
  const [loadedRecipeId, setLoadedRecipeId] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<RecipeMetadata>(DEFAULT_METADATA);

  // Track initial state for unsaved changes detection
  const [initialState, setInitialState] = useState<{
    ingredientIds: string[];
    ingredientQuantities: Record<string, number>;
    recipeIds: string[];
    recipeQuantities: Record<string, number>;
    metadata: RecipeMetadata;
  } | null>(null);

  // Track grid columns (only the count, not full width to avoid unnecessary recalculations)
  const [gridColumns, setGridColumns] = useState(() => {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    return getGridConfig(screenWidth).columns;
  });

  // Update grid columns on resize
  useEffect(() => {
    const handleResize = () => {
      const newColumns = getGridConfig(window.innerWidth).columns;
      setGridColumns(newColumns);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          x: 0,
          y: 0,
        };
        setStagedIngredients((prev) => [...prev, newStaged]);
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

  // Initialize auto-flow layout hook with responsive config
  const totalItems = stagedIngredients.length + stagedRecipes.length;
  const gridConfig = useMemo(
    () => ({
      columns: gridColumns,
      cardWidth: 224,
      cardGap: 16,
      rowHeight: 400,
      padding: 20,
    }),
    [gridColumns]
  );
  const { calculatePosition } = useAutoFlowLayout(totalItems, gridConfig);

  const handleMetadataChange = useCallback((updates: Partial<RecipeMetadata>) => {
    setMetadata((prev) => ({ ...prev, ...updates }));
  }, []);

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
    const selectedRecipe = recipes?.find((r) => r.id === selectedRecipeId);
    const loadedMetadata: RecipeMetadata = selectedRecipe
      ? {
        name: selectedRecipe.name,
        yield_quantity: selectedRecipe.yield_quantity,
        yield_unit: selectedRecipe.yield_unit,
        status: selectedRecipe.status,
        is_public: selectedRecipe.is_public,
      }
      : DEFAULT_METADATA;

    setMetadata(loadedMetadata);

    // Load ingredients onto canvas
    const loadedIngredients: StagedIngredient[] = recipeIngredients.map((ri) => ({
      id: `existing-ing-${ri.id}`,
      ingredient: ri.ingredient || {
        id: ri.ingredient_id,
        name: `Ingredient #${ri.ingredient_id}`,
        base_unit: ri.unit,
        cost_per_base_unit: ri.unit_price,
        is_active: true,
        category_id: null,
        created_at: '',
        updated_at: '',
      },
      quantity: ri.quantity,
      x: 0, // Placeholder - will be set by position recalculation effect
      y: 0,
    }));

    // Load sub-recipes onto canvas
    const loadedSubRecipes: StagedRecipe[] = subRecipes.map((sr) => {
      const childRecipe = recipes?.find((r) => r.id === sr.child_recipe_id);
      return {
        id: `existing-rec-${sr.id}`,
        recipe: childRecipe || {
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
          summary_feedback: null,
          created_at: '',
          updated_at: '',
          created_by: '',
        },
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
  }, [selectedRecipeId, recipeIngredients, subRecipes, recipes, loadedRecipeId]);

  // Recalculate ingredient positions when items change or grid columns change
  useEffect(() => {
    if (stagedIngredients.length === 0) return;
    setStagedIngredients((prev) =>
      prev.map((item, index) => ({
        ...item,
        ...calculatePosition(index),
      }))
    );
  }, [stagedIngredients.length, gridColumns, loadedRecipeId]); // Also depend on loadedRecipeId to trigger recalc after recipe reload

  // Recalculate recipe positions when items change or grid columns change (offset by ingredient count)
  useEffect(() => {
    if (stagedRecipes.length === 0) return;
    const offset = stagedIngredients.length;
    setStagedRecipes((prev) =>
      prev.map((item, index) => ({
        ...item,
        ...calculatePosition(offset + index),
      }))
    );
  }, [stagedRecipes.length, stagedIngredients.length, gridColumns, loadedRecipeId]); // Also depend on loadedRecipeId to trigger recalc after recipe reload

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
            x: 0, // Placeholder - will be set by position recalculation effect
            y: 0,
          };
          setStagedIngredients((prev) => [...prev, newStaged]);
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

  const handleRecipeQuantityChange = useCallback((id: string, quantity: number) => {
    setStagedRecipes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
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
      const loadedIngredients: StagedIngredient[] = recipeIngredients.map((ri, index) => ({
        id: `existing-ing-${ri.id}`,
        ingredient: ri.ingredient || {
          id: ri.ingredient_id,
          name: `Ingredient #${ri.ingredient_id}`,
          base_unit: ri.unit,
          cost_per_base_unit: ri.unit_price,
          is_active: true,
          category_id: null,
          created_at: '',
          updated_at: '',
        },
        quantity: ri.quantity,
        x: 20 + (index % 3) * 220,
        y: 20 + Math.floor(index / 3) * 100,
      }));
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
          recipe: childRecipe || {
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
            created_at: '',
            updated_at: '',
            created_by: '',
          },
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
        status: metadata.status,
        created_by: userId || undefined,
        is_public: metadata.is_public,
        owner_id: userId || undefined,
        version,
        root_id,
      });

      // Add all staged ingredients to the new recipe
      for (const staged of stagedIngredients) {
        const preferredSupplier = staged.ingredient.suppliers?.find((s) => s.is_preferred);
        const base_unit = preferredSupplier?.pack_unit ?? staged.ingredient.base_unit;
        const unit_price =
          preferredSupplier?.cost_per_unit ?? staged.ingredient.cost_per_base_unit ?? 0;
        const supplier_id = preferredSupplier
          ? parseInt(preferredSupplier.supplier_id, 10)
          : null;

        await addIngredient.mutateAsync({
          recipeId: newRecipe.id,
          data: {
            ingredient_id: staged.ingredient.id,
            quantity: staged.quantity,
            unit: base_unit,
            base_unit,
            unit_price,
            supplier_id,
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
    setShowSubmitModal(true);
  }, [stagedIngredients.length, stagedRecipes.length]);

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
          const preferredSupplier = staged.ingredient.suppliers?.find((s) => s.is_preferred);
          const base_unit = preferredSupplier?.pack_unit ?? staged.ingredient.base_unit;
          const unit_price =
            preferredSupplier?.cost_per_unit ?? staged.ingredient.cost_per_base_unit ?? 0;
          const supplier_id = preferredSupplier
            ? parseInt(preferredSupplier.supplier_id, 10)
            : null;

          const existingRi = serverIngredientMap.get(staged.ingredient.id);
          if (existingRi) {
            // Update existing ingredient
            await updateIngredient.mutateAsync({
              recipeId,
              ingredientId: existingRi.id,
              data: {
                quantity: staged.quantity,
                unit: base_unit,
                base_unit,
                unit_price,
                supplier_id,
              },
            });
          } else {
            // Add new ingredient
            await addIngredient.mutateAsync({
              recipeId,
              data: {
                ingredient_id: staged.ingredient.id,
                quantity: staged.quantity,
                unit: base_unit,
                base_unit,
                unit_price,
                supplier_id,
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

        // Reset loaded recipe to force reload of data
        setLoadedRecipeId(null);

        toast.success('Recipe updated successfully!');
      } else {
        // CREATE new recipe
        const newRecipe = await createRecipe.mutateAsync({
          name: metadata.name,
          yield_quantity: metadata.yield_quantity,
          yield_unit: metadata.yield_unit,
          status: metadata.status,
          created_by: userId || undefined,
          is_public: metadata.is_public,
          owner_id: userId || undefined,
          version: 1,
          root_id: null,
        });

        // Add all staged ingredients
        for (const staged of stagedIngredients) {
          const preferredSupplier = staged.ingredient.suppliers?.find((s) => s.is_preferred);
          const base_unit = preferredSupplier?.pack_unit ?? staged.ingredient.base_unit;
          const unit_price =
            preferredSupplier?.cost_per_unit ?? staged.ingredient.cost_per_base_unit ?? 0;
          const supplier_id = preferredSupplier
            ? parseInt(preferredSupplier.supplier_id, 10)
            : null;

          await addIngredient.mutateAsync({
            recipeId: newRecipe.id,
            data: {
              ingredient_id: staged.ingredient.id,
              quantity: staged.quantity,
              unit: base_unit,
              base_unit,
              unit_price,
              supplier_id,
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

        // Clear the canvas
        setStagedIngredients([]);
        setStagedRecipes([]);
        setMetadata(DEFAULT_METADATA);

        toast.success('Recipe created successfully!');

        // Redirect to the new recipe
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

  const canvasContent = (
    <CanvasContent
      stagedIngredients={stagedIngredients}
      stagedRecipes={stagedRecipes}
      metadata={metadata}
      onMetadataChange={handleMetadataChange}
      onRemoveIngredient={handleRemoveIngredient}
      onRemoveRecipe={handleRemoveRecipe}
      onIngredientQuantityChange={handleIngredientQuantityChange}
      onRecipeQuantityChange={handleRecipeQuantityChange}
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
      hasUnsavedChanges={hasUnsavedChanges}
      hasSelectedRecipe={selectedRecipeId !== null}
      isOwner={(() => {
        if (userType === 'admin') return true; // Admins bypass ownership restrictions
        if (!selectedRecipeId) return true; // Creating new recipe, user is the owner
        const selectedRecipe = recipes?.find((r) => r.id === selectedRecipeId);
        return selectedRecipe?.owner_id === userId;
      })()}
      gridConfig={gridConfig}
      isDragDropEnabled={isDragDropEnabled}
      onDragDropEnabledChange={setIsDragDropEnabled}
      viewMode={canvasViewMode}
      onViewModeChange={setCanvasViewMode}
      categoryMap={categoryMap}
    />
  );

  return (
    <>
      {isDragDropEnabled ? (
        <DndContext
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {canvasContent}
          <RightPanel />
          <DragOverlay>
            {activeDragItem && (
              <DragOverlayContent
                item={activeDragItem}
                stagedIngredients={stagedIngredients}
                stagedRecipes={stagedRecipes}
              />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          {canvasContent}
          <RightPanel />
        </>
      )}

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
    </>
  );
}
