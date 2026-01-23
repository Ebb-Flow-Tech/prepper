'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { Recipe, RecipeStatus } from '@/types';

interface RecipeListRowProps {
  recipe: Recipe;
  costPerPortion?: number | null;
  isOwned?: boolean;
  href?: string;
}

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

export function RecipeListRow({ recipe, costPerPortion, isOwned, href }: RecipeListRowProps) {
  return (
    <Link href={href ?? `/recipes/${recipe.id}`} className="block">
      <Card interactive className="mb-2">
        <CardContent className="py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                {recipe.name}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {recipe.yield_quantity} {recipe.yield_unit}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge variant={STATUS_VARIANTS[recipe.status]} className="text-xs">
                  {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
                </Badge>
                {recipe.is_prep_recipe && (
                  <Badge variant="default" className="text-xs">Prep</Badge>
                )}
                {isOwned && (
                  <Badge className="text-xs bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(costPerPortion ?? recipe.cost_price)}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-500">/portion</span>
                </p>
              </div>

              <ExternalLink className="h-4 w-4 text-zinc-400 flex-shrink-0" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
