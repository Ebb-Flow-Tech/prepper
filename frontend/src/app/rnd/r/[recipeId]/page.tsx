'use client';

import { use, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Eye,
  ImagePlus,
  Clock,
  Thermometer,
  Star,
  CheckCircle,
  AlertCircle,
  XCircle,
  Wine,
  ClipboardList,
  History,
  LayoutGrid,
  Square,
  CheckSquare,
  Calendar,
  User,
  ChevronDown,
} from 'lucide-react';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo } from 'react';
import { useRecipe, useRecipeIngredients, useCosting, useSubRecipes, useRecipes, useRecipeVersions, useOutlets } from '@/lib/hooks';
import { useRecipeTastingNotes, useRecipeTastingSummary, useUpdateTastingNote } from '@/lib/hooks/useTastings';
import { useRecipeOutlets } from '@/lib/hooks/useRecipeOutlets';
import { useAppState } from '@/lib/store';
import { Badge, Button, Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency, formatTimer, cn } from '@/lib/utils';
import type { Recipe, RecipeStatus, TastingDecision, TastingNoteWithRecipe, RecipeIngredient, CostingResult, SubRecipe, RecipeTastingSummary, RecipeOutlet, Outlet } from '@/types';

interface RndRecipePageProps {
  params: Promise<{ recipeId: string }>;
}

type TabType = 'overview' | 'versions';

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

const DECISION_CONFIG: Record<TastingDecision, { label: string; icon: typeof CheckCircle; variant: 'success' | 'warning' | 'destructive' }> = {
  approved: { label: 'Approved', icon: CheckCircle, variant: 'success' },
  needs_work: { label: 'Needs Work', icon: AlertCircle, variant: 'warning' },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' },
};

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-zinc-400">-</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'text-zinc-300 dark:text-zinc-600'
          }`}
        />
      ))}
    </div>
  );
}

function formatTastingDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

// ============ Version Tree Components ============

interface VersionNodeData extends Record<string, unknown> {
  recipe: Recipe;
  isCurrentRecipe: boolean;
}

type VersionNodeType = Node<VersionNodeData, 'versionNode'>;

const VersionNode = memo(({ data }: NodeProps<VersionNodeType>) => {
  const { recipe, isCurrentRecipe } = data;

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md min-w-[280px] max-w-[320px]',
        isCurrentRecipe
          ? 'border-blue-500 bg-blue-50 shadow-blue-100 dark:border-blue-400 dark:bg-blue-950 dark:shadow-blue-900/20'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-zinc-400 !w-2 !h-2 !border-0"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {recipe.name}
            </h3>
            {isCurrentRecipe && (
              <Badge className="bg-blue-500 text-white text-xs shrink-0">
                Current
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <History className="h-3.5 w-3.5" />
              v{recipe.version}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(recipe.created_at).toLocaleDateString()}
            </span>
          </div>
          {recipe.created_by && (
            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              <User className="h-3 w-3" />
              {recipe.created_by}
            </div>
          )}
        </div>
        <Badge variant={STATUS_VARIANTS[recipe.status]} className="shrink-0">
          {recipe.status}
        </Badge>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-zinc-400 !w-2 !h-2 !border-0"
      />
    </div>
  );
});

VersionNode.displayName = 'VersionNode';

const nodeTypes = {
  versionNode: VersionNode,
};

function buildVersionGraph(
  versions: Recipe[],
  selectedRecipeId: number | null
): { nodes: VersionNodeType[]; edges: Edge[] } {
  if (!versions.length) return { nodes: [], edges: [] };

  // Filter out masked (private) recipes - they have empty names
  const visibleVersions = versions.filter((recipe) => recipe.name !== '');
  if (!visibleVersions.length) return { nodes: [], edges: [] };

  // Build a map of recipe id to recipe for quick lookup
  const recipeMap = new Map<number, Recipe>();
  for (const recipe of visibleVersions) {
    recipeMap.set(recipe.id, recipe);
  }

  // Build parent-child relationships based on root_id (which is actually "forked_from")
  const childrenMap = new Map<number, Recipe[]>();
  let rootRecipe: Recipe | null = null;

  for (const recipe of visibleVersions) {
    if (recipe.root_id === null) {
      // This is the root recipe (original, not forked from anything)
      rootRecipe = recipe;
    } else if (recipeMap.has(recipe.root_id)) {
      // Only create edge if the parent is in our visible versions list
      const children = childrenMap.get(recipe.root_id) || [];
      children.push(recipe);
      childrenMap.set(recipe.root_id, children);
    }
  }

  // If no root found, use the recipe with the lowest version number
  if (!rootRecipe) {
    rootRecipe = [...visibleVersions].sort((a, b) => a.version - b.version)[0];
  }

  // Layout nodes using a tree structure (BFS for level assignment)
  // Horizontal layout: levels go left to right
  const NODE_WIDTH = 320;
  const NODE_HEIGHT = 120;
  const HORIZONTAL_SPACING = 80;
  const VERTICAL_SPACING = 40;

  // Assign levels (depth) to each node using BFS
  const levelMap = new Map<number, number>();
  const nodesAtLevel = new Map<number, Recipe[]>();
  const queue: { recipe: Recipe; level: number }[] = [{ recipe: rootRecipe, level: 0 }];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const { recipe, level } = queue.shift()!;
    if (visited.has(recipe.id)) continue;
    visited.add(recipe.id);

    levelMap.set(recipe.id, level);
    const levelNodes = nodesAtLevel.get(level) || [];
    levelNodes.push(recipe);
    nodesAtLevel.set(level, levelNodes);

    // Add children to queue
    const children = childrenMap.get(recipe.id) || [];
    // Sort children by version for consistent ordering
    children.sort((a, b) => a.version - b.version);
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push({ recipe: child, level: level + 1 });
      }
    }
  }

  // Handle any orphaned nodes (not connected to root) - add them at appropriate levels
  for (const recipe of visibleVersions) {
    if (!visited.has(recipe.id)) {
      const level = recipe.version - 1; // Use version as a fallback for level
      levelMap.set(recipe.id, level);
      const levelNodes = nodesAtLevel.get(level) || [];
      levelNodes.push(recipe);
      nodesAtLevel.set(level, levelNodes);
    }
  }

  // Calculate positions for horizontal layout (left to right)
  // X = level (depth), Y = position within level
  const positionMap = new Map<number, { x: number; y: number }>();
  const maxLevel = Math.max(...Array.from(nodesAtLevel.keys()));

  for (let level = 0; level <= maxLevel; level++) {
    const nodesInLevel = nodesAtLevel.get(level) || [];
    const totalHeight = nodesInLevel.length * NODE_HEIGHT + (nodesInLevel.length - 1) * VERTICAL_SPACING;
    const startY = -totalHeight / 2 + NODE_HEIGHT / 2;

    nodesInLevel.forEach((recipe, index) => {
      positionMap.set(recipe.id, {
        x: level * (NODE_WIDTH + HORIZONTAL_SPACING),
        y: startY + index * (NODE_HEIGHT + VERTICAL_SPACING),
      });
    });
  }

  // Create nodes (only for visible/authorized recipes)
  const nodes: VersionNodeType[] = visibleVersions.map((recipe) => {
    const position = positionMap.get(recipe.id) || { x: 0, y: 0 };
    return {
      id: String(recipe.id),
      type: 'versionNode',
      position,
      data: {
        recipe,
        isCurrentRecipe: recipe.id === selectedRecipeId,
      },
      draggable: false,
      selectable: false,
    };
  });

  // Create edges based on actual parent-child (root_id) relationships
  const edges: Edge[] = [];
  for (const recipe of visibleVersions) {
    if (recipe.root_id !== null && recipeMap.has(recipe.root_id)) {
      edges.push({
        id: `e${recipe.root_id}-${recipe.id}`,
        source: String(recipe.root_id),
        target: String(recipe.id),
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#71717a', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#71717a',
          width: 20,
          height: 20,
        },
      });
    }
  }

  return { nodes, edges };
}

// ============ Actionable Item Component ============

interface ActionableItem {
  noteId: number;
  sessionId: number;
  text: string;
  sessionName: string | null;
  sessionDate: string | null;
  checked: boolean;
}

function ActionablesList({
  actionables,
  onToggle,
  isUpdating,
}: {
  actionables: ActionableItem[];
  onToggle: (noteId: number, sessionId: number, currentValue: boolean) => void;
  isUpdating: boolean;
}) {
  const uncheckedCount = actionables.filter(a => !a.checked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Follow Ups ({uncheckedCount} tasks left)
        </h2>
      </div>

      {actionables.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No actionables from tastings yet
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {actionables.map((item) => (
            <li
              key={item.noteId}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                item.checked
                  ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600',
                isUpdating && 'opacity-50 pointer-events-none'
              )}
              onClick={() => onToggle(item.noteId, item.sessionId, item.checked)}
            >
              <button
                className="mt-0.5 shrink-0"
                disabled={isUpdating}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(item.noteId, item.sessionId, item.checked);
                }}
              >
                {item.checked ? (
                  <CheckSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Square className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm whitespace-pre-line',
                  item.checked
                    ? 'text-zinc-400 dark:text-zinc-500 line-through'
                    : 'text-zinc-700 dark:text-zinc-300'
                )}>
                  {item.text}
                </p>
                {item.sessionName && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    From: {item.sessionName}
                    {item.sessionDate && ` (${formatTastingDate(item.sessionDate)})`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============ Tab Components ============

function OverviewTab({
  recipe,
  ingredients,
  costing,
  subRecipes,
  recipeMap,
  tastingNotes,
  tastingSummary,
  userId,
  outlets,
  outletMap,
}: {
  recipe: Recipe;
  ingredients: RecipeIngredient[] | undefined;
  costing: CostingResult | undefined;
  subRecipes: SubRecipe[] | undefined;
  recipeMap: Map<number, string>;
  tastingNotes: TastingNoteWithRecipe[] | undefined;
  tastingSummary: RecipeTastingSummary | undefined;
  userId: string | null;
  outlets: RecipeOutlet[] | undefined;
  outletMap: Map<number, Outlet>;
}) {
  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
  const [isTastingHistoryOpen, setIsTastingHistoryOpen] = useState(false);
  const [isFollowUpsOpen, setIsFollowUpsOpen] = useState(false);

  // Extract actionables from tasting notes
  const actionables = useMemo(() => {
    if (!tastingNotes) return [];
    const items: ActionableItem[] = [];
    for (const note of tastingNotes) {
      if (note.action_items && note.action_items.trim()) {
        items.push({
          noteId: note.id,
          sessionId: note.session_id,
          text: note.action_items.trim(),
          sessionName: note.session_name,
          sessionDate: note.session_date,
          checked: note.action_items_done,
        });
      }
    }
    return items;
  }, [tastingNotes]);

  const updateTastingNote = useUpdateTastingNote();
  const handleToggle = useCallback((noteId: number, sessionId: number, currentValue: boolean) => {
    updateTastingNote.mutate({
      sessionId,
      noteId,
      data: { action_items_done: !currentValue },
      recipeId: recipe.id,
    });
  }, [updateTastingNote, recipe.id]);

  return (
    <>
      {/* Recipe Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {recipe.image_url ? (
              <img
                src={recipe.image_url}
                alt={recipe.name}
                className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                <ImagePlus className="h-8 w-8" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {recipe.name}
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  Yield: {recipe.yield_quantity} {recipe.yield_unit}
                </p>

                {outlets && outlets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {outlets.map((recipeOutlet) => {
                      const outlet = outletMap.get(recipeOutlet.outlet_id);
                      return (
                        <Badge key={recipeOutlet.outlet_id} variant="secondary" className="text-xs">
                          {outlet?.code || `Outlet #${recipeOutlet.outlet_id}`}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {userId !== null && recipe.owner_id === userId && (
                  <Badge className="bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
                )}
                <Badge variant={STATUS_VARIANTS[recipe.status]}>
                  {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
                </Badge>
                <Link href={`/canvas?recipe=${recipe.id}`}>
                  <Button variant="outline" size="sm">
                    {userId !== null && recipe.owner_id === userId ? (
                      <Edit2 className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {userId !== null && recipe.owner_id === userId ? 'Edit in Canvas' : 'View in Canvas'}
                  </Button>
                </Link>
              </div>

              <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Created: {new Date(recipe.created_at).toLocaleDateString()}
                {recipe.updated_at !== recipe.created_at && (
                  <span className="ml-4">
                    Updated: {new Date(recipe.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Follow Ups Section (Collapsible) */}
      <Card className="mb-6">
        <button
          onClick={() => setIsFollowUpsOpen(!isFollowUpsOpen)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Follow Ups
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {actionables.length > 0 && (
              <span className="text-sm text-zinc-500">
                {actionables.filter(a => !a.checked).length} of {actionables.length}
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform shrink-0',
                isFollowUpsOpen && 'rotate-180'
              )}
            />
          </div>
        </button>

        {isFollowUpsOpen && (
          <CardContent className="p-6 border-t border-zinc-200 dark:border-zinc-800">
            <ActionablesList
              actionables={actionables}
              onToggle={handleToggle}
              isUpdating={updateTastingNote.isPending}
            />
          </CardContent>
        )}
      </Card>

      {/* Tasting History Card (Collapsible) */}
      <Card className="mb-6">
        <button
          onClick={() => setIsTastingHistoryOpen(!isTastingHistoryOpen)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Tasting History
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {tastingSummary && tastingSummary.total_tastings > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">
                  {tastingSummary.total_tastings} tasting{tastingSummary.total_tastings !== 1 ? 's' : ''}
                </span>
                {tastingSummary.average_overall_rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{tastingSummary.average_overall_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
            <ChevronDown
              className={cn(
                'h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform shrink-0',
                isTastingHistoryOpen && 'rotate-180'
              )}
            />
          </div>
        </button>

        {isTastingHistoryOpen && (
          <CardContent className="p-6 border-t border-zinc-200 dark:border-zinc-800">
            {tastingNotes && tastingNotes.length > 0 ? (
              <div className="space-y-3">
                {tastingNotes.map((note) => {
                  const config = note.decision ? DECISION_CONFIG[note.decision] : null;
                  const Icon = config?.icon;
                  return (
                    <div
                      key={note.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/tastings/${note.session_id}`}
                            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400"
                          >
                            {note.session_name}
                          </Link>
                          {config && (
                            <Badge variant={config.variant} className="text-xs">
                              {Icon && <Icon className="h-3 w-3 mr-1" />}
                              {config.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                          {note.session_date && (
                            <span>{formatTastingDate(note.session_date)}</span>
                          )}
                          {note.overall_rating && (
                            <StarRating rating={note.overall_rating} />
                          )}
                        </div>
                        {note.feedback && (
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">
                            &ldquo;{note.feedback}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Wine className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                <p className="text-zinc-400 dark:text-zinc-500">
                  No tastings recorded yet
                </p>
                <Link href="/tastings/new" className="mt-2 inline-block">
                  <Button variant="outline" size="sm">
                    Create Tasting Session
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* More Info Section (Collapsible) */}
      <Card className="mb-6">
        <button
          onClick={() => setIsMoreInfoOpen(!isMoreInfoOpen)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            More Info
          </h2>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform',
              isMoreInfoOpen && 'rotate-180'
            )}
          />
        </button>

        {isMoreInfoOpen && (
          <>
            {/* Ingredients | Sub Recipes | Costing Grid */}
            <div className="px-6 pb-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <div className="grid gap-6 md:grid-cols-3 mb-6">
                {/* Ingredients Card */}
                <div>
                  <h3 className="text-base font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Ingredients
                  </h3>

                  {ingredients && ingredients.length > 0 ? (
                    <ul className="space-y-2">
                      {ingredients.map((ri) => (
                        <li
                          key={ri.id}
                          className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                          <div>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {ri.ingredient?.name || `Ingredient #${ri.ingredient_id}`}
                            </span>
                          </div>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {ri.quantity} {ri.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No ingredients added yet
                    </p>
                  )}
                </div>

                {/* Sub Recipes */}
                <div>
                  <h3 className="text-base font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Sub Recipes
                  </h3>

                  {subRecipes && subRecipes.length > 0 ? (
                    <ul className="space-y-2">
                      {[...subRecipes]
                        .sort((a, b) => a.position - b.position)
                        .map((sr) => (
                          <li
                            key={sr.id}
                            className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                          >
                            <div>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {recipeMap.get(sr.child_recipe_id) || `Recipe #${sr.child_recipe_id}`}
                              </span>
                            </div>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {sr.quantity} {sr.unit}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No sub-recipes added yet
                    </p>
                  )}
                </div>

                {/* Costing */}
                <div>
                  <h3 className="text-base font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                    Costing
                  </h3>

                  {costing ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-zinc-500 dark:text-zinc-400">Batch Cost</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(costing.total_batch_cost)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-zinc-500 dark:text-zinc-400">Cost per Portion</span>
                        <span className="font-semibold text-xl text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(costing.cost_per_portion)}
                        </span>
                      </div>

                      {recipe.selling_price_est && costing.cost_per_portion && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-500 dark:text-zinc-400">Margin</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {((1 - costing.cost_per_portion / recipe.selling_price_est) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No costing data available
                    </p>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-base font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
                  Instructions
                </h3>

                {recipe.instructions_structured?.steps && recipe.instructions_structured.steps.length > 0 ? (
                  <ol className="space-y-4">
                    {recipe.instructions_structured.steps.map((step, index) => (
                      <li key={index} className="flex gap-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {step.order || index + 1}
                        </span>
                        <div className="flex-1 pt-0.5">
                          <p className="text-zinc-700 dark:text-zinc-300">{step.text}</p>
                          <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                            {step.timer_seconds && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTimer(step.timer_seconds)}
                              </span>
                            )}
                            {step.temperature_c && (
                              <span className="flex items-center gap-1">
                                <Thermometer className="h-4 w-4" />
                                {step.temperature_c}°C
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : recipe.instructions_raw ? (
                  <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      {recipe.instructions_raw}
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-400 dark:text-zinc-500">
                    No instructions added yet
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function VersionsTab({
  recipeId,
  versions,
  isLoading,
  error,
}: {
  recipeId: number;
  versions: Recipe[] | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const router = useRouter();

  const handleNodeClick: NodeMouseHandler<VersionNodeType> = useCallback((_event, node) => {
    router.push(`/rnd/r/${node.data.recipe.id}?tab=versions`);
  }, [router]);

  const { nodes, edges } = useMemo(() => {
    if (!versions) return { nodes: [], edges: [] };
    return buildVersionGraph(versions, recipeId);
  }, [versions, recipeId]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Failed to load version history
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-500 dark:text-zinc-400">
              No version history available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-zinc-200 dark:border-zinc-800">
          <History className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Iteration History
          </h2>
          <Badge variant="secondary" className="ml-auto">
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* React Flow Canvas */}
        <div className="h-[500px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            defaultViewport={{ x: 50, y: 200, zoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={true}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            minZoom={1}
            maxZoom={1}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e4e4e7" gap={16} />
          </ReactFlow>
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Click a version node to view that recipe
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Main Page Component ============

export default function RndRecipePage({ params }: RndRecipePageProps) {
  const { recipeId: recipeIdStr } = use(params);
  const recipeId = parseInt(recipeIdStr, 10);
  const { userId } = useAppState();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(
    tabFromUrl && ['overview', 'versions'].includes(tabFromUrl)
      ? tabFromUrl
      : 'overview'
  );

  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(recipeId);
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(recipeId);
  const { data: costing, isLoading: costingLoading } = useCosting(recipeId);
  const { data: subRecipes, isLoading: subRecipesLoading } = useSubRecipes(recipeId);
  const { data: allRecipes } = useRecipes();
  const { data: tastingNotes, isLoading: tastingLoading } = useRecipeTastingNotes(recipeId);
  const { data: tastingSummary } = useRecipeTastingSummary(recipeId);
  const { data: versions, isLoading: versionsLoading, error: versionsError } = useRecipeVersions(recipeId, userId);
  const { data: recipeOutlets } = useRecipeOutlets(recipeId);
  const { data: allOutlets } = useOutlets();

  const isLoading = recipeLoading || ingredientsLoading || costingLoading || subRecipesLoading || tastingLoading;

  // Create a map of recipe IDs to names for sub-recipe display
  const recipeMap = new Map<number, string>();
  allRecipes?.forEach((r) => recipeMap.set(r.id, r.name));

  // Create a map of outlet IDs to outlets for recipe outlet display
  const outletMap = new Map<number, Outlet>();
  allOutlets?.forEach((outlet) => outletMap.set(outlet.id, outlet));

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
    { id: 'versions' as const, label: 'Iteration History', icon: History },
  ];

  if (recipeError) {
    return (
      <div className="p-6">
        <Link
          href="/rnd"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to R&D
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Recipe not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/rnd"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to R&D
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-64 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : recipe ? (
          <>
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                      activeTab === tab.id
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <OverviewTab
                recipe={recipe}
                ingredients={ingredients}
                costing={costing}
                subRecipes={subRecipes}
                recipeMap={recipeMap}
                tastingNotes={tastingNotes}
                tastingSummary={tastingSummary}
                userId={userId}
                outlets={recipeOutlets}
                outletMap={outletMap}
              />
            )}

            {activeTab === 'versions' && (
              <VersionsTab
                recipeId={recipeId}
                versions={versions}
                isLoading={versionsLoading}
                error={versionsError}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
