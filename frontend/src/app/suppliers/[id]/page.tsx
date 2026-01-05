'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, MapPin, Phone, Mail, Trash2 } from 'lucide-react';
import { useSupplier, useUpdateSupplier, useDeleteSupplier } from '@/lib/hooks';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, EditableCell, Skeleton } from '@/components/ui';

interface SupplierPageProps {
  params: Promise<{ id: string }>;
}

export default function SupplierPage({ params }: SupplierPageProps) {
  const { id } = use(params);
  const supplierId = parseInt(id, 10);
  const router = useRouter();

  const { data: supplier, isLoading, error } = useSupplier(supplierId);
  const updateSupplierMutation = useUpdateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();

  const handleUpdateSupplier = (data: { name?: string; address?: string | null; phone_number?: string | null; email?: string | null }) => {
    updateSupplierMutation.mutate(
      { id: supplierId, data },
      {
        onSuccess: () => toast.success('Supplier updated'),
        onError: () => toast.error('Failed to update supplier'),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm(`Delete supplier "${supplier?.name}"? This action cannot be undone.`)) return;
    deleteSupplierMutation.mutate(supplierId, {
      onSuccess: () => {
        toast.success('Supplier deleted');
        router.push('/suppliers');
      },
      onError: () => toast.error('Failed to delete supplier'),
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Suppliers
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Supplier not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Suppliers
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : supplier ? (
          <>
            {/* Supplier Header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Placeholder for hero image */}
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <ImagePlus className="h-8 w-8" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          <EditableCell
                            value={supplier.name}
                            onSave={(value) => handleUpdateSupplier({ name: value })}
                            className="text-2xl font-bold"
                          />
                        </h1>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="default">Supplier</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDelete}
                          disabled={deleteSupplierMutation.isPending}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 dark:text-zinc-400 w-16">Address:</span>
                        <EditableCell
                          value={supplier.address || ''}
                          onSave={(value) => handleUpdateSupplier({ address: value || null })}
                          className="font-medium text-zinc-900 dark:text-zinc-100 flex-1"
                          placeholder="Add address"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 dark:text-zinc-400 w-16">Phone:</span>
                        <EditableCell
                          value={supplier.phone_number || ''}
                          onSave={(value) => handleUpdateSupplier({ phone_number: value || null })}
                          className="font-medium text-zinc-900 dark:text-zinc-100 flex-1"
                          placeholder="Add phone number"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 dark:text-zinc-400 w-16">Email:</span>
                        <EditableCell
                          value={supplier.email || ''}
                          onSave={(value) => handleUpdateSupplier({ email: value || null })}
                          type="email"
                          className="font-medium text-zinc-900 dark:text-zinc-100 flex-1"
                          placeholder="Add email"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400">
                      Created: {new Date(supplier.created_at).toLocaleDateString()}
                      {supplier.updated_at !== supplier.created_at && (
                        <span className="ml-4">
                          Updated: {new Date(supplier.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
