'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { useAppState } from '@/lib/store';
import { useRecipe, useCosting, useRecipes } from '@/lib/hooks';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { Recipe } from '@/types';

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
      <div className="text-sm text-muted-foreground">
        No cost data available. Add ingredients to see cost breakdown.
      </div>
    );
  }

  if (costing.breakdown.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No ingredients added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
              Ingredient
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Quantity
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Unit Cost
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Wastage %
            </th>
            <th className="py-3 pl-4 text-right font-medium text-muted-foreground">
              Line Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {costing.breakdown.map((item) => (
            <tr
              key={item.ingredient_id}
              className="border-b border-border"
            >
              <td className="py-3 pr-4 text-foreground">
                {item.ingredient_name}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {item.quantity} {item.unit}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {item.cost_per_base_unit != null
                  ? `${formatCurrency(item.cost_per_base_unit)}/${item.base_unit}`
                  : '—'}
              </td>
              <td className={`px-4 py-3 text-right ${item.wastage_percentage > 0 ? 'font-medium text-[var(--color-feedback-warning)]' : 'text-muted-foreground'}`}>
                {item.wastage_percentage > 0 ? `${item.wastage_percentage.toFixed(1)}%` : '—'}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-foreground">
                {item.line_cost != null ? formatCurrency(item.line_cost) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        {costing.ingredient_cost != null && (
          <tfoot>
            <tr className="border-t border-border">
              <td
                colSpan={4}
                className="py-3 pr-4 text-right font-medium text-muted-foreground"
              >
                Subtotal
              </td>
              <td className="py-3 pl-4 text-right font-semibold text-foreground">
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
  const { data: recipesData } = useRecipes({ page_size: 30 });
  const recipeMap = new Map<number, Recipe>();
  recipesData?.items?.forEach((r) => recipeMap.set(r.id, r));

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
      <div className="text-sm text-muted-foreground">
        No cost data available.
      </div>
    );
  }

  if (costing.sub_recipe_breakdown.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No sub-recipes added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
              Recipe
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Quantity
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Cost per Unit
            </th>
            <th className="py-3 pl-4 text-right font-medium text-muted-foreground">
              Line Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {costing.sub_recipe_breakdown.map((item) => {
            const childRecipe = recipeMap.get(item.recipe_id);
            const childYield = childRecipe?.yield_quantity ?? 1;
            const childYieldUnit = childRecipe?.yield_unit ?? 'portion';
            const showScaleContext = item.unit === 'portion' && childYield > 1;

            // Pick the right cost-per-unit based on the unit actually used
            let unitCost: number | null = null;
            if (item.unit === 'portion') {
              unitCost = item.sub_recipe_portion_cost;
            } else if (item.unit === 'batch') {
              unitCost = item.sub_recipe_batch_cost;
            } else if (item.unit === 'g' || item.unit === 'ml') {
              // cost per g/ml = line_cost / quantity (derived from backend's correct calc)
              unitCost = item.line_cost != null && item.quantity > 0
                ? item.line_cost / item.quantity
                : null;
            }
            const unitCostLabel = item.unit === 'portion' ? `/${childYieldUnit}` : `/${item.unit}`;

            return (
              <tr
                key={item.link_id}
                className="border-b border-border"
              >
                <td className="py-3 pr-4 text-foreground">
                  {item.recipe_name}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  <div>{item.quantity} {item.unit}</div>
                  {showScaleContext && (
                    <div className="text-xs text-[var(--color-feedback-warning)]">
                      {item.quantity} of {childYield} {childYieldUnit}s
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {unitCost != null ? `${formatCurrency(unitCost)}${unitCostLabel}` : '—'}
                </td>
                <td className="py-3 pl-4 text-right font-medium text-foreground">
                  {item.line_cost != null ? formatCurrency(item.line_cost) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        {costing.sub_recipe_cost != null && (
          <tfoot>
            <tr className="border-t border-border">
              <td
                colSpan={3}
                className="py-3 pr-4 text-right font-medium text-muted-foreground"
              >
                Subtotal
              </td>
              <td className="py-3 pl-4 text-right font-semibold text-foreground">
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
      <div className="rounded-lg border border-border bg-secondary p-4">
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
      <div className="rounded-lg border border-border bg-secondary p-4">
        {costing.ingredient_cost != null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ingredient cost:</span>
            <span className="font-medium">{formatCurrency(costing.ingredient_cost)}</span>
          </div>
        )}
        {costing.sub_recipe_cost != null && costing.sub_recipe_cost > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sub-recipe cost:</span>
            <span className="font-medium">{formatCurrency(costing.sub_recipe_cost)}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm text-muted-foreground">Total batch cost:</span>
          <span className="font-semibold">
            {costing.total_batch_cost != null ? formatCurrency(costing.total_batch_cost) : '—'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Cost per portion:</span>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-md bg-[var(--surface-tooltip)] p-2 text-xs text-[var(--color-text-inverse)] shadow-elevation-2">
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
        <div className="rounded-lg border border-[var(--color-feedback-warning)] bg-[var(--color-feedback-warning-tint)] p-4">
          <p className="text-sm font-medium text-[var(--color-feedback-warning)]">
            Missing cost data for:
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-feedback-warning)]">
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
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a recipe from the left panel to view its costs
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Ingredient Cost Breakdown Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Ingredient Costs
            </h2>
            <IngredientCostTable recipeId={recipe.id} />
          </CardContent>
        </Card>

        {/* Sub-Recipe Cost Breakdown Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Sub-Dishes Costs
            </h2>
            <SubRecipeCostTable recipeId={recipe.id} />
          </CardContent>
        </Card>

        {/* Cost Summary Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Cost Summary
            </h2>
            <CostSummary recipeId={recipe.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
