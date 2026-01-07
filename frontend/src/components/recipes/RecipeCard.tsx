'use client';

import Link from 'next/link';
import { ImagePlus, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { Recipe, RecipeStatus } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  costPerPortion?: number | null;
  isOwned?: boolean;
}

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

export function RecipeCard({ recipe, costPerPortion, isOwned }: RecipeCardProps) {
  return (
    <Link href={`/recipes/${recipe.id}`} className="block">
      <Card interactive className="mb-4 h-full">
        <CardHeader>
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{recipe.name}</CardTitle>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {recipe.yield_quantity} {recipe.yield_unit}
            </p>
          </div>

          {/* Placeholder for recipe image */}
          <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            <ImagePlus className="h-6 w-6" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANTS[recipe.status]}>
              {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
            </Badge>
            {recipe.is_prep_recipe && (
              <Badge variant="default">Prep</Badge>
            )}
            {isOwned && (
              <Badge className="bg-black text-white dark:bg-white dark:text-black">Owned</Badge>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Cost: </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(costPerPortion ?? recipe.cost_price)}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">/portion</span>
            </div>
            <ExternalLink className="h-4 w-4 text-zinc-400" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
