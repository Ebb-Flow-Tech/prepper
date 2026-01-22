'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Check, X, MapPin, Phone, Mail } from 'lucide-react';
import { useSuppliers, useUpdateSupplier, useDeleteSupplier } from '@/lib/hooks';
import { PageHeader, SearchInput, Button, Skeleton, Input, Card, CardHeader, CardTitle, CardContent, ConfirmModal, ViewToggle } from '@/components/ui';
import { AddSupplierModal, SupplierListRow } from '@/components/suppliers';
import { toast } from 'sonner';
import type { Supplier } from '@/types';

type ViewType = 'grid' | 'list';

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editName, setEditName] = useState(supplier.name);
  const [editAddress, setEditAddress] = useState(supplier.address || '');
  const [editPhone, setEditPhone] = useState(supplier.phone_number || '');
  const [editEmail, setEditEmail] = useState(supplier.email || '');
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const handleSave = () => {
    if (!editName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    const hasChanges =
      editName.trim() !== supplier.name ||
      editAddress.trim() !== (supplier.address || '') ||
      editPhone.trim() !== (supplier.phone_number || '') ||
      editEmail.trim() !== (supplier.email || '');

    if (!hasChanges) {
      setIsEditing(false);
      return;
    }
    updateSupplier.mutate(
      {
        id: supplier.id,
        data: {
          name: editName.trim(),
          address: editAddress.trim() || undefined,
          phone_number: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined,
        },
      },
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
    setEditAddress(supplier.address || '');
    setEditPhone(supplier.phone_number || '');
    setEditEmail(supplier.email || '');
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    deleteSupplier.mutate(supplier.id, {
      onSuccess: () => {
        toast.success('Supplier deleted');
        setShowDeleteModal(false);
      },
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
              placeholder="Supplier name"
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
            <Link href={`/suppliers/${supplier.id}`} className="truncate flex-1">
              <CardTitle className="truncate text-xl cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                {supplier.name}
              </CardTitle>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              disabled={deleteSupplier.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <ConfirmModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={handleDeleteConfirm}
              title="Delete Supplier"
              message={`Are you sure you want to delete "${supplier.name}"? This action cannot be undone.`}
              confirmLabel="Delete"
              cancelLabel="Cancel"
              variant="destructive"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
              <Input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Address"
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Phone number"
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-zinc-400 shrink-0" />
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="flex-1"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {supplier.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{supplier.address}</span>
              </div>
            )}
            {supplier.phone_number && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{supplier.phone_number}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{supplier.email}</span>
              </div>
            )}
            {!supplier.address && !supplier.phone_number && !supplier.email && (
              <p className="text-zinc-400 dark:text-zinc-500 italic">No contact info</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuppliersPage() {
  const { data: suppliers, isLoading, error } = useSuppliers();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<ViewType>('grid');

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];

    return suppliers.filter((supplier) => {
      if (search && !supplier.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [suppliers, search]);

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
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Supplier</span>
          </Button>
        </PageHeader>
        <AddSupplierModal isOpen={showForm} onClose={() => setShowForm(false)} />
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
          <ViewToggle view={view} onViewChange={setView} />
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
        {!isLoading && filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No suppliers match your search' : 'No suppliers yet'}
            </p>
          </div>
        )}

        {/* Suppliers List */}
        {!isLoading && filteredSuppliers.length > 0 && (
          view === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSuppliers.map((supplier) => (
                <SupplierCard key={supplier.id} supplier={supplier} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {filteredSuppliers.map((supplier) => (
                <SupplierListRow key={supplier.id} supplier={supplier} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
