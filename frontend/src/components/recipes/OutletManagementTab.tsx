'use client';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { useOutlets, useUpdateOutlet, useDeactivateOutlet } from '@/lib/hooks';
import { OutletCard, AddOutletModal } from '@/components/outlets';
import { PageHeader, SearchInput, Button, Skeleton, Input, Select } from '@/components/ui';
import { toast } from 'sonner';
import type { Outlet, UpdateOutletRequest, OutletType } from '@/types';

interface OutletFormData {
  name: string;
  code: string;
  outlet_type: OutletType;
  parent_outlet_id: number | null;
}

interface EditOutletModalProps {
  outlet: Outlet;
  allOutlets: Outlet[];
  onClose: () => void;
}

const OUTLET_TYPE_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'location', label: 'Location' },
];

function EditOutletModal({ outlet, allOutlets, onClose }: EditOutletModalProps) {
  const updateOutlet = useUpdateOutlet();
  const [formData, setFormData] = useState<OutletFormData>({
    name: outlet.name,
    code: outlet.code,
    outlet_type: outlet.outlet_type,
    parent_outlet_id: outlet.parent_outlet_id,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Outlet name is required');
      return;
    }
    if (!formData.code.trim()) {
      toast.error('Outlet code is required');
      return;
    }

    const updateData: UpdateOutletRequest = {
      name: formData.name.trim(),
      code: formData.code.trim(),
      outlet_type: formData.outlet_type,
      parent_outlet_id: formData.parent_outlet_id,
    };

    updateOutlet.mutate(
      { id: outlet.id, data: updateData },
      {
        onSuccess: () => {
          toast.success('Outlet updated');
          onClose();
        },
        onError: () => {
          toast.error('Failed to update outlet');
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
          <h3 className="font-medium text-lg">Edit Outlet</h3>
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
              placeholder="e.g., Main Branch"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="e.g., CS, TBH"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Outlet Type</label>
            <Select
              value={formData.outlet_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, outlet_type: e.target.value as OutletType }))}
              options={OUTLET_TYPE_OPTIONS}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Parent Outlet</label>
            <select
              value={formData.parent_outlet_id || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, parent_outlet_id: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None --</option>
              {allOutlets
                .filter((o) => o.id !== outlet.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={updateOutlet.isPending}>
              {updateOutlet.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function OutletManagementTab() {
  const deactivateOutlet = useDeactivateOutlet();
  const updateOutlet = useUpdateOutlet();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const { data: outlets, isLoading, error } = useOutlets(showArchived);

  const filteredOutlets = useMemo(() => {
    if (!outlets) return [];

    return outlets.filter((outlet) => {
      if (search && !outlet.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [outlets, search]);

  const handleArchive = (outlet: Outlet) => {
    deactivateOutlet.mutate(outlet.id, {
      onSuccess: () => toast.success(`${outlet.name} archived`),
      onError: () => toast.error(`Failed to archive ${outlet.name}`),
    });
  };

  const handleUnarchive = (outlet: Outlet) => {
    updateOutlet.mutate(
      { id: outlet.id, data: { is_active: true } },
      {
        onSuccess: () => toast.success(`${outlet.name} unarchived`),
        onError: () => toast.error(`Failed to unarchive ${outlet.name}`),
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load outlets. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Outlets"
          description="Manage brands and locations"
        >
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Outlet</span>
          </Button>
        </PageHeader>

        <AddOutletModal isOpen={showForm} onClose={() => setShowForm(false)} />

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search outlets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              Show archived
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredOutlets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No outlets match your search' : 'No outlets yet'}
            </p>
          </div>
        )}

        {/* Outlets Grid */}
        {!isLoading && filteredOutlets.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOutlets.map((outlet) => (
              <OutletCard
                key={outlet.id}
                outlet={outlet}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingOutlet && outlets && (
        <EditOutletModal
          outlet={editingOutlet}
          allOutlets={outlets}
          onClose={() => setEditingOutlet(null)}
        />
      )}
    </div>
  );
}
