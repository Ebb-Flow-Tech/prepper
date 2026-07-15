'use client';

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ImagePlus, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { Recipe, RecipeStatus } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  costPerPortion?: number | null;
  isOwned?: boolean;
  href?: string;
  categoryNames?: string[];
  allergenNames?: string[];
  unitNames?: string[];
  matchedViaSubDish?: boolean;
}

const STATUS_VARIANTS: Record<RecipeStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  draft: 'secondary',
  active: 'success',
  archived: 'warning',
};

export const RecipeCard = memo(function RecipeCard({ recipe, costPerPortion, isOwned, href, categoryNames = [], allergenNames = [], unitNames = [], matchedViaSubDish }: RecipeCardProps) {
  return (
    <Link href={href ?? `/recipes/${recipe.id}`} className="block">
      <Card interactive className="mb-4 h-full">
        <CardHeader>
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-xl">{recipe.name}</CardTitle>
            <p className="text-base text-muted-foreground mt-0.5">
              {recipe.yield_quantity} {recipe.yield_unit}
            </p>
          </div>

          {/* Recipe image */}
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-md object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
              <ImagePlus className="h-6 w-6" />
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3">
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANTS[recipe.status]} className="text-sm">
                {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
              </Badge>
              {recipe.is_prep_recipe && (
                <Badge variant="default" className="text-sm">Prep</Badge>
              )}
              {matchedViaSubDish && (
                <Badge variant="default" className="text-sm">Via Sub-dish</Badge>
              )}
              {isOwned && (
                <Badge className="text-sm bg-primary text-primary-foreground">Owned</Badge>
              )}
            </div>

            {/* Categories */}
            {unitNames.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">Brands</p>
                <div className="flex flex-wrap gap-1">
                  {unitNames.map((name) => (
                    <Badge key={name} variant="default" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {categoryNames.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">Categories</p>
                <div className="flex flex-wrap gap-1">
                  {categoryNames.map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Allergens */}
            {allergenNames.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">Allergens</p>
                <div className="flex flex-wrap gap-1">
                  {allergenNames.map((name) => (
                    <Badge key={name} variant="warning" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-base">
              <span className="text-muted-foreground">Cost: </span>
              <span className="font-medium text-foreground">
                {formatCurrency(costPerPortion ?? (recipe.cost_price != null && recipe.yield_quantity > 0 ? recipe.cost_price / recipe.yield_quantity : recipe.cost_price))}
              </span>
              <span className="text-muted-foreground">/portion</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
});
