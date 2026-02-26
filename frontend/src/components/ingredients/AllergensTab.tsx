'use client';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { useAllergens, useUpdateAllergen, useDeleteAllergen } from '@/lib/hooks';
import { AddAllergenModal } from '@/components/allergens/AddAllergenModal';
import { AllergenCard } from '@/components/allergens/AllergenCard';
import { AllergenListRow } from '@/components/allergens/AllergenListRow';
import { PageHeader, SearchInput, Button, Skeleton, Input, Textarea, ViewToggle, Checkbox } from '@/components/ui';
import { toast } from 'sonner';
import type { Allergen } from '@/types';

type ViewType = 'grid' | 'list';

interface AllergenFormData {
  name: string;
  description: string;
}

interface EditAllergenModalProps {
  allergen: Allergen;
  onClose: () => void;
}

function EditAllergenModal({ allergen, onClose }: EditAllergenModalProps) {
  const updateAllergen = useUpdateAllergen();
  const [formData, setFormData] = useState<AllergenFormData>({
    name: allergen.name,
    description: allergen.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Allergen name is required');
      return;
    }

    updateAllergen.mutate(
      {
        id: allergen.id,
        data: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Allergen updated');
          onClose();
        },
        onError: () => {
          toast.error('Failed to update allergen');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-lg w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-lg">Edit Allergen</h3>
          <Button variant="ghost" size="icon" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Milk"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description for this allergen"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={updateAllergen.isPending}>
              {updateAllergen.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function AllergensTab() {
  const deactivateAllergen = useDeleteAllergen();
  const updateAllergen = useUpdateAllergen();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingAllergen, setEditingAllergen] = useState<Allergen | null>(null);
  const [view, setView] = useState<ViewType>('grid');
  const { data: allergens, isLoading, error } = useAllergens(showArchived);

  const filteredAllergens = useMemo(() => {
    if (!allergens) return [];

    return allergens.filter((allergen) => {
      if (search && !allergen.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allergens, search]);

  const handleArchive = (allergen: Allergen) => {
    deactivateAllergen.mutate(allergen.id, {
      onSuccess: () => toast.success(`${allergen.name} archived`),
      onError: () => toast.error(`Failed to archive ${allergen.name}`),
    });
  };

  const handleUnarchive = (allergen: Allergen) => {
    updateAllergen.mutate(
      { id: allergen.id, data: { is_active: true } },
      {
        onSuccess: () => toast.success(`${allergen.name} unarchived`),
        onError: () => toast.error(`Failed to unarchive ${allergen.name}`),
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load allergens. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Allergens"
          description="Manage food allergens"
        >
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Allergen</span>
          </Button>
        </PageHeader>

        <AddAllergenModal isOpen={showForm} onClose={() => setShowForm(false)} />

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search allergens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              label="Show archived"
            />

            <ViewToggle view={view} onViewChange={setView} />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          )
        )}

        {/* Empty State */}
        {!isLoading && filteredAllergens.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No allergens match your search' : 'No allergens yet'}
            </p>
          </div>
        )}

        {/* Allergens Grid */}
        {!isLoading && filteredAllergens.length > 0 && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAllergens.map((allergen) => (
                <AllergenCard
                  key={allergen.id}
                  allergen={allergen}
                  onEdit={setEditingAllergen}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {filteredAllergens.map((allergen) => (
                <AllergenListRow
                  key={allergen.id}
                  allergen={allergen}
                  onEdit={setEditingAllergen}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Edit Modal */}
      {editingAllergen && (
        <EditAllergenModal
          allergen={editingAllergen}
          onClose={() => setEditingAllergen(null)}
        />
      )}
    </div>
  );
}
