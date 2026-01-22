'use client';

import { useState } from 'react';
import { Edit2, Archive, ArchiveRestore, Store } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import type { Outlet } from '@/types';

interface OutletCardProps {
  outlet: Outlet;
  onEdit?: (outlet: Outlet) => void;
  onArchive?: (outlet: Outlet) => void;
  onUnarchive?: (outlet: Outlet) => void;
}

export function OutletCard({ outlet, onEdit, onArchive, onUnarchive }: OutletCardProps) {
  const [showActions, setShowActions] = useState(false);

  const typeLabel = outlet.outlet_type === 'brand' ? 'Brand' : 'Location';

  return (
    <Card
      className="relative group mb-4"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <CardHeader>
        <div className="flex-1 min-w-0">
          <CardTitle className="truncate">
            {outlet.name}
          </CardTitle>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {outlet.code}
          </p>
        </div>

        <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
          <Store className="h-5 w-5" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
            {!outlet.is_active && (
              <Badge variant="warning">Archived</Badge>
            )}
          </div>
          {outlet.parent_outlet_id && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Parent outlet ID: {outlet.parent_outlet_id}
            </p>
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
              onClick={() => onEdit(outlet)}
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onArchive && outlet.is_active && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onArchive(outlet)}
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          {onUnarchive && !outlet.is_active && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUnarchive(outlet)}
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
