'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, MapPin, Phone, Mail, Trash2, Package, Plus } from 'lucide-react';
import {
  useSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useSupplierIngredients,
  useIngredients,
  useAddSupplierIngredient,
  useUpdateSupplierIngredient,
  useRemoveSupplierIngredient,
} from '@/lib/hooks';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, EditableCell, Input, Select, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { UpdateSupplierIngredientRequest } from '@/types';

// Unit options (same as ingredient page)
const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'l', label: 'l (liters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
];

interface SupplierPageProps {
  params: Promise<{ id: string }>;
}

export default function SupplierPage({ params }: SupplierPageProps) {
  const { id } = use(params);
  const supplierId = parseInt(id, 10);
  const router = useRouter();

  const { data: supplier, isLoading, error } = useSupplier(supplierId);
  const { data: availableIngredients } = useIngredients(false); // Include inactive too
  const { data: supplierIngredients = [] } = useSupplierIngredients(supplierId);

  const updateSupplierMutation = useUpdateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();
  const addIngredientMutation = useAddSupplierIngredient();
  const updateIngredientMutation = useUpdateSupplierIngredient();
  const removeIngredientMutation = useRemoveSupplierIngredient();

  const [formData, setFormData] = useState({
    ingredient_id: '',
    sku: '',
    pack_size: '',
    price_per_pack: '',
    unit_cost: '',
    pack_unit: '',
    is_preferred: false,
  });

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

  const handleUpdateIngredient = (ingredientId: number, data: UpdateSupplierIngredientRequest) => {
    updateIngredientMutation.mutate({
      supplierId,
      ingredientId,
      data,
    });
  };

  const handleDeleteIngredient = (ingredientId: number) => {
    removeIngredientMutation.mutate({
      supplierId,
      ingredientId,
    });
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ingredient_id || !formData.unit_cost || !formData.pack_unit || !formData.pack_size || !formData.price_per_pack) {
      return;
    }

    const selectedIngredient = availableIngredients?.find(
      (i) => i.id === parseInt(formData.ingredient_id, 10)
    );

    addIngredientMutation.mutate(
      {
        supplierId,
        data: {
          ingredient_id: parseInt(formData.ingredient_id, 10),
          supplier_name: supplier?.name || '',
          sku: formData.sku || null,
          pack_size: parseFloat(formData.pack_size),
          pack_unit: formData.pack_unit,
          price_per_pack: parseFloat(formData.price_per_pack),
          cost_per_unit: parseFloat(formData.unit_cost),
          is_preferred: formData.is_preferred,
        },
      },
      {
        onSuccess: () => {
          setFormData({
            ingredient_id: '',
            sku: '',
            pack_size: '',
            price_per_pack: '',
            unit_cost: '',
            pack_unit: '',
            is_preferred: false,
          });
          toast.success(`${selectedIngredient?.name || 'Ingredient'} added`);
        },
        onError: (error) => {
          // Check for 409 Conflict (duplicate supplier-ingredient link)
          if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
            toast.error(`${selectedIngredient?.name || 'This ingredient'} is already linked to this supplier`);
          } else {
            toast.error('Failed to add ingredient');
          }
        },
      }
    );
  };

  // Filter out ingredients that already have this supplier
  const existingIngredientIds = new Set(supplierIngredients.map((i) => i.ingredient_id));
  const availableToAdd = availableIngredients?.filter((i) => !existingIngredientIds.has(i.id)) || [];

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

            {/* Ingredients Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Ingredients
                  </h2>
                </div>

                {/* Add Ingredient Form */}
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Ingredient
                  </h3>
                  <form onSubmit={handleAddIngredient} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Ingredient
                        </label>
                        <Select
                          value={formData.ingredient_id}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, ingredient_id: e.target.value }))
                          }
                          options={[
                            { value: '', label: 'Select ingredient...' },
                            ...availableToAdd.map((i) => ({
                              value: i.id.toString(),
                              label: i.name,
                            })),
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          SKU
                        </label>
                        <Input
                          type="text"
                          placeholder="e.g., SKU-001"
                          value={formData.sku}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, sku: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Pack Size
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.pack_size}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, pack_size: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Price/Pack
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.price_per_pack}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, price_per_pack: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Unit Cost
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.unit_cost}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, unit_cost: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Pack Unit
                        </label>
                        <Select
                          value={formData.pack_unit}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, pack_unit: e.target.value }))
                          }
                          options={[
                            { value: '', label: 'Select unit...' },
                            ...UNIT_OPTIONS,
                          ]}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id="is_preferred_ingredient"
                          checked={formData.is_preferred}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, is_preferred: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <label htmlFor="is_preferred_ingredient" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Preferred Supplier
                        </label>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          type="submit"
                          disabled={
                            !formData.ingredient_id ||
                            !formData.unit_cost ||
                            !formData.pack_unit ||
                            !formData.pack_size ||
                            !formData.price_per_pack ||
                            addIngredientMutation.isPending
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Ingredient
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Ingredients Table */}
                {supplierIngredients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Ingredient
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            SKU
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Pack Size
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Price/Pack
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Unit Cost
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Pack Unit
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierIngredients.map((ingredient) => (
                          <tr
                            key={ingredient.ingredient_id}
                            className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                              <Link
                                href={`/ingredients/${ingredient.ingredient_id}`}
                                className="hover:text-purple-600 dark:hover:text-purple-400"
                              >
                                {ingredient.ingredient_name}
                              </Link>
                            </td>
                            <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                              <EditableCell
                                value={ingredient.sku ?? ''}
                                onSave={(value) => handleUpdateIngredient(ingredient.ingredient_id, { sku: value || null })}
                                displayValue={ingredient.sku ?? '-'}
                              />
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              <EditableCell
                                value={ingredient.pack_size.toString()}
                                onSave={(value) => handleUpdateIngredient(ingredient.ingredient_id, { pack_size: parseFloat(value) })}
                                type="number"
                                className="text-right"
                              />
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              <EditableCell
                                value={ingredient.price_per_pack.toString()}
                                onSave={(value) => handleUpdateIngredient(ingredient.ingredient_id, { price_per_pack: parseFloat(value) })}
                                type="number"
                                className="text-right"
                                displayValue={formatCurrency(ingredient.price_per_pack)}
                              />
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              <EditableCell
                                value={ingredient.cost_per_unit.toString()}
                                onSave={(value) => handleUpdateIngredient(ingredient.ingredient_id, { cost_per_unit: parseFloat(value) })}
                                type="number"
                                className="text-right"
                                displayValue={formatCurrency(ingredient.cost_per_unit)}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={ingredient.pack_unit}
                                onChange={(e) => handleUpdateIngredient(ingredient.ingredient_id, { pack_unit: e.target.value })}
                                className="px-1 py-0.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                              >
                                {UNIT_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.value}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteIngredient(ingredient.ingredient_id)}
                                disabled={removeIngredientMutation.isPending}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <Package className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No ingredients added yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
