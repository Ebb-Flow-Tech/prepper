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
import { GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';
import {
  useRecipes,
  useCreateRecipe,
  useAddRecipeIngredient,
  useAddSubRecipe,
  useRecipeIngredients,
  useSubRecipes,
} from '@/lib/hooks';
import { Button, Input, Select, ConfirmModal } from '@/components/ui';
import { toast } from 'sonner';
import type { RecipeStatus } from '@/types';
import { LeftPanel } from '../LeftPanel';
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
      <div className="flex items-center gap-2 rounded-lg border border-blue-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
        <GripVertical className="h-4 w-4 text-zinc-400" />
        <div>
          <p className="font-medium">{item.ingredient.name}</p>
          <p className="text-sm text-zinc-500">{item.ingredient.base_unit}</p>
        </div>
      </div>
    );
  }

  if (item.type === 'panel-recipe') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
        <GripVertical className="h-4 w-4 text-zinc-400" />
        <div>
          <p className="font-medium">{item.recipe.name}</p>
          <p className="text-sm text-zinc-500">
            {item.recipe.yield_quantity} {item.recipe.yield_unit}
          </p>
        </div>
      </div>
    );
  }

  if (item.type === 'staged-ingredient') {
    const staged = stagedIngredients.find((s) => s.id === item.stagedId);
    if (!staged) return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
        <GripVertical className="h-4 w-4 text-zinc-400" />
        <div>
          <p className="font-medium">{staged.ingredient.name}</p>
          <p className="text-sm text-zinc-500">{staged.ingredient.base_unit}</p>
        </div>
      </div>
    );
  }

  if (item.type === 'staged-recipe') {
    const staged = stagedRecipes.find((s) => s.id === item.stagedId);
    if (!staged) return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-400 bg-white p-3 shadow-lg dark:bg-zinc-800">
        <GripVertical className="h-4 w-4 text-zinc-400" />
        <div>
          <p className="font-medium">{staged.recipe.name}</p>
          <p className="text-sm text-zinc-500">
            {staged.recipe.yield_quantity} {staged.recipe.yield_unit}
          </p>
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
}: {
  staged: StagedIngredient;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staged-ingredient-${staged.id}`,
    data: { type: 'staged-ingredient', stagedId: staged.id },
  });

  const style = {
    position: 'absolute' as const,
    left: staged.x,
    top: staged.y,
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
      className="rounded-lg border border-blue-200 bg-blue-50 shadow-sm dark:border-blue-800 dark:bg-blue-950"
    >
      <div className="flex items-center gap-2 p-3">
        <button {...listeners} {...attributes} className="cursor-grab touch-none">
          <GripVertical className="h-4 w-4 text-zinc-400" />
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 text-left cursor-pointer hover:opacity-80"
        >
          <p className="font-medium text-sm">{staged.ingredient.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={staged.quantity}
              onChange={(e) => {
                e.stopPropagation();
                onQuantityChange(parseFloat(e.target.value) || 0);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              min="0"
              step="0.1"
            />
            <span className="text-xs text-zinc-500">{staged.ingredient.base_unit}</span>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded p-1 text-zinc-400 hover:bg-blue-100 hover:text-zinc-600 dark:hover:bg-blue-900"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onRemove}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-blue-200 dark:border-blue-800 px-3 py-2 text-xs space-y-2">
          <div>
            <span className="text-zinc-500">Unit Cost: </span>
            <span className="font-medium">
              {unitCost != null ? `$${unitCost.toFixed(2)}/${staged.ingredient.base_unit}` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Suppliers: </span>
            {suppliers.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {suppliers.map((supplier) => (
                  <li
                    key={supplier.supplier_id}
                    className={`flex items-center gap-1 ${supplier.is_preferred ? 'font-medium' : ''}`}
                  >
                    <span>{supplier.supplier_name}</span>
                    {supplier.is_preferred && (
                      <span className="text-[10px] bg-blue-200 dark:bg-blue-800 px-1 rounded">
                        preferred
                      </span>
                    )}
                    <span className="text-zinc-400">
                      (${supplier.cost_per_unit.toFixed(2)}/{supplier.pack_unit})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-zinc-400">No suppliers</span>
            )}
          </div>
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
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isExpanded ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-green-200 bg-green-50 shadow-sm dark:border-green-800 dark:bg-green-950 max-w-xs"
    >
      <div className="flex items-center gap-2 p-3">
        <button {...listeners} {...attributes} className="cursor-grab touch-none">
          <GripVertical className="h-4 w-4 text-zinc-400" />
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 text-left cursor-pointer hover:opacity-80"
        >
          <p className="font-medium text-sm">{staged.recipe.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={staged.quantity}
              onChange={(e) => {
                e.stopPropagation();
                onQuantityChange(parseFloat(e.target.value) || 0);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              min="0"
              step="0.1"
            />
            <span className="text-xs text-zinc-500">portion</span>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded p-1 text-zinc-400 hover:bg-green-100 hover:text-zinc-600 dark:hover:bg-green-900"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onRemove}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-green-200 dark:border-green-800 px-3 py-2 text-xs space-y-3 max-h-64 overflow-y-auto">
          {/* Ingredients Section */}
          <div>
            <span className="text-zinc-500 font-medium">Ingredients:</span>
            {recipeIngredients && recipeIngredients.length > 0 ? (
              <ul className="mt-1 space-y-1.5">
                {recipeIngredients.map((ri) => {
                  const ingredient = ri.ingredient;
                  const suppliers = ingredient?.suppliers || [];
                  const preferredSupplier = suppliers.find((s) => s.is_preferred);
                  return (
                    <li key={ri.id} className="bg-white dark:bg-zinc-900 rounded p-1.5">
                      <div className="font-medium">{ingredient?.name || `Ingredient #${ri.ingredient_id}`}</div>
                      <div className="text-zinc-500 flex flex-wrap gap-x-2">
                        <span>{ri.quantity} {ri.base_unit || ri.unit}</span>
                        <span>
                          @ ${ri.unit_price?.toFixed(2) ?? 'N/A'}/{ri.base_unit || ri.unit}
                        </span>
                      </div>
                      {suppliers.length > 0 && (
                        <div className="text-zinc-400 mt-0.5">
                          Supplier: {preferredSupplier?.supplier_name || suppliers[0]?.supplier_name}
                          {preferredSupplier && <span className="ml-1 text-[10px] bg-green-200 dark:bg-green-800 px-1 rounded">preferred</span>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="text-zinc-400 ml-1">No ingredients</span>
            )}
          </div>

          {/* Sub-Recipes Section */}
          {subRecipes && subRecipes.length > 0 && (
            <div>
              <span className="text-zinc-500 font-medium">Sub-Recipes:</span>
              <ul className="mt-1 space-y-1">
                {subRecipes.map((sr) => {
                  const childRecipe = allRecipes?.find((r) => r.id === sr.child_recipe_id);
                  return (
                    <li key={sr.id} className="bg-white dark:bg-zinc-900 rounded p-1.5">
                      <div className="font-medium">{childRecipe?.name || `Recipe #${sr.child_recipe_id}`}</div>
                      <div className="text-zinc-500">
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
}: {
  stagedIngredients: StagedIngredient[];
  stagedRecipes: StagedRecipe[];
  onRemoveIngredient: (id: string) => void;
  onRemoveRecipe: (id: string) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onRecipeQuantityChange: (id: string, quantity: number) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  allRecipes?: Recipe[];
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
      className={`relative flex-1 min-h-[500px] rounded-lg border-2 border-dashed transition-colors mb-4 ${isOver
          ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30'
          : 'border-zinc-300 dark:border-zinc-700'
        }`}
    >
      {!hasItems && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-zinc-400 dark:text-zinc-500">
            Drag ingredients and recipes here from the right panel
          </p>
        </div>
      )}
      {stagedIngredients.map((staged) => (
        <StagedIngredientCard
          key={staged.id}
          staged={staged}
          onRemove={() => onRemoveIngredient(staged.id)}
          onQuantityChange={(q) => onIngredientQuantityChange(staged.id, q)}
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
  onReset,
  onClearAll,
  isSubmitting,
  canvasRef,
  rootRecipeName,
  currentVersion,
  allRecipes,
  hasUnsavedChanges,
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
  onReset: () => void;
  onClearAll: () => void;
  isSubmitting: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  rootRecipeName: string | null;
  currentVersion: number | null;
  allRecipes?: Recipe[];
  hasUnsavedChanges: boolean;
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
              onClick={onReset}            >
              Reset
            </Button>
            <Button
              variant="outline"
              onClick={onClearAll}
              className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              Clear All
            </Button>
            <Button onClick={onSubmit} disabled={!hasItems || isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CanvasTab() {
  const router = useRouter();
  const { userId, selectedRecipeId } = useAppState();
  const { data: recipes } = useRecipes();
  const { data: recipeIngredients } = useRecipeIngredients(selectedRecipeId);
  const { data: subRecipes } = useSubRecipes(selectedRecipeId);

  const createRecipe = useCreateRecipe();
  const addIngredient = useAddRecipeIngredient();
  const addSubRecipe = useAddSubRecipe();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [stagedIngredients, setStagedIngredients] = useState<StagedIngredient[]>([]);
  const [stagedRecipes, setStagedRecipes] = useState<StagedRecipe[]>([]);
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
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
    const loadedIngredients: StagedIngredient[] = recipeIngredients.map((ri, index) => ({
      id: `existing-ing-${ri.id}`,
      ingredient: ri.ingredient || {
        id: ri.ingredient_id,
        name: `Ingredient #${ri.ingredient_id}`,
        base_unit: ri.unit,
        cost_per_base_unit: ri.unit_price,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      quantity: ri.quantity,
      x: 20 + (index % 3) * 220,
      y: 20 + Math.floor(index / 3) * 100,
    }));

    // Load sub-recipes onto canvas
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
          created_at: '',
          updated_at: '',
          created_by: '',
        },
        quantity: sr.quantity,
        x: 20 + (index % 3) * 220,
        y: 20 + Math.floor(index / 3) * 100,
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

      const { over, delta } = event;

      if (!dragItem) return;

      // Handle moving existing staged items
      if (dragItem.type === 'staged-ingredient') {
        setStagedIngredients((prev) =>
          prev.map((item) =>
            item.id === dragItem.stagedId
              ? { ...item, x: item.x + delta.x, y: item.y + delta.y }
              : item
          )
        );
        return;
      }

      if (dragItem.type === 'staged-recipe') {
        setStagedRecipes((prev) =>
          prev.map((item) =>
            item.id === dragItem.stagedId
              ? { ...item, x: item.x + delta.x, y: item.y + delta.y }
              : item
          )
        );
        return;
      }

      // Handle dropping new items from panel onto canvas
      if (!over || over.id !== 'canvas-drop-zone') return;

      // Get the actual drop point using pointer coordinates
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      const pointerEvent = event.activatorEvent as PointerEvent;

      let dropX = 20;
      let dropY = 20;

      if (canvasRect && pointerEvent) {
        // Calculate final pointer position (initial + delta) relative to canvas
        dropX = Math.max(0, pointerEvent.clientX + delta.x - canvasRect.left);
        dropY = Math.max(0, pointerEvent.clientY + delta.y - canvasRect.top);
      }

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
          // Add new ingredient
          const newStaged: StagedIngredient = {
            id: `ing-${Date.now()}-${Math.random()}`,
            ingredient: dragItem.ingredient,
            quantity: 1,
            x: dropX,
            y: dropY,
          };
          setStagedIngredients((prev) => [...prev, newStaged]);
          toast.success(`Added ${dragItem.ingredient.name} to canvas`);
        }
      }

      if (dragItem.type === 'panel-recipe') {
        // Check if trying to add a recipe that's already staged
        const alreadyStaged = stagedRecipes.some(
          (s) => s.recipe.id === dragItem.recipe.id
        );
        if (alreadyStaged) {
          toast.error(`${dragItem.recipe.name} is already on the canvas`);
          return;
        }

        const newStaged: StagedRecipe = {
          id: `rec-${Date.now()}-${Math.random()}`,
          recipe: dragItem.recipe,
          quantity: 1,
          x: dropX,
          y: dropY,
        };
        setStagedRecipes((prev) => [...prev, newStaged]);
        toast.success(`Added ${dragItem.recipe.name} to canvas`);
      }
    },
    [activeDragItem, canvasRef, stagedIngredients, stagedRecipes]
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

    // Determine version and root_id based on selected recipe
    const selectedRecipe = selectedRecipeId
      ? recipes?.find((r) => r.id === selectedRecipeId)
      : null;
    const version = selectedRecipe ? selectedRecipe.version + 1 : 1;
    // root_id points to the recipe this new version is based on
    const root_id = selectedRecipe ? selectedRecipe.id : null;

    try {
      // Create a new recipe
      const newRecipe = await createRecipe.mutateAsync({
        name: metadata.name,
        yield_quantity: metadata.yield_quantity,
        yield_unit: metadata.yield_unit,
        status: metadata.status,
        created_by: userId || undefined,
        is_public: metadata.is_public,
        owner_id: userId || undefined,
        version,
        root_id,
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

      // Redirect to recipes page
      router.push('/recipes');
    } catch {
      toast.error('Failed to create recipe');
    } finally {
      setIsSubmitting(false);
    }
  }, [stagedIngredients, stagedRecipes, metadata, createRecipe, addIngredient, addSubRecipe, userId, selectedRecipeId, recipes, router]);

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

  return (
    <>
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
          onReset={handleReset}
          onClearAll={handleClearAll}
          isSubmitting={isSubmitting}
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
        />
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

      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitConfirm}
        title="Submit Recipe"
        message={`Are you sure you want to submit "${metadata.name}" with ${stagedIngredients.length} ingredient(s) and ${stagedRecipes.length} sub-recipe(s)?`}
        confirmLabel="Submit"
        cancelLabel="Cancel"
      />
    </>
  );
}
