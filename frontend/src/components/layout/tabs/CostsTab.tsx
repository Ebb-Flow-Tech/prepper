'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { useAppState } from '@/lib/store';
import { useRecipe, useCosting } from '@/lib/hooks';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

function IngredientCostTable({ recipeId }: { recipeId: number }) {
  const { data: costing, isLoading, error } = useCosting(recipeId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || !costing) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No cost data available. Add ingredients to see cost breakdown.
      </div>
    );
  }

  if (costing.breakdown.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No ingredients added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="py-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Ingredient
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Quantity
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Unit Cost
            </th>
            <th className="py-3 pl-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Line Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {costing.breakdown.map((item) => (
            <tr
              key={item.ingredient_id}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-3 pr-4 text-zinc-900 dark:text-zinc-100">
                {item.ingredient_name}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                {item.quantity} {item.unit}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                {item.cost_per_base_unit != null
                  ? `${formatCurrency(item.cost_per_base_unit)}/${item.base_unit}`
                  : '—'}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                {item.line_cost != null ? formatCurrency(item.line_cost) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        {costing.ingredient_cost != null && (
          <tfoot>
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <td
                colSpan={3}
                className="py-3 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400"
              >
                Subtotal
              </td>
              <td className="py-3 pl-4 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(costing.ingredient_cost)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function SubRecipeCostTable({ recipeId }: { recipeId: number }) {
  const { data: costing, isLoading, error } = useCosting(recipeId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || !costing) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No cost data available.
      </div>
    );
  }

  if (costing.sub_recipe_breakdown.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No sub-recipes added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="py-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Recipe
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Quantity
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Cost per Unit
            </th>
            <th className="py-3 pl-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Line Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {costing.sub_recipe_breakdown.map((item) => {
            const unitCost =
              item.unit === 'batch'
                ? item.sub_recipe_batch_cost
                : item.sub_recipe_portion_cost;

            return (
              <tr
                key={item.link_id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-3 pr-4 text-zinc-900 dark:text-zinc-100">
                  {item.recipe_name}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                  {item.quantity} {item.unit}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                  {unitCost != null ? `${formatCurrency(unitCost)}/${item.unit}` : '—'}
                </td>
                <td className="py-3 pl-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                  {item.line_cost != null ? formatCurrency(item.line_cost) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        {costing.sub_recipe_cost != null && (
          <tfoot>
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <td
                colSpan={3}
                className="py-3 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400"
              >
                Subtotal
              </td>
              <td className="py-3 pl-4 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(costing.sub_recipe_cost)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function CostSummary({ recipeId }: { recipeId: number }) {
  const { data: costing, isLoading, error } = useCosting(recipeId);
  const [showTooltip, setShowTooltip] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-5 w-32" />
      </div>
    );
  }

  if (error || !costing) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        {costing.ingredient_cost != null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Ingredient cost:</span>
            <span className="font-medium">{formatCurrency(costing.ingredient_cost)}</span>
          </div>
        )}
        {costing.sub_recipe_cost != null && costing.sub_recipe_cost > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-zinc-500">Sub-recipe cost:</span>
            <span className="font-medium">{formatCurrency(costing.sub_recipe_cost)}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
          <span className="text-sm text-zinc-500">Total batch cost:</span>
          <span className="font-semibold">
            {costing.total_batch_cost != null ? formatCurrency(costing.total_batch_cost) : '—'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm text-zinc-500">Cost per portion:</span>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-md bg-zinc-900 p-2 text-xs text-white shadow-lg dark:bg-zinc-700">
                  Calculated from ingredient and item costs with yield of{' '}
                  {costing.yield_quantity} {costing.yield_unit}.
                </div>
              )}
            </div>
          </div>
          <span className="font-semibold">
            {costing.cost_per_portion != null ? formatCurrency(costing.cost_per_portion) : '—'}
          </span>
        </div>
      </div>

      {costing.missing_costs.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Missing cost data for:
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
            {costing.missing_costs.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CostsTab() {
  const { selectedRecipeId } = useAppState();
  const { data: recipe, isLoading, error } = useRecipe(selectedRecipeId);

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            Select a recipe from the left panel to view its costs
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Ingredient Cost Breakdown Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
              Ingredient Costs
            </h2>
            <IngredientCostTable recipeId={recipe.id} />
          </CardContent>
        </Card>

        {/* Sub-Recipe Cost Breakdown Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
              Sub-Recipe Costs
            </h2>
            <SubRecipeCostTable recipeId={recipe.id} />
          </CardContent>
        </Card>

        {/* Cost Summary Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
              Cost Summary
            </h2>
            <CostSummary recipeId={recipe.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
