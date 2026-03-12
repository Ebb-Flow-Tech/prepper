'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, Archive, ArchiveRestore, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useAllergensByIngredient, useAllergens } from '@/lib/hooks';
import type { Ingredient, Category } from '@/types';

interface IngredientCardProps {
  ingredient: Ingredient;
  categories?: Category[];
  onEdit?: (ingredient: Ingredient) => void;
  onArchive?: (ingredient: Ingredient) => void;
  onUnarchive?: (ingredient: Ingredient) => void;
}

export function IngredientCard({ ingredient, categories, onEdit, onArchive, onUnarchive }: IngredientCardProps) {
  const [showActions, setShowActions] = useState(false);
  const { data: allergenLinks } = useAllergensByIngredient(ingredient.id);
  const { data: allergens } = useAllergens();

  const currentCategory = categories?.find((c) => c.id === ingredient.category_id);
  const ingredientAllergens = allergenLinks?.length
    ? allergens?.filter((a) => allergenLinks.some((link) => link.allergen_id === a.id))
    : [];

  return (
    <Card
      className="relative group mb-4"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <CardHeader>
        <div className="flex-1 min-w-0">
          <Link href={`/ingredients/${ingredient.id}`}>
            <CardTitle className="truncate text-xl hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
              {ingredient.name}
            </CardTitle>
          </Link>
          <p className="text-base text-zinc-500 dark:text-zinc-400 mt-0.5">
            {formatCurrency(ingredient.cost_per_base_unit)} per unit
          </p>
        </div>

      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="unit" className="text-sm">{ingredient.base_unit}</Badge>
          {ingredient.is_halal ? (
            <Badge variant="success" className="text-sm">Halal</Badge>
          ) : (
            <Badge variant="secondary" className="text-sm">Non-Halal</Badge>
          )}
          {!ingredient.is_active && (
            <Badge variant="warning" className="text-sm">Archived</Badge>
          )}
          {currentCategory && (
            <Badge variant="info" className="text-sm">{currentCategory.name}</Badge>
          )}
          {ingredientAllergens && ingredientAllergens.length > 0 && (
            <>
              {ingredientAllergens.map((allergen) => (
                <Badge key={allergen.id} variant="destructive" className="text-sm gap-1 flex items-center">
                  <AlertCircle className="h-3 w-3" />
                  {allergen.name}
                </Badge>
              ))}
            </>
          )}
        </div>
      </CardContent>

      {/* Quick Actions */}
      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white dark:bg-zinc-950 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-800 p-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(ingredient)}
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
              onClick={() => onArchive(ingredient)}
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
              onClick={() => onUnarchive(ingredient)}
              title="Unarchive"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
