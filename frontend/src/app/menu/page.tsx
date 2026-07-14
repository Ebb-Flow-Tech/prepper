'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { useMenuSketches, useCreateMenuSketch, useDeleteMenuSketch } from '@/lib/hooks';
import { Button, Card, Skeleton, Badge, PageHeader, ConfirmModal } from '@/components/ui';

export default function MenuPage() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: sketches, isLoading: sketchesLoading } = useMenuSketches({ include_archived: showArchived });
  const createSketch = useCreateMenuSketch();
  const deleteSketch = useDeleteMenuSketch();

  const handleNewDraft = () => {
    createSketch.mutate('New Draft Menu');
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Menu"
          description="Brainstorm and sketch menus quickly"
        >
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            View Archives
          </label>
          <Button onClick={handleNewDraft} disabled={createSketch.isPending} className="gap-2">
            <Plus className="h-4 w-4" />
            New Draft
          </Button>
        </PageHeader>

        {sketchesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : sketches && sketches.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sketches.map((sketch) => (
              <Card
                key={sketch.id}
                className="flex cursor-pointer flex-col justify-between p-4 hover:shadow-elevation-2 transition-shadow"
                onClick={() => router.push(`/menu-sketch/${sketch.id}`)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{sketch.name || 'Untitled'}</h3>
                    <Badge variant="secondary" className="shrink-0">
                      v{sketch.version}
                    </Badge>
                    {sketch.status === 'archived' && (
                      <Badge variant="destructive" className="shrink-0">
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/menu-sketch/${sketch.id}`)}
                    className="flex-1"
                  >
                    Open
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget({ id: sketch.id, name: sketch.name })}
                    disabled={deleteSketch.isPending}
                    title="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No draft menus yet.</p>
            <Button onClick={handleNewDraft} disabled={createSketch.isPending}>
              Create your first draft
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete draft"
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
