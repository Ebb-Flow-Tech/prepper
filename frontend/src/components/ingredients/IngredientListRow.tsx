'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, Archive, ArchiveRestore, AlertCircle } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useAllergensByIngredient, useAllergens } from '@/lib/hooks';
import type { Ingredient, Category } from '@/types';

interface IngredientListRowProps {
  ingredient: Ingredient;
  categories?: Category[];
  onEdit?: (ingredient: Ingredient) => void;
  onArchive?: (ingredient: Ingredient) => void;
  onUnarchive?: (ingredient: Ingredient) => void;
}

export function IngredientListRow({
  ingredient,
  categories,
  onEdit,
  onArchive,
  onUnarchive,
}: IngredientListRowProps) {
  const [showActions, setShowActions] = useState(false);
  const { data: allergenLinks } = useAllergensByIngredient(ingredient.id);
  const { data: allergens } = useAllergens();

  const currentCategory = categories?.find((c) => c.id === ingredient.category_id);
  const ingredientAllergens = allergenLinks?.length
    ? allergens?.filter((a) => allergenLinks.some((link) => link.allergen_id === a.id))
    : [];

  return (
    <Card
      className="relative mb-2"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <CardContent className="py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link href={`/ingredients/${ingredient.id}`}>
              <h3 className="text-base font-medium text-foreground truncate hover:text-primary">
                {ingredient.name}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">
              {formatCurrency(ingredient.cost_per_base_unit)} per unit
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant="unit" className="text-xs">{ingredient.base_unit}</Badge>
              {ingredient.is_halal ? (
                <Badge variant="success" className="text-xs">Halal</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Non-halal</Badge>
              )}
              {!ingredient.is_active && (
                <Badge variant="warning" className="text-xs">Archived</Badge>
              )}
              {currentCategory && (
                <Badge variant="default" className="text-xs">{currentCategory.name}</Badge>
              )}
              {ingredientAllergens && ingredientAllergens.length > 0 && (
                <>
                  {ingredientAllergens.map((allergen) => (
                    <Badge key={allergen.id} variant="destructive" className="text-xs gap-1 flex items-center">
                      <AlertCircle className="h-3 w-3" />
                      {allergen.name}
                    </Badge>
                  ))}
                </>
              )}
            </div>

            {showActions && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault();
                      onEdit(ingredient);
                    }}
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onArchive && ingredient.is_active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault();
                      onArchive(ingredient);
                    }}
                    title="Archive"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onUnarchive && !ingredient.is_active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault();
                      onUnarchive(ingredient);
                    }}
                    title="Unarchive"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
