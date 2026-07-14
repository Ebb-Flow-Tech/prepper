'use client';

import { memo } from 'react';
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
  allergenNames?: string[];
  categoryNames?: string[];
  matchedViaSubDish?: boolean;
}

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'destructive' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'destructive',
};

export const RecipeListRow = memo(function RecipeListRow({ recipe, costPerPortion, isOwned, href, allergenNames = [], categoryNames = [], matchedViaSubDish }: RecipeListRowProps) {
  return (
    <Link href={href ?? `/recipes/${recipe.id}`} className="block">
      <Card interactive className="mb-2">
        <CardContent className="py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-foreground truncate hover:text-primary">
                {recipe.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
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
                {matchedViaSubDish && (
                  <Badge variant="default" className="text-xs">Via sub-dish</Badge>
                )}
                {isOwned && (
                  <Badge className="text-xs bg-primary text-primary-foreground">Owned</Badge>
                )}
                {categoryNames.map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                ))}
                {allergenNames.map((name) => (
                  <Badge key={name} variant="warning" className="text-xs">{name}</Badge>
                ))}
              </div>

              <div className="text-right">
                <p className="text-sm text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">
                    {formatCurrency(costPerPortion ?? (recipe.cost_price != null && recipe.yield_quantity > 0 ? recipe.cost_price / recipe.yield_quantity : recipe.cost_price))}
                  </span>
                  <span className="text-muted-foreground">/portion</span>
                </p>
              </div>

              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
