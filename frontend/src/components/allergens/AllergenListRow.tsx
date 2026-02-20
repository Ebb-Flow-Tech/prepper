'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { Allergen } from '@/types';

interface AllergenListRowProps {
  allergen: Allergen;
  onEdit?: (allergen: Allergen) => void;
  onArchive?: (allergen: Allergen) => void;
  onUnarchive?: (allergen: Allergen) => void;
}

export function AllergenListRow({
  allergen,
  onEdit,
  onArchive,
  onUnarchive,
}: AllergenListRowProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <Card
      className="relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <CardContent className="py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{allergen.name}</p>
            {allergen.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {allergen.description}
              </p>
            )}
            {!allergen.is_active && (
              <Badge variant="secondary" className="mt-1">Archived</Badge>
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
                    onEdit(allergen);
                  }}
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
                  onClick={(e) => {
                    e.preventDefault();
                    onArchive(allergen);
                  }}
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
                  onClick={(e) => {
                    e.preventDefault();
                    onUnarchive(allergen);
                  }}
                  title="Unarchive"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
