'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import type { RecipeCategory } from '@/types';

interface RecipeCategoryCardProps {
  category: RecipeCategory;
  onDelete?: (category: RecipeCategory) => void;
}

export function RecipeCategoryCard({ category, onDelete }: RecipeCategoryCardProps) {
  const [showActions, setShowActions] = useState(false);
  const router = useRouter();

  return (
    <Card
      className="relative group mb-4"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <CardHeader>
        <div className="flex-1 min-w-0">
          <CardTitle className="truncate">
            {category.name}
          </CardTitle>
          {category.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {category.description}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Created {new Date(category.created_at).toLocaleDateString()}
        </p>
      </CardContent>

      {/* Quick Actions */}
      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white dark:bg-zinc-950 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-800 p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => router.push(`/recipe-categories/${category.id}`)}
            title="View Details"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDelete(category)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
