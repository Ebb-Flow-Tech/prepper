'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, ImagePlus, Plus, Trash2, Truck } from 'lucide-react';
import { useIngredient } from '@/lib/hooks';
import { Badge, Button, Card, CardContent, Input, Select, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

// Hardcoded suppliers data (to be replaced with API call later)
const AVAILABLE_SUPPLIERS = [
  { id: 1, name: 'Fresh Farms Co.' },
  { id: 2, name: 'Metro Wholesale' },
  { id: 3, name: 'Organic Direct' },
  { id: 4, name: 'Prime Foods Ltd.' },
];

// Unit options (same as Add Ingredient form)
const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'l', label: 'l (liters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
];

interface IngredientSupplier {
  id: number;
  supplier_id: number;
  supplier_name: string;
  sku: string;
  unit_cost: number;
  base_unit: string;
}

// Hardcoded initial supplier data for ingredients
const INITIAL_SUPPLIERS: IngredientSupplier[] = [
  { id: 1, supplier_id: 1, supplier_name: 'Fresh Farms Co.', sku: 'FF-TOM-001', unit_cost: 2.50, base_unit: 'kg' },
  { id: 2, supplier_id: 2, supplier_name: 'Metro Wholesale', sku: 'MW-TOM-234', unit_cost: 2.25, base_unit: 'kg' },
];

interface IngredientPageProps {
  params: Promise<{ id: string }>;
}

export default function IngredientPage({ params }: IngredientPageProps) {
  const { id } = use(params);
  const ingredientId = parseInt(id, 10);

  const { data: ingredient, isLoading, error } = useIngredient(ingredientId);

  // Supplier state management
  const [suppliers, setSuppliers] = useState<IngredientSupplier[]>(INITIAL_SUPPLIERS);
  const [formData, setFormData] = useState({
    supplier_id: '',
    sku: '',
    unit_cost: '',
    base_unit: '',
  });

  const handleDeleteSupplier = (supplierId: number) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedSupplier = AVAILABLE_SUPPLIERS.find(
      (s) => s.id === parseInt(formData.supplier_id, 10)
    );

    if (!selectedSupplier || !formData.sku || !formData.unit_cost || !formData.base_unit) {
      return;
    }

    const newSupplier: IngredientSupplier = {
      id: Date.now(), // Temporary ID
      supplier_id: selectedSupplier.id,
      supplier_name: selectedSupplier.name,
      sku: formData.sku,
      unit_cost: parseFloat(formData.unit_cost),
      base_unit: formData.base_unit,
    };

    setSuppliers((prev) => [...prev, newSupplier]);
    setFormData({ supplier_id: '', sku: '', unit_cost: '', base_unit: '' });
  };

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/ingredients"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ingredients
        </Link>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Ingredient not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/ingredients"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ingredients
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-lg" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          </div>
        ) : ingredient ? (
          <>
            {/* Ingredient Header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Placeholder for hero image */}
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <ImagePlus className="h-8 w-8" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {ingredient.name}
                        </h1>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={ingredient.is_active ? 'success' : 'warning'}>
                          {ingredient.is_active ? 'Active' : 'Archived'}
                        </Badge>
                        <Button variant="outline" size="sm" disabled>
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Unit Cost:{' '}
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {ingredient.cost_per_base_unit !== null
                              ? formatCurrency(ingredient.cost_per_base_unit)
                              : '-'}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Base Unit:{' '}
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {ingredient.base_unit}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400">
                      Created: {new Date(ingredient.created_at).toLocaleDateString()}
                      {ingredient.updated_at !== ingredient.created_at && (
                        <span className="ml-4">
                          Updated: {new Date(ingredient.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Suppliers Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Suppliers
                  </h2>
                </div>

                {/* Suppliers Table */}
                {suppliers.length > 0 ? (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Supplier ID
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Supplier Name
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            SKU
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Unit Cost
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Base Unit
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((supplier) => (
                          <tr
                            key={supplier.id}
                            className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300">
                              {supplier.supplier_id}
                            </td>
                            <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                              {supplier.supplier_name}
                            </td>
                            <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                              {supplier.sku}
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              {formatCurrency(supplier.unit_cost)}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="secondary">{supplier.base_unit}</Badge>
                            </td>
                            <td className="py-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSupplier(supplier.id)}
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
                  <div className="text-center py-6 mb-6 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <Truck className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No suppliers added yet
                    </p>
                  </div>
                )}

                {/* Add Supplier Form */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Supplier
                  </h3>
                  <form onSubmit={handleAddSupplier} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Supplier
                        </label>
                        <Select
                          value={formData.supplier_id}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, supplier_id: e.target.value }))
                          }
                          options={[
                            { value: '', label: 'Select supplier...' },
                            ...AVAILABLE_SUPPLIERS.map((s) => ({
                              value: s.id.toString(),
                              label: s.name,
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
                          Base Unit
                        </label>
                        <Select
                          value={formData.base_unit}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, base_unit: e.target.value }))
                          }
                          options={[
                            { value: '', label: 'Select unit...' },
                            ...UNIT_OPTIONS,
                          ]}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={
                          !formData.supplier_id ||
                          !formData.sku ||
                          !formData.unit_cost ||
                          !formData.base_unit
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Supplier
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
