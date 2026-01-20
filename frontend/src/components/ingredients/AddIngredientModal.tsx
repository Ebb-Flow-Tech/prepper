'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateIngredient, useSuppliers, useCategorizeIngredient } from '@/lib/hooks';
import { Button, Input, Select, Modal } from '@/components/ui';
import { toast } from 'sonner';
import type { Supplier } from '@/types';

const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'l', label: 'l (liters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
];

interface SupplierEntry {
  id: string; // Temporary ID for list management
  supplier_id: string;
  supplier_name: string;
  sku: string;
  pack_size: string;
  pack_unit: string;
  price_per_pack: string;
  cost_per_unit: string;
  is_preferred: boolean;
}

interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddIngredientModal({ isOpen, onClose }: AddIngredientModalProps) {
  const createIngredient = useCreateIngredient();
  const categorizeIngredient = useCategorizeIngredient();
  const { data: suppliers = [] } = useSuppliers();

  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [cost, setCost] = useState('');
  const [supplierEntries, setSupplierEntries] = useState<SupplierEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get suppliers that haven't been added yet
  const availableSuppliers = useMemo(() => {
    const addedSupplierIds = new Set(supplierEntries.map((e) => e.supplier_id));
    return suppliers.filter((s) => !addedSupplierIds.has(s.id.toString()));
  }, [suppliers, supplierEntries]);

  // Reset form only after successful submission
  const resetForm = useCallback(() => {
    setName('');
    setBaseUnit('g');
    setCost('');
    setSupplierEntries([]);
    setIsSubmitting(false);
  }, []);

  const handleAddSupplierEntry = () => {
    if (availableSuppliers.length === 0) return;

    const newEntry: SupplierEntry = {
      id: crypto.randomUUID(),
      supplier_id: '',
      supplier_name: '',
      sku: '',
      pack_size: '',
      pack_unit: baseUnit,
      price_per_pack: '',
      cost_per_unit: '',
      is_preferred: supplierEntries.length === 0, // First supplier is preferred by default
    };
    setSupplierEntries((prev) => [...prev, newEntry]);
  };

  const handleRemoveSupplierEntry = (id: string) => {
    setSupplierEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      // If we removed the preferred supplier and there are still entries, make the first one preferred
      if (updated.length > 0 && !updated.some((e) => e.is_preferred)) {
        updated[0].is_preferred = true;
      }
      return updated;
    });
  };

  const handleSupplierEntryChange = (id: string, field: keyof SupplierEntry, value: string | boolean) => {
    setSupplierEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }

        const updated = { ...entry, [field]: value };

        // If supplier_id changed, update supplier_name
        if (field === 'supplier_id') {
          const supplier = suppliers.find((s) => s.id.toString() === value);
          updated.supplier_name = supplier?.name ?? '';
        }

        return updated;
      })
    );
  };

  const isSupplierEntryValid = (entry: SupplierEntry) => {
    return (
      entry.supplier_id &&
      entry.pack_size &&
      entry.pack_unit &&
      entry.price_per_pack &&
      entry.cost_per_unit
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Validate supplier entries
    const validSupplierEntries = supplierEntries.filter(isSupplierEntryValid);
    const invalidEntries = supplierEntries.filter((e) => e.supplier_id && !isSupplierEntryValid(e));
    if (invalidEntries.length > 0) {
      toast.error('Please complete all supplier fields or remove incomplete entries');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build suppliers array for the request
      const suppliersData = validSupplierEntries.map((entry) => ({
        supplier_id: entry.supplier_id,
        supplier_name: entry.supplier_name,
        sku: entry.sku || null,
        pack_size: parseFloat(entry.pack_size),
        pack_unit: entry.pack_unit,
        price_per_pack: parseFloat(entry.price_per_pack),
        cost_per_unit: parseFloat(entry.cost_per_unit),
        currency: 'SGD',
        is_preferred: entry.is_preferred,
        source: 'manual',
      }));

      // get the category ID (AGENT CALL)
      const categoryData = await categorizeIngredient.mutateAsync(name);
      const categoryId = categoryData.category_id;

      // Create the ingredient with suppliers in a single request
      await createIngredient.mutateAsync({
        name: name.trim(),
        base_unit: baseUnit,
        cost_per_base_unit: cost ? parseFloat(cost) : null,
        category_id: categoryId,
        suppliers: suppliersData.length > 0 ? suppliersData : undefined,
      });

      const supplierCount = validSupplierEntries.length;
      const message = supplierCount > 0
        ? `Ingredient created with ${supplierCount} supplier${supplierCount > 1 ? 's' : ''}`
        : 'Ingredient created';
      toast.success(message);
      resetForm();
      onClose();
    } catch {
      toast.error('Failed to create ingredient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Ingredient" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Basic Information
          </h3>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Ingredient Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Olive Oil, Chicken Breast"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Base Unit *
              </label>
              <Select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                options={UNIT_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Cost per Unit (optional)
              </label>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.01}
              />
            </div>
          </div>
        </div>

        {/* Suppliers Section */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Suppliers (optional)
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSupplierEntry}
              disabled={availableSuppliers.length === 0 && supplierEntries.length === suppliers.length}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Supplier
            </Button>
          </div>

          {supplierEntries.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
              No suppliers added. Click &quot;Add Supplier&quot; to link suppliers to this ingredient.
            </p>
          ) : (
            <div className="space-y-4">
              {supplierEntries.map((entry, index) => (
                <SupplierEntryForm
                  key={entry.id}
                  entry={entry}
                  index={index}
                  suppliers={suppliers}
                  usedSupplierIds={supplierEntries.filter((e) => e.id !== entry.id).map((e) => e.supplier_id)}
                  baseUnit={baseUnit}
                  onChange={handleSupplierEntryChange}
                  onRemove={handleRemoveSupplierEntry}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Creating...' : 'Create Ingredient'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface SupplierEntryFormProps {
  entry: SupplierEntry;
  index: number;
  suppliers: Supplier[];
  usedSupplierIds: string[];
  baseUnit: string;
  onChange: (id: string, field: keyof SupplierEntry, value: string | boolean) => void;
  onRemove: (id: string) => void;
}

function SupplierEntryForm({
  entry,
  index,
  suppliers,
  usedSupplierIds,
  baseUnit,
  onChange,
  onRemove,
}: SupplierEntryFormProps) {
  const availableSuppliers = suppliers.filter(
    (s) => !usedSupplierIds.includes(s.id.toString()) || s.id.toString() === entry.supplier_id
  );

  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Supplier {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(entry.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Supplier *
          </label>
          <Select
            value={entry.supplier_id}
            onChange={(e) => onChange(entry.id, 'supplier_id', e.target.value)}
            options={[
              { value: '', label: 'Select supplier...' },
              ...availableSuppliers.map((s) => ({
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
            value={entry.sku}
            onChange={(e) => onChange(entry.id, 'sku', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Pack Size *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={entry.pack_size}
            onChange={(e) => onChange(entry.id, 'pack_size', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Pack Unit *
          </label>
          <Select
            value={entry.pack_unit}
            onChange={(e) => onChange(entry.id, 'pack_unit', e.target.value)}
            options={[
              { value: '', label: 'Select unit...' },
              ...UNIT_OPTIONS,
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Price per Pack *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={entry.price_per_pack}
            onChange={(e) => onChange(entry.id, 'price_per_pack', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Cost per Unit ({baseUnit}) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={entry.cost_per_unit}
            onChange={(e) => onChange(entry.id, 'cost_per_unit', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          id={`preferred-${entry.id}`}
          checked={entry.is_preferred}
          onChange={(e) => onChange(entry.id, 'is_preferred', e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-purple-600 focus:ring-purple-500"
        />
        <label
          htmlFor={`preferred-${entry.id}`}
          className="text-sm text-zinc-700 dark:text-zinc-300"
        >
          Preferred Supplier
        </label>
      </div>
    </div>
  );
}
