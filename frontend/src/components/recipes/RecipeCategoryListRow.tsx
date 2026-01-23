'use client';

import { useRouter } from 'next/navigation';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { RecipeCategory } from '@/types';

interface RecipeCategoryListRowProps {
  category: RecipeCategory;
  onDelete?: (category: RecipeCategory) => void;
}

export function RecipeCategoryListRow({ category, onDelete }: RecipeCategoryListRowProps) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {category.name}
        </h3>
        {category.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-1 mt-0.5">
            {category.description}
          </p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Created {new Date(category.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center gap-1 ml-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push(`/recipe-categories/${category.id}`)}
          title="View Details"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(category)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
