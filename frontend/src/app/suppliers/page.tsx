'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import Link from 'next/link';
import { Plus, Trash2, Check, X, MapPin, Phone, Mail, ArchiveRestore } from 'lucide-react';
import { useSuppliers, useUpdateSupplier, useDeactivateSupplier } from '@/lib/hooks';
import { PageHeader, SearchInput, Button, Skeleton, Input, Card, CardHeader, CardTitle, CardContent, ViewToggle, Checkbox, Badge } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { AddSupplierModal, SupplierListRow } from '@/components/suppliers';
import { toast } from 'sonner';
import type { Supplier } from '@/types';

type ViewType = 'grid' | 'list';

function OverflowTooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = ref.current;
    if (el) {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [checkOverflow]);

  return (
    <span ref={ref} className="truncate block" title={isOverflowing ? text : undefined}>
      {children}
    </span>
  );
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(supplier.name);
  const [editAddress, setEditAddress] = useState(supplier.address || '');
  const [editPhone, setEditPhone] = useState(supplier.phone_number || '');
  const [editEmail, setEditEmail] = useState(supplier.email || '');
  const updateSupplier = useUpdateSupplier();
  const deactivateSupplier = useDeactivateSupplier();

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

  const handleArchive = () => {
    deactivateSupplier.mutate(supplier.id, {
      onSuccess: () => {
        toast.success('Supplier archived');
      },
      onError: () => toast.error('Failed to archive supplier'),
    });
  };

  const handleUnarchive = () => {
    updateSupplier.mutate(
      {
        id: supplier.id,
        data: { is_active: true },
      },
      {
        onSuccess: () => {
          toast.success('Supplier restored');
        },
        onError: () => toast.error('Failed to restore supplier'),
      }
    );
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
          <div className="flex items-center justify-between w-full gap-2">
            <Link href={`/suppliers/${supplier.id}`} className="min-w-0 flex-1">
              <div>
                <CardTitle className="text-xl cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                  <OverflowTooltip text={supplier.name}>{supplier.name}</OverflowTooltip>
                </CardTitle>
                {!supplier.is_active && (
                  <Badge variant="secondary" className="mt-1">Archived</Badge>
                )}
              </div>
            </Link>
            {supplier.is_active ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleArchive}
                disabled={deactivateSupplier.isPending}
                title="Archive supplier"
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUnarchive}
                disabled={updateSupplier.isPending}
                title="Restore supplier"
                className="shrink-0"
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
            )}
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
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 shrink-0" />
                <OverflowTooltip text={supplier.address}>{supplier.address}</OverflowTooltip>
              </div>
            )}
            {supplier.phone_number && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{supplier.phone_number}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 shrink-0" />
                <OverflowTooltip text={supplier.email}>{supplier.email}</OverflowTooltip>
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
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => setPageNumber(1), [debouncedSearch]);

  const { data, isLoading, error } = useSuppliers({
    active_only: !showArchived,
    page_size: 30,
    page_number: pageNumber,
    search: debouncedSearch || undefined,
  });
  const filteredSuppliers = data?.items ?? [];
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<ViewType>('grid');

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

        {/* Pagination */}
        {data && (
          <Pagination
            pageNumber={data.page_number}
            totalPages={data.total_pages}
            totalCount={data.total_count}
            currentPageSize={data.current_page_size}
            onPageChange={setPageNumber}
          />
        )}
      </div>
    </div>
  );
}
