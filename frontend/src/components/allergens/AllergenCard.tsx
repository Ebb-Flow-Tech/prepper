'use client';

import { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { Allergen } from '@/types';
import { cn } from '@/lib/utils';

interface AllergenCardProps {
  allergen: Allergen;
  onEdit?: (allergen: Allergen) => void;
  onArchive?: (allergen: Allergen) => void;
  onUnarchive?: (allergen: Allergen) => void;
}

export function AllergenCard({
  allergen,
  onEdit,
  onArchive,
  onUnarchive,
}: AllergenCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <Card
      className="relative p-4 cursor-default"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <CardTitle className="truncate">{allergen.name}</CardTitle>
          {allergen.description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">
              {allergen.description}
            </p>
          )}
          {!allergen.is_active && <Badge variant="secondary" className="mt-2">Archived</Badge>}
        </div>
      </div>

      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white dark:bg-zinc-950 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-800 p-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(allergen)}
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onArchive && allergen.is_active && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onArchive(allergen)}
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          {onUnarchive && !allergen.is_active && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUnarchive(allergen)}
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
