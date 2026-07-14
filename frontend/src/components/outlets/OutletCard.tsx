'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, Archive, ArchiveRestore, Store } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import type { Outlet } from '@/types';

interface OutletCardProps {
  outlet: Outlet;
  parentOutletName?: string;
  onArchive?: (outlet: Outlet) => void;
  onUnarchive?: (outlet: Outlet) => void;
}

export function OutletCard({ outlet, parentOutletName, onArchive, onUnarchive }: OutletCardProps) {
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
          <p className="text-xs text-muted-foreground mt-1">
            {outlet.code}
          </p>
        </div>

        <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
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
          {parentOutletName && (
            <p className="text-xs text-muted-foreground">
              Brand: {parentOutletName}
            </p>
          )}
        </div>
      </CardContent>

      {/* Quick Actions */}
      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-card rounded-lg shadow-elevation-1 border border-border p-1">
          <Link
            href={`/outlets/${outlet.id}`}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Link>
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
