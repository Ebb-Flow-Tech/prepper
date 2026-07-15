'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateIngredient, useAddIngredientSupplier, useSuppliers, useCategorizeIngredient } from '@/lib/hooks';
import { BrandSelect } from '@/components/units';
import { Button, Input, Select, Modal, Checkbox } from '@/components/ui';
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
  is_preferred: boolean;
  /** Passport unit UUID the price belongs to. */
  unit_id: string;
}

interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddIngredientModal({ isOpen, onClose }: AddIngredientModalProps) {
  const createIngredient = useCreateIngredient();
  const addIngredientSupplier = useAddIngredientSupplier();
  const categorizeIngredient = useCategorizeIngredient();
  const { data: suppliersData } = useSuppliers({ page_size: 30 });
  const suppliers = suppliersData?.items ?? [];

  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [cost, setCost] = useState('');
  const [isHalal, setIsHalal] = useState(false);
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
    setIsHalal(false);
    setSupplierEntries([]);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

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
      is_preferred: supplierEntries.length === 0, // First supplier is preferred by default
      unit_id: '',
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
      entry.unit_id &&
      entry.pack_size &&
      entry.pack_unit &&
      entry.price_per_pack
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
      // get the category ID (AGENT CALL)
      const categoryData = await categorizeIngredient.mutateAsync(name);
      const categoryId = categoryData.category_id;

      // Create the ingredient first
      const newIngredient = await createIngredient.mutateAsync({
        name: name.trim(),
        base_unit: baseUnit,
        cost_per_base_unit: cost ? parseFloat(cost) : null,
        is_halal: isHalal,
        category_id: categoryId,
      });

      // Then add suppliers via the join table
      for (const entry of validSupplierEntries) {
        await addIngredientSupplier.mutateAsync({
          ingredientId: newIngredient.id,
          data: {
            ingredient_id: newIngredient.id,
            supplier_id: parseInt(entry.supplier_id, 10),
            unit_id: entry.unit_id,
            sku: entry.sku || null,
            pack_size: parseFloat(entry.pack_size),
            pack_unit: entry.pack_unit,
            price_per_pack: parseFloat(entry.price_per_pack),
            currency: 'SGD',
            is_preferred: entry.is_preferred,
            source: 'manual',
          },
        });
      }

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Ingredient" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Basic Information
          </h3>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Ingredient Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Olive Oil, Chicken Breast"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Base Unit *
              </label>
              <Select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                options={UNIT_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Cost per Unit (optional)
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                onBlur={() => { const n = parseFloat(cost); if (!isNaN(n)) setCost(String(n)); }}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Checkbox
              checked={isHalal}
              onChange={(e) => setIsHalal(e.target.checked)}
              label="Halal"
            />
          </div>
        </div>

        {/* Suppliers Section */}
        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground">
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
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
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
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={handleClose}>
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
    <div className="p-4 bg-secondary rounded-lg border border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Brand *
          </label>
          <BrandSelect
            value={entry.unit_id}
            onChange={(unitId) => onChange(entry.id, 'unit_id', unitId)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Pack Size *
          </label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={entry.pack_size}
            onChange={(e) => onChange(entry.id, 'pack_size', e.target.value)}
            onBlur={() => { const n = parseFloat(entry.pack_size); if (!isNaN(n)) onChange(entry.id, 'pack_size', String(n)); }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Price per Pack *
          </label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={entry.price_per_pack}
            onChange={(e) => onChange(entry.id, 'price_per_pack', e.target.value)}
            onBlur={() => { const n = parseFloat(entry.price_per_pack); if (!isNaN(n)) onChange(entry.id, 'price_per_pack', String(n)); }}
          />
        </div>

      </div>

      <div className="mt-3">
        <Checkbox
          checked={entry.is_preferred}
          onChange={(e) => onChange(entry.id, 'is_preferred', e.target.checked)}
          label="Preferred Supplier"
        />
      </div>
    </div>
  );
}
