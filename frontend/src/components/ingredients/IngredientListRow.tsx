'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
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
  const currentCategory = categories?.find((c) => c.id === ingredient.category_id);

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
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                {ingredient.name}
              </h3>
            </Link>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formatCurrency(ingredient.cost_per_base_unit)} per unit
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant="unit" className="text-xs">{ingredient.base_unit}</Badge>
              {!ingredient.is_active && (
                <Badge variant="warning" className="text-xs">Archived</Badge>
              )}
              {currentCategory && (
                <Badge variant="info" className="text-xs">{currentCategory.name}</Badge>
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
