'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from '@/lib/hooks';
import { PageHeader, SearchInput, Button, Skeleton, Input, Card, CardHeader, CardTitle } from '@/components/ui';
import { toast } from 'sonner';
import type { Supplier } from '@/types';

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(supplier.name);
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const handleSave = () => {
    if (!editName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    if (editName.trim() === supplier.name) {
      setIsEditing(false);
      return;
    }
    updateSupplier.mutate(
      { id: supplier.id, data: { name: editName.trim() } },
      {
        onSuccess: () => {
          toast.success('Supplier updated');
          setIsEditing(false);
        },
        onError: () => toast.error('Failed to update supplier'),
      }
    );
  };

  const handleCancel = () => {
    setEditName(supplier.name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!confirm(`Delete supplier "${supplier.name}"?`)) return;
    deleteSupplier.mutate(supplier.id, {
      onSuccess: () => toast.success('Supplier deleted'),
      onError: () => toast.error('Failed to delete supplier'),
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        {isEditing ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={updateSupplier.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <CardTitle
              className="truncate flex-1 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300"
              onClick={() => setIsEditing(true)}
            >
              {supplier.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleteSupplier.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

export default function SuppliersPage() {
  const { data: suppliers, isLoading, error } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];

    return suppliers.filter((supplier) => {
      if (search && !supplier.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [suppliers, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    createSupplier.mutate(
      {
        name: name.trim(),
      },
      {
        onSuccess: () => {
          toast.success('Supplier created');
        },
        onError: () => toast.error('Failed to create supplier'),
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load suppliers. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Suppliers"
          description="Manage your ingredient suppliers"
        >
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add new supplier"
              autoFocus
            />
            <Button type="submit" disabled={createSupplier.isPending} className="shrink-0 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Supplier</span>
            </Button>
          </form>
          {/* this is to just submit */}
        </PageHeader>
        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md">
            <SearchInput
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
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
        {!isLoading && filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No suppliers match your search' : 'No suppliers yet'}
            </p>
          </div>
        )}

        {/* Suppliers List */}
        {!isLoading && filteredSuppliers.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
