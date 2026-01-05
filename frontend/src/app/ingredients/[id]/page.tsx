'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Archive, ArchiveRestore, ImagePlus, Plus, Trash2, Truck } from 'lucide-react';
import {
  useIngredient,
  useUpdateIngredient,
  useDeactivateIngredient,
  useSuppliers,
  useIngredientSuppliers,
  useAddIngredientSupplier,
  useRemoveIngredientSupplier,
  useUpdateIngredientSupplier,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, Input, Select, Skeleton } from '@/components/ui';
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

// Inline editable cell component
interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'number';
  className?: string;
  displayValue?: string;
}

function EditableCell({ value, onSave, type = 'text', className = '', displayValue }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        step={type === 'number' ? '0.01' : undefined}
        className={`w-full px-1 py-0.5 text-sm border border-purple-400 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white dark:bg-zinc-800 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded ${className}`}
    >
      {displayValue ?? value ?? '-'}
    </span>
  );
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

  const addSupplierMutation = useAddIngredientSupplier();
  const removeSupplierMutation = useRemoveIngredientSupplier();
  const updateSupplierMutation = useUpdateIngredientSupplier();
  const updateIngredientMutation = useUpdateIngredient();
  const deactivateIngredientMutation = useDeactivateIngredient();

  const handleUpdateIngredient = (data: { name?: string; base_unit?: string; cost_per_base_unit?: number | null; is_active?: boolean }) => {
    updateIngredientMutation.mutate({ id: ingredientId, data });
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
    updateSupplierMutation.mutate({
      ingredientId,
      supplierId,
      data,
    });
  };

  const [formData, setFormData] = useState({
    supplier_id: '',
    sku: '',
    unit_cost: '',
    pack_unit: '',
    pack_size: '',
    price_per_pack: '',
    is_preferred: false,
  });

  const handleDeleteSupplier = (supplierId: string) => {
    removeSupplierMutation.mutate({
      ingredientId,
      supplierId,
    });
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedSupplier = availableSuppliers?.find(
      (s) => s.id === parseInt(formData.supplier_id, 10)
    );

    if (!selectedSupplier || !formData.unit_cost || !formData.pack_unit || !formData.pack_size || !formData.price_per_pack) {
      return;
    }

    addSupplierMutation.mutate(
      {
        ingredientId,
        data: {
          supplier_id: selectedSupplier.id.toString(),
          supplier_name: selectedSupplier.name,
          sku: formData.sku || null,
          pack_size: parseFloat(formData.pack_size),
          pack_unit: formData.pack_unit,
          price_per_pack: parseFloat(formData.price_per_pack),
          cost_per_unit: parseFloat(formData.unit_cost),
          currency: "SGD",
          is_preferred: formData.is_preferred,
          source: "manual"
        },
      },
      {
        onSuccess: () => {
          setFormData({
            supplier_id: '',
            sku: '',
            unit_cost: '',
            pack_unit: '',
            pack_size: '',
            price_per_pack: '',
            is_preferred: false,
          });
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
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Unit Cost:</span>
                        <EditableCell
                          value={ingredient.cost_per_base_unit?.toString() ?? ''}
                          onSave={(value) => handleUpdateIngredient({ cost_per_base_unit: value ? parseFloat(value) : null })}
                          type="number"
                          className="font-medium text-zinc-900 dark:text-zinc-100"
                          displayValue={ingredient.cost_per_base_unit !== null ? formatCurrency(ingredient.cost_per_base_unit) : '-'}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Base Unit:</span>
                        <EditableSelect
                          value={ingredient.base_unit}
                          onSave={(value) => handleUpdateIngredient({ base_unit: value })}
                          options={UNIT_OPTIONS}
                        />
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

                {/* Add Supplier Form */}
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
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
                            ...(availableSuppliers ?? []).map((s) => ({
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
                          id="is_preferred"
                          checked={formData.is_preferred}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, is_preferred: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <label htmlFor="is_preferred" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Preferred Supplier
                        </label>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          type="submit"
                          disabled={
                            !formData.supplier_id ||
                            !formData.unit_cost ||
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
                    </div>
                  </form>
                </div>

                {/* Suppliers Table */}
                {suppliers.length > 0 ? (
                  <div className="overflow-x-auto">
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
                            Pack Size
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Price/Pack
                          </th>
                          <th className="text-center py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Preferred
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Cost/Unit
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-zinc-500 dark:text-zinc-400">
                            Pack Unit
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((supplier) => (
                          <tr
                            key={supplier.supplier_id}
                            className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300">
                              {supplier.supplier_id}
                            </td>
                            <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                              <EditableCell
                                value={supplier.supplier_name}
                                onSave={(value) => handleUpdateSupplier(supplier.supplier_id, { supplier_name: value })}
                              />
                            </td>
                            <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                              <EditableCell
                                value={supplier.sku ?? ''}
                                onSave={(value) => handleUpdateSupplier(supplier.supplier_id, { sku: value || null })}
                                displayValue={supplier.sku ?? '-'}
                              />
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              <EditableCell
                                value={supplier.pack_size.toString()}
                                onSave={(value) => handleUpdateSupplier(supplier.supplier_id, { pack_size: parseFloat(value) })}
                                type="number"
                                className="text-right"
                              />
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              <EditableCell
                                value={supplier.price_per_pack.toString()}
                                onSave={(value) => handleUpdateSupplier(supplier.supplier_id, { price_per_pack: parseFloat(value) })}
                                type="number"
                                className="text-right"
                                displayValue={formatCurrency(supplier.price_per_pack)}
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={supplier.is_preferred}
                                onChange={(e) => handleUpdateSupplier(supplier.supplier_id, { is_preferred: e.target.checked })}
                                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 text-right text-zinc-900 dark:text-zinc-100">
                              <EditableCell
                                value={supplier.cost_per_unit.toString()}
                                onSave={(value) => handleUpdateSupplier(supplier.supplier_id, { cost_per_unit: parseFloat(value) })}
                                type="number"
                                className="text-right"
                                displayValue={formatCurrency(supplier.cost_per_unit)}
                              />
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={supplier.pack_unit}
                                onChange={(e) => handleUpdateSupplier(supplier.supplier_id, { pack_unit: e.target.value })}
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
                                onClick={() => handleDeleteSupplier(supplier.supplier_id)}
                                disabled={removeSupplierMutation.isPending}
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
