'use client';

import { useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Calendar, User, History } from 'lucide-react';
import { useRecipeVersions } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Badge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Recipe, RecipeStatus } from '@/types';

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

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

  // Build a map of recipe id to recipe for quick lookup
  const recipeMap = new Map<number, Recipe>();
  for (const recipe of versions) {
    recipeMap.set(recipe.id, recipe);
  }

  // Build parent-child relationships based on root_id (which is actually "forked_from")
  const childrenMap = new Map<number, Recipe[]>();
  let rootRecipe: Recipe | null = null;

  for (const recipe of versions) {
    if (recipe.root_id === null) {
      // This is the root recipe (original, not forked from anything)
      rootRecipe = recipe;
    } else if (recipeMap.has(recipe.root_id)) {
      // Only create edge if the parent is in our versions list
      const children = childrenMap.get(recipe.root_id) || [];
      children.push(recipe);
      childrenMap.set(recipe.root_id, children);
    }
  }

  // If no root found, use the recipe with the lowest version number
  if (!rootRecipe) {
    rootRecipe = [...versions].sort((a, b) => a.version - b.version)[0];
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
  for (const recipe of versions) {
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

  // Create nodes
  const nodes: VersionNodeType[] = versions.map((recipe) => {
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
  for (const recipe of versions) {
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

function VersionNodeSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 min-w-[280px] max-w-[320px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title row */}
          <Skeleton className="h-5 w-32" />
          {/* Version and date row */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Author row */}
          <Skeleton className="h-3 w-24" />
        </div>
        {/* Status badge */}
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

function VersionTreeSkeleton() {
  return (
    <div className="p-8">
      {/* Horizontal tree layout with connecting lines */}
      <div className="flex items-center gap-6">
        {/* Root node */}
        <VersionNodeSkeleton />

        {/* Connector line */}
        <div className="flex items-center">
          <Skeleton className="h-0.5 w-12" />
          <Skeleton className="h-2 w-2 rounded-full" />
        </div>

        {/* Branch with two children */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <VersionNodeSkeleton />
            <div className="flex items-center">
              <Skeleton className="h-0.5 w-12" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
            <VersionNodeSkeleton />
          </div>
          <div className="flex items-center gap-6">
            <VersionNodeSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function VersionsTab() {
  const router = useRouter();
  const { selectedRecipeId } = useAppState();
  const { data: versions, isLoading, error } = useRecipeVersions(selectedRecipeId);

  const handleNodeClick: NodeMouseHandler<VersionNodeType> = useCallback((_event, node) => {
    router.push(`/?recipe=${node.data.recipe.id}`);
  }, [router]);

  const { nodes, edges } = useMemo(() => {
    if (!versions) return { nodes: [], edges: [] };
    return buildVersionGraph(versions, selectedRecipeId);
  }, [versions, selectedRecipeId]);

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            Select a recipe to view its version history
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Failed to load version history
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
        <VersionTreeSkeleton />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No version history available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-zinc-200 dark:border-zinc-800">
        <History className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Version History
        </h2>
        <Badge variant="secondary" className="ml-auto">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* React Flow Canvas - scroll to pan, zoom disabled */}
      <div className="flex-1 min-h-[400px]">
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
    </div>
  );
}
