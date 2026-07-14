'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, Button, Badge } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { getIngredientSuppliers } from '@/lib/api';
import type { RecipeIngredient } from '@/types';

const UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'cup', label: 'cup' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'pcs', label: 'pcs' },
  { value: 'dozen', label: 'dozen' },
];

interface RecipeIngredientRowProps {
  ingredient: RecipeIngredient;
  canEdit: boolean;
  onQuantityChange: (quantity: number) => void;
  onUnitChange: (unit: string) => void;
  onUnitPriceChange: (unitPrice: number, baseUnit: string) => void;
  onSupplierChange: (supplierId: number | null, unitPrice: number, baseUnit: string) => void;
  onRemove: () => void;
}

export const RecipeIngredientRow = memo(function RecipeIngredientRow({
  ingredient,
  canEdit,
  onQuantityChange,
  onUnitChange,
  onUnitPriceChange,
  onSupplierChange,
  onRemove,
}: RecipeIngredientRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ingredient.id, disabled: !canEdit });

  const [localQuantity, setLocalQuantity] = useState(String(ingredient.quantity));
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [unitPriceDebounceTimer, setUnitPriceDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(
    ingredient.supplier_id?.toString() ?? ''
  );
  const [unitPrice, setUnitPrice] = useState<string>(
    ingredient.unit_price?.toString() ?? ''
  );
  const [baseUnit, setBaseUnit] = useState<string>(
    ingredient.base_unit ?? ingredient.unit
  );

  // Fetch suppliers for this ingredient
  const { data: suppliers = [] } = useQuery({
    queryKey: ['ingredient-suppliers', ingredient.ingredient_id],
    queryFn: () => getIngredientSuppliers(ingredient.ingredient_id),
  });

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.supplier_id.toString(), label: s.supplier_name ?? `Supplier #${s.supplier_id}` })),
    [suppliers]
  );

  useEffect(() => {
    setLocalQuantity(String(ingredient.quantity));
  }, [ingredient.quantity]);

  useEffect(() => {
    setSelectedSupplier(ingredient.supplier_id?.toString() ?? '');
  }, [ingredient.supplier_id]);

  useEffect(() => {
    setUnitPrice(ingredient.unit_price?.toString() ?? '');
  }, [ingredient.unit_price]);

  useEffect(() => {
    setBaseUnit(ingredient.base_unit ?? ingredient.unit);
  }, [ingredient.base_unit, ingredient.unit]);

  const handleQuantityChange = useCallback(
    (value: string) => {
      setLocalQuantity(value);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0) {
          onQuantityChange(num);
        }
      }, 500);

      setDebounceTimer(timer);
    },
    [debounceTimer, onQuantityChange]
  );

  const handleUnitPriceChange = useCallback(
    (value: string) => {
      setUnitPrice(value);

      if (unitPriceDebounceTimer) {
        clearTimeout(unitPriceDebounceTimer);
      }

      const timer = setTimeout(() => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          onUnitPriceChange(num, baseUnit);
        }
      }, 500);

      setUnitPriceDebounceTimer(timer);
    },
    [unitPriceDebounceTimer, onUnitPriceChange, baseUnit]
  );

  const handleSupplierChange = useCallback(
    (supplierId: string) => {
      setSelectedSupplier(supplierId);

      if (!supplierId) {
        // No supplier selected - use ingredient defaults
        const defaultUnitPrice = ingredient.ingredient?.cost_per_base_unit ?? 0;
        const defaultBaseUnit = ingredient.ingredient?.base_unit ?? ingredient.unit;
        setUnitPrice(defaultUnitPrice.toString());
        setBaseUnit(defaultBaseUnit);
        onSupplierChange(null, defaultUnitPrice, defaultBaseUnit);
      } else {
        // Find the selected supplier and compute cost_per_unit
        const supplier = suppliers.find((s) => s.supplier_id.toString() === supplierId);
        if (supplier) {
          const costPerUnit = supplier.pack_size > 0 ? supplier.price_per_pack / supplier.pack_size : 0;
          setUnitPrice(costPerUnit.toString());
          setBaseUnit(supplier.pack_unit);
          onSupplierChange(
            parseInt(supplierId, 10),
            costPerUnit,
            supplier.pack_unit
          );
        }
      }
    },
    [suppliers, onSupplierChange, ingredient.ingredient, ingredient.unit]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate line cost in real-time using local state values
  const localQuantityNum = parseFloat(localQuantity);
  const unitPriceNum = parseFloat(unitPrice);
  const lineCost =
    !isNaN(localQuantityNum) && localQuantityNum > 0 && !isNaN(unitPriceNum) && unitPriceNum >= 0
      ? localQuantityNum * unitPriceNum
      : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3',
        isDragging && 'opacity-50 shadow-elevation-2'
      )}
    >
      {canEdit && (
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {ingredient.ingredient?.name || `Ingredient #${ingredient.ingredient_id}`}
        </p>
        {ingredient.ingredient?.allergens && ingredient.ingredient.allergens.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {ingredient.ingredient.allergens.map((allergen) => (
              <Badge key={allergen.id} variant="warning">
                {allergen.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Select
        value={selectedSupplier}
        onChange={(e) => handleSupplierChange(e.target.value)}
        options={[{ value: '', label: 'No supplier' }, ...supplierOptions]}
        className="w-32"
        disabled={!canEdit}
      />

      <Input
        type="text"
        inputMode="decimal"
        value={localQuantity}
        onChange={(e) => handleQuantityChange(e.target.value)}
        className="w-20 text-right tabular-nums"
        disabled={!canEdit}
      />

      <Select
        value={ingredient.unit}
        onChange={(e) => onUnitChange(e.target.value)}
        options={UNIT_OPTIONS}
        className="w-24"
        disabled={!canEdit}
      />

      <div className="flex items-center gap-1">
        $
        <Input
          type="text"
          inputMode="decimal"
          value={unitPrice}
          onChange={(e) => handleUnitPriceChange(e.target.value)}
          placeholder="Unit $"
          className="w-20 text-right tabular-nums"
          disabled={!canEdit}
        />
        <span className="text-muted-foreground">/{baseUnit}</span>
        {lineCost !== null && (
          <span className="ml-2 text-sm font-medium text-foreground tabular-nums">
            {formatCurrency(lineCost)}
          </span>
        )}
      </div>

      {canEdit && (
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      )}
    </div>
  );
});
