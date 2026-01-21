'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Archive, ArchiveRestore, ImagePlus, Plus, RefreshCw, Trash2, Truck, MoreVertical, Check, X, Edit as EditIcon } from 'lucide-react';
import {
  useIngredient,
  useUpdateIngredient,
  useDeactivateIngredient,
  useSuppliers,
  useIngredientSuppliers,
  useAddIngredientSupplier,
  useRemoveIngredientSupplier,
  useUpdateIngredientSupplier,
  useCategories,
  useCategorizeIngredient,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, EditableCell, Input, Modal, Select, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { UpdateIngredientSupplierRequest } from '@/types';

// Unit options (same as Add Ingredient form)
const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'l', label: 'l (liters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
];

// Calculate median from an array of numbers
function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Get suppliers that match a specific unit
function getSuppliersWithUnit(suppliers: { pack_unit: string; cost_per_unit: number }[], unit: string) {
  return suppliers.filter((s) => s.pack_unit === unit);
}

// Inline editable select component
interface EditableSelectProps {
  value: string;
  onSave: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

function EditableSelect({ value, onSave, options, className = '' }: EditableSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setIsEditing(false);
    if (newValue !== value) {
      onSave(newValue);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`px-1 py-0.5 text-sm border border-purple-400 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white dark:bg-zinc-800 ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const displayLabel = options.find((opt) => opt.value === value)?.label ?? value;

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded font-medium text-zinc-900 dark:text-zinc-100 ${className}`}
    >
      {displayLabel}
    </span>
  );
}

interface IngredientPageProps {
  params: Promise<{ id: string }>;
}

export default function IngredientPage({ params }: IngredientPageProps) {
  const { id } = use(params);
  const ingredientId = parseInt(id, 10);

  const { data: ingredient, isLoading, error } = useIngredient(ingredientId);
  const { data: availableSuppliers } = useSuppliers();
  const { data: suppliers = [] } = useIngredientSuppliers(ingredientId);
  const { data: categories = [] } = useCategories();

  const addSupplierMutation = useAddIngredientSupplier();
  const removeSupplierMutation = useRemoveIngredientSupplier();
  const updateSupplierMutation = useUpdateIngredientSupplier();
  const updateIngredientMutation = useUpdateIngredient();
  const deactivateIngredientMutation = useDeactivateIngredient();
  const categorizeIngredientMutation = useCategorizeIngredient();

  const handleUpdateIngredient = (data: { name?: string; base_unit?: string; cost_per_base_unit?: number | null; is_active?: boolean; category_id?: number | null }) => {
    updateIngredientMutation.mutate({ id: ingredientId, data });
  };

  const handleReassignCategory = async () => {
    if (!ingredient) return;

    try {
      const result = await categorizeIngredientMutation.mutateAsync(ingredient.name);
      if (result.category_id) {
        handleUpdateIngredient({ category_id: result.category_id });
        const categoryName = categories.find((c) => c.id === result.category_id)?.name ?? 'Unknown';
        toast.success(`Category assigned: ${categoryName}`);
      } else {
        toast.error('Failed to determine category');
      }
    } catch {
      toast.error('Failed to reassign category');
    }
  };

  const currentCategory = categories.find((c) => c.id === ingredient?.category_id);

  // Recalculate and update median cost based on current suppliers
  const recalculateMedianCost = (updatedSuppliers: typeof suppliers) => {
    if (!ingredient) return;
    const suppliersWithUnit = getSuppliersWithUnit(updatedSuppliers, ingredient.base_unit);
    const newMedianCost = suppliersWithUnit.length > 0
      ? calculateMedian(suppliersWithUnit.map((s) => s.cost_per_unit))
      : null;
    // Only update if there's a change
    if (newMedianCost !== ingredient.cost_per_base_unit) {
      updateIngredientMutation.mutate({ id: ingredientId, data: { cost_per_base_unit: newMedianCost } });
    }
  };

  const handleArchive = () => {
    deactivateIngredientMutation.mutate(ingredientId, {
      onSuccess: () => toast.success(`${ingredient?.name} archived`),
      onError: () => toast.error(`Failed to archive ${ingredient?.name}`),
    });
  };

  const handleUnarchive = () => {
    updateIngredientMutation.mutate(
      { id: ingredientId, data: { is_active: true } },
      {
        onSuccess: () => toast.success(`${ingredient?.name} unarchived`),
        onError: () => toast.error(`Failed to unarchive ${ingredient?.name}`),
      }
    );
  };

  const handleUpdateSupplier = (supplierId: string, data: UpdateIngredientSupplierRequest) => {
    updateSupplierMutation.mutate(
      {
        ingredientId,
        supplierId,
        data,
      },
      {
        onSuccess: () => {
          // Recalculate median if cost_per_unit or pack_unit changed
          if (data.cost_per_unit !== undefined || data.pack_unit !== undefined) {
            const updatedSuppliers = suppliers.map((s) =>
              s.supplier_id === supplierId ? { ...s, ...data } : s
            );
            recalculateMedianCost(updatedSuppliers);
          }
        },
      }
    );
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, UpdateIngredientSupplierRequest>>({});
  const [formData, setFormData] = useState({
    supplier_id: '',
    sku: '',
    unit_cost: '',
    pack_unit: '',
    pack_size: '',
    price_per_pack: '',
  });

  // Filter out suppliers that are already linked to this ingredient
  const existingSupplierIds = new Set(suppliers.map((s) => s.supplier_id));
  const suppliersToAdd = availableSuppliers?.filter((s) => !existingSupplierIds.has(s.id.toString())) || [];

  const handleDeleteSupplier = (supplierId: string) => {
    removeSupplierMutation.mutate(
      {
        ingredientId,
        supplierId,
      },
      {
        onSuccess: () => {
          // Recalculate median after removing supplier
          const updatedSuppliers = suppliers.filter((s) => s.supplier_id !== supplierId);
          recalculateMedianCost(updatedSuppliers);
        },
      }
    );
  };

  const calculateUnitCost = (packSize: number, pricePerPack: number): number => {
    return packSize > 0 ? pricePerPack / packSize : 0;
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedSupplier = availableSuppliers?.find(
      (s) => s.id === parseInt(formData.supplier_id, 10)
    );

    if (!selectedSupplier || !formData.pack_unit || !formData.pack_size || !formData.price_per_pack) {
      return;
    }

    const packSize = parseFloat(formData.pack_size);
    const pricePerPack = parseFloat(formData.price_per_pack);
    const calculatedUnitCost = calculateUnitCost(packSize, pricePerPack);

    addSupplierMutation.mutate(
      {
        ingredientId,
        data: {
          supplier_id: selectedSupplier.id.toString(),
          supplier_name: selectedSupplier.name,
          sku: formData.sku || null,
          pack_size: packSize,
          pack_unit: formData.pack_unit,
          price_per_pack: pricePerPack,
          cost_per_unit: calculatedUnitCost,
          currency: "SGD",
          is_preferred: false,
          source: "manual"
        },
      },
      {
        onSuccess: () => {
          toast.success(`${selectedSupplier.name} added as supplier`);
          // Recalculate median after adding supplier
          const newSupplier = {
            supplier_id: selectedSupplier.id.toString(),
            supplier_name: selectedSupplier.name,
            sku: formData.sku || null,
            pack_size: packSize,
            pack_unit: formData.pack_unit,
            price_per_pack: pricePerPack,
            cost_per_unit: calculatedUnitCost,
            currency: "SGD",
            is_preferred: false,
            source: "manual",
            last_updated: null,
            last_synced: null,
          };
          const updatedSuppliers = [...suppliers, newSupplier];
          recalculateMedianCost(updatedSuppliers);
          setFormData({
            supplier_id: '',
            sku: '',
            unit_cost: '',
            pack_unit: '',
            pack_size: '',
            price_per_pack: '',
          });
          setShowAddModal(false);
        },
        onError: (error) => {
          // Check for 409 Conflict (duplicate supplier)
          if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
            toast.error(`${selectedSupplier.name} is already a supplier for this ingredient`);
          } else {
            toast.error('Failed to add supplier');
          }
        },
      }
    );
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
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          <EditableCell
                            value={ingredient.name}
                            onSave={(value) => handleUpdateIngredient({ name: value })}
                            className="text-2xl font-bold"
                          />
                        </h1>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={ingredient.is_active ? 'success' : 'warning'}>
                          {ingredient.is_active ? 'Active' : 'Archived'}
                        </Badge>
                        {ingredient.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleArchive}
                            disabled={deactivateIngredientMutation.isPending}
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUnarchive}
                            disabled={updateIngredientMutation.isPending}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-1" />
                            Unarchive
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {(() => {
                        const suppliersWithUnit = getSuppliersWithUnit(suppliers, ingredient.base_unit);
                        const hasSupplierWithUnit = suppliersWithUnit.length > 0;
                        const medianCost = hasSupplierWithUnit
                          ? calculateMedian(suppliersWithUnit.map((s) => s.cost_per_unit))
                          : null;
                        const displayCost = hasSupplierWithUnit ? medianCost : ingredient.cost_per_base_unit;

                        return (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-zinc-500 dark:text-zinc-400">Unit Cost:</span>
                            {hasSupplierWithUnit ? (
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {displayCost !== null ? formatCurrency(displayCost) : '-'}
                                <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                                  (median from {suppliersWithUnit.length} supplier{suppliersWithUnit.length > 1 ? 's' : ''})
                                </span>
                              </span>
                            ) : (
                              <EditableCell
                                value={ingredient.cost_per_base_unit?.toString() ?? ''}
                                onSave={(value) => handleUpdateIngredient({ cost_per_base_unit: value ? parseFloat(value) : null })}
                                type="number"
                                className="font-medium text-zinc-900 dark:text-zinc-100"
                                displayValue={ingredient.cost_per_base_unit !== null ? formatCurrency(ingredient.cost_per_base_unit) : '-'}
                              />
                            )}
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Base Unit:</span>
                        <EditableSelect
                          value={ingredient.base_unit}
                          onSave={(newUnit) => {
                            const suppliersWithNewUnit = getSuppliersWithUnit(suppliers, newUnit);
                            const newMedianCost = suppliersWithNewUnit.length > 0
                              ? calculateMedian(suppliersWithNewUnit.map((s) => s.cost_per_unit))
                              : null;
                            // Update base_unit and cost_per_base_unit together
                            handleUpdateIngredient({
                              base_unit: newUnit,
                              cost_per_base_unit: newMedianCost,
                            });
                          }}
                          options={UNIT_OPTIONS}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Category:</span>
                        <Badge variant={currentCategory ? 'default' : 'secondary'}>
                          {currentCategory?.name ?? 'N/A'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleReassignCategory}
                          disabled={categorizeIngredientMutation.isPending}
                          className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-950"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${categorizeIngredientMutation.isPending ? 'animate-spin' : ''}`} />
                          {categorizeIngredientMutation.isPending ? 'Assigning...' : 'Reassign'}
                        </Button>
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

                {/* Add Supplier Button */}
                <div className="mb-4">
                  <Button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Supplier
                  </Button>
                </div>

                {/* Add Supplier Modal */}
                <Modal
                  isOpen={showAddModal}
                  onClose={() => setShowAddModal(false)}
                  title="Add Supplier"
                  maxWidth="max-w-lg"
                >
                  <form onSubmit={handleAddSupplier} className="space-y-4">
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
                          ...suppliersToAdd.map((s) => ({
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
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        Unit Cost
                      </label>
                      <div className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        {formData.pack_size && formData.price_per_pack
                          ? formatCurrency(calculateUnitCost(parseFloat(formData.pack_size), parseFloat(formData.price_per_pack)))
                          : formatCurrency(0)}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          !formData.supplier_id ||
                          !formData.pack_unit ||
                          !formData.pack_size ||
                          !formData.price_per_pack ||
                          addSupplierMutation.isPending
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Supplier
                      </Button>
                    </div>
                  </form>
                </Modal>

                {/* Suppliers Table */}
                {suppliers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Supplier Name
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            SKU
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Pack Size
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Pack Unit
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Price/Pack
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Unit Cost
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((supplier) => (
                          <tr
                            key={supplier.supplier_id}
                            className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group"
                          >
                            <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                              <Link
                                href={`/suppliers/${supplier.supplier_id}`}
                                className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                              >
                                {supplier.supplier_name}
                              </Link>
                            </td>
                            <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                              {editingSupplier === supplier.supplier_id ? (
                                <input
                                  type="text"
                                  value={editData[supplier.supplier_id]?.sku ?? supplier.sku ?? ''}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [supplier.supplier_id]: {
                                        ...editData[supplier.supplier_id],
                                        sku: e.target.value || null,
                                      },
                                    })
                                  }
                                  placeholder="e.g., SKU-001"
                                  className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                              ) : (
                                supplier.sku ?? '-'
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              {editingSupplier === supplier.supplier_id ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editData[supplier.supplier_id]?.pack_size ?? supplier.pack_size}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [supplier.supplier_id]: {
                                        ...editData[supplier.supplier_id],
                                        pack_size: parseFloat(e.target.value),
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 text-right"
                                />
                              ) : (
                                supplier.pack_size
                              )}
                            </td>
                            <td className="py-3 px-2">
                              {editingSupplier === supplier.supplier_id ? (
                                <select
                                  value={editData[supplier.supplier_id]?.pack_unit ?? supplier.pack_unit}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [supplier.supplier_id]: {
                                        ...editData[supplier.supplier_id],
                                        pack_unit: e.target.value,
                                      },
                                    })
                                  }
                                  className="px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 w-full"
                                >
                                  {UNIT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                supplier.pack_unit
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              {editingSupplier === supplier.supplier_id ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editData[supplier.supplier_id]?.price_per_pack ?? supplier.price_per_pack}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [supplier.supplier_id]: {
                                        ...editData[supplier.supplier_id],
                                        price_per_pack: parseFloat(e.target.value),
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 text-right"
                                />
                              ) : (
                                formatCurrency(supplier.price_per_pack)
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              {editingSupplier === supplier.supplier_id
                                ? formatCurrency(
                                    calculateUnitCost(
                                      editData[supplier.supplier_id]?.pack_size ?? supplier.pack_size,
                                      editData[supplier.supplier_id]?.price_per_pack ?? supplier.price_per_pack
                                    )
                                  )
                                : formatCurrency(supplier.cost_per_unit)}
                            </td>
                            <td className="py-3 px-2">
                              <div className="relative group/menu">
                                {/* Three dots button */}
                                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1">
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {/* Dropdown menu */}
                                <div className="absolute right-0 top-full mt-0 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-md shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 min-w-max">
                                  {editingSupplier === supplier.supplier_id ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingSupplier(null);
                                          setEditData({});
                                        }}
                                        disabled={updateSupplierMutation.isPending}
                                        className="w-full justify-start text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-none first:rounded-t-md h-8 px-3"
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const dataToSave = editData[supplier.supplier_id];
                                          if (dataToSave) {
                                            const packSize = dataToSave.pack_size ?? supplier.pack_size;
                                            const pricePerPack = dataToSave.price_per_pack ?? supplier.price_per_pack;
                                            const calculatedCost = packSize > 0 ? pricePerPack / packSize : 0;
                                            handleUpdateSupplier(supplier.supplier_id, {
                                              ...dataToSave,
                                              cost_per_unit: calculatedCost,
                                            });
                                            setEditingSupplier(null);
                                            setEditData({});
                                          }
                                        }}
                                        disabled={updateSupplierMutation.isPending}
                                        className="w-full justify-start text-green-600 hover:text-green-700 dark:hover:text-green-400 rounded-none last:rounded-b-md h-8 px-3"
                                      >
                                        <Check className="h-4 w-4 mr-2" />
                                        Save
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingSupplier(supplier.supplier_id);
                                          setEditData({
                                            [supplier.supplier_id]: {
                                              sku: supplier.sku,
                                              pack_size: supplier.pack_size,
                                              price_per_pack: supplier.price_per_pack,
                                              pack_unit: supplier.pack_unit,
                                            },
                                          });
                                        }}
                                        className="w-full justify-start text-[hsl(var(--primary))] hover:opacity-80 rounded-none first:rounded-t-md h-8 px-3"
                                      >
                                        <EditIcon className="h-4 w-4 mr-2" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteSupplier(supplier.supplier_id)}
                                        disabled={removeSupplierMutation.isPending}
                                        className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-none last:rounded-b-md h-8 px-3"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <Truck className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-zinc-400 dark:text-zinc-500">
                      No suppliers added yet
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
