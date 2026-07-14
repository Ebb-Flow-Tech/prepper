'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMenuSketches, useCreateMenuSketch, useDeleteMenuSketch } from '@/lib/hooks';
import { formatDistanceToNow } from 'date-fns';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { PageHeader, Button, ConfirmModal } from '@/components/ui';

export default function MenuSketchListPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: sketches, isLoading } = useMenuSketches({ include_archived: showArchived });
  const createSketch = useCreateMenuSketch();
  const deleteSketch = useDeleteMenuSketch();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Menu drafts"
          description="Freeform canvas for brainstorming menu layouts"
        >
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-foreground"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            View Archives
          </label>
          <Button
            onClick={() => createSketch.mutate(undefined)}
            disabled={createSketch.isPending}
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Menu
          </Button>
        </PageHeader>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ) : !sketches || sketches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No sketches yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Create your first menu sketch to get started
            </p>
            <Button
              onClick={() => createSketch.mutate(undefined)}
              disabled={createSketch.isPending}
              size="sm"
              className="mt-4"
            >
              <Plus className="h-4 w-4" />
              New Menu
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sketches.map((sketch) => (
              <Link
                key={sketch.id}
                href={`/menu-sketch/${sketch.id}`}
                className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-elevation-1 transition-all hover:shadow-elevation-2"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-base font-medium text-foreground">
                      {sketch.name}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sketch.status === 'archived' && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground/70">
                          Archived
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        v{sketch.version}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteTarget({ id: sketch.id, name: sketch.name });
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete sketch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated{' '}
                    {formatDistanceToNow(
                      new Date(
                        sketch.updated_at.endsWith('Z') || sketch.updated_at.includes('+')
                          ? sketch.updated_at
                          : sketch.updated_at + 'Z'
                      ),
                      { addSuffix: true }
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete sketch"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            deleteSketch.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
