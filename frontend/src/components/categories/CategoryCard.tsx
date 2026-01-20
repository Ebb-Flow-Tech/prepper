'use client';

import { useState } from 'react';
import { Edit2, Archive, ArchiveRestore, FolderOpen } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import type { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
  onEdit?: (category: Category) => void;
  onArchive?: (category: Category) => void;
  onUnarchive?: (category: Category) => void;
}

export function CategoryCard({ category, onEdit, onArchive, onUnarchive }: CategoryCardProps) {
  const [showActions, setShowActions] = useState(false);

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
        </div>

        <div
          className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400"
        >
          <FolderOpen className="h-5 w-5" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          {category.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
              {category.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            {!category.is_active && (
              <Badge variant="warning">Archived</Badge>
            )}
          </div>
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
              onClick={() => onEdit(category)}
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onArchive && category.is_active && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onArchive(category)}
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          {onUnarchive && !category.is_active && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUnarchive(category)}
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
