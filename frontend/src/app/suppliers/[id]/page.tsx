'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, MapPin, Phone, Mail, Trash2, Package, Plus, MoreVertical, Check, X, Edit as EditIcon, Truck, Tag } from 'lucide-react';
import {
  useSupplier,
  useUpdateSupplier,
  useDeactivateSupplier,
  useSupplierIngredients,
  useIngredients,
  useAddSupplierIngredient,
  useUpdateSupplierIngredient,
  useRemoveSupplierIngredient,
  useOutlets,
} from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, EditableCell, Input, Modal, Select, Skeleton, Checkbox } from '@/components/ui';
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

interface IngredientRowEdit {
  sku?: string | null;
  pack_size?: string;
  pack_unit?: string;
  price_per_pack?: string;
  is_preferred?: boolean;
  outlet_id?: number;
}

interface SupplierPageProps {
  params: Promise<{ id: string }>;
}

export default function SupplierPage({ params }: SupplierPageProps) {
  const { id } = use(params);
  const supplierId = parseInt(id, 10);
  const router = useRouter();

  const { outletId, userType } = useAppState();
  const isAdmin = userType === 'admin';

  const { data: supplier, isLoading, error } = useSupplier(supplierId);
  const { data: availableIngredientsData } = useIngredients({ active_only: false, page_size: 30 }); // Include inactive too
  const availableIngredients = availableIngredientsData?.items;
  const { data: supplierIngredients = [] } = useSupplierIngredients(supplierId);
  const { data: outletsData } = useOutlets({ page_size: 30 });
  const outlets = outletsData?.items ?? [];

  const updateSupplierMutation = useUpdateSupplier();
  const deactivateSupplierMutation = useDeactivateSupplier();
  const addIngredientMutation = useAddSupplierIngredient();
  const updateIngredientMutation = useUpdateSupplierIngredient();
  const removeIngredientMutation = useRemoveSupplierIngredient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<number, IngredientRowEdit>>({});
  const [formData, setFormData] = useState({
    ingredient_id: '',
    sku: '',
    pack_size: '',
    price_per_pack: '',
    unit_cost: '',
    pack_unit: '',
    is_preferred: false,
    outlet_id: outletId ? outletId.toString() : '',
  });

  const handleUpdateSupplier = (data: { name?: string; code?: string | null; address?: string | null; phone_number?: string | null; email?: string | null; shipping_company_name?: string | null }) => {
    updateSupplierMutation.mutate(
      { id: supplierId, data },
      {
        onSuccess: () => toast.success('Supplier updated'),
        onError: () => toast.error('Failed to update supplier'),
      }
    );
  };

  const handleArchive = () => {
    deactivateSupplierMutation.mutate(supplierId, {
      onSuccess: () => {
        toast.success('Supplier archived');
        router.push('/ingredients');
      },
      onError: () => toast.error('Failed to archive supplier'),
    });
  };

  const handleUpdateIngredient = (supplierIngredientId: number, ingredientId: number, data: UpdateSupplierIngredientRequest) => {
    updateIngredientMutation.mutate({
      supplierId,
      supplierIngredientId,
      ingredientId,
      data,
    });
  };

  const handleDeleteIngredient = (supplierIngredientId: number) => {
    const si = supplierIngredients.find((i) => i.id === supplierIngredientId);
    if (!si) return;
    removeIngredientMutation.mutate({
      supplierId,
      supplierIngredientId,
      ingredientId: si.ingredient_id,
    });
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ingredient_id || !formData.pack_unit || !formData.pack_size || !formData.price_per_pack || !formData.outlet_id) {
      return;
    }

    const packSize = parseFloat(formData.pack_size);
    const pricePerPack = parseFloat(formData.price_per_pack);

    const selectedIngredient = availableIngredients?.find(
      (i) => i.id === parseInt(formData.ingredient_id, 10)
    );

    addIngredientMutation.mutate(
      {
        supplierId,
        data: {
          ingredient_id: parseInt(formData.ingredient_id, 10),
          supplier_id: supplierId,
          outlet_id: parseInt(formData.outlet_id, 10),
          sku: formData.sku || null,
          pack_size: packSize,
          pack_unit: formData.pack_unit,
          price_per_pack: pricePerPack,
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
            outlet_id: outletId ? outletId.toString() : '',
          });
          setShowAddModal(false);
          toast.success(`${selectedIngredient?.name || 'Ingredient'} added`);
        },
        onError: (error) => {
          // Check for 422 (duplicate supplier-ingredient link or SKU)
          if (error && typeof error === 'object' && 'status' in error && error.status === 422) {
            toast.error(`${selectedIngredient?.name || 'This ingredient'} is already linked to this supplier`);
          } else {
            toast.error('Failed to add ingredient');
          }
        },
      }
    );
  };

  const calculateUnitCost = (packSize: number, pricePerPack: number): number => {
    return packSize > 0 ? pricePerPack / packSize : 0;
  };

  // Filter out ingredients that already have this supplier
  const existingIngredientIds = new Set(supplierIngredients.map((i) => i.ingredient_id));
  const availableToAdd = availableIngredients?.filter((i) => !existingIngredientIds.has(i.id)) || [];

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/ingredients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ingredients
        </Link>
        <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
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
          href="/ingredients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ingredients
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : supplier ? (
          <>
            {/* Supplier Header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  {/* Placeholder for hero image */}
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                    <ImagePlus className="h-8 w-8" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-foreground">
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
                          onClick={handleArchive}
                          disabled={deactivateSupplierMutation.isPending}
                          className="text-[var(--color-feedback-error)] hover:bg-[var(--color-feedback-error-tint)] hover:text-[var(--color-feedback-error)]"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Archive
                        </Button>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-32 shrink-0">Code:</span>
                        <EditableCell
                          value={supplier.code || ''}
                          onSave={(value) => handleUpdateSupplier({ code: value || null })}
                          className="font-medium text-foreground flex-1"
                          placeholder="Add code"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-32 shrink-0">Shipping address:</span>
                        <EditableCell
                          value={supplier.address || ''}
                          onSave={(value) => handleUpdateSupplier({ address: value || null })}
                          className="font-medium text-foreground flex-1"
                          placeholder="Add shipping address"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-32 shrink-0">Shipping company:</span>
                        <EditableCell
                          value={supplier.shipping_company_name || ''}
                          onSave={(value) => handleUpdateSupplier({ shipping_company_name: value || null })}
                          className="font-medium text-foreground flex-1"
                          placeholder="Add shipping company"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-32 shrink-0">Phone:</span>
                        <EditableCell
                          value={supplier.phone_number || ''}
                          onSave={(value) => handleUpdateSupplier({ phone_number: value || null })}
                          className="font-medium text-foreground flex-1"
                          placeholder="Add phone number"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-32 shrink-0">Email:</span>
                        <EditableCell
                          value={supplier.email || ''}
                          onSave={(value) => handleUpdateSupplier({ email: value || null })}
                          type="email"
                          className="font-medium text-foreground flex-1"
                          placeholder="Add email"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
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
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Ingredients
                  </h2>
                </div>

                {/* Add ingredient Button */}
                <div className="mb-4">
                  <Button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add ingredient
                  </Button>
                </div>

                {/* Add ingredient Modal */}
                <Modal
                  isOpen={showAddModal}
                  onClose={() => setShowAddModal(false)}
                  title="Add ingredient"
                  maxWidth="max-w-lg"
                >
                  <form onSubmit={handleAddIngredient} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Outlet
                      </label>
                      <Select
                        value={formData.outlet_id}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, outlet_id: e.target.value }))
                        }
                        disabled={!!outletId}
                        options={[
                          { value: '', label: 'Select outlet...' },
                          ...outlets.map((o) => ({
                            value: o.id.toString(),
                            label: o.name,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Pack size
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={formData.pack_size}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, pack_size: e.target.value }))
                        }
                        onBlur={() => {
                          const n = parseFloat(formData.pack_size);
                          if (!isNaN(n)) setFormData((prev) => ({ ...prev, pack_size: String(n) }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Pack unit
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
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Price/pack
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={formData.price_per_pack}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, price_per_pack: e.target.value }))
                        }
                        onBlur={() => {
                          const n = parseFloat(formData.price_per_pack);
                          if (!isNaN(n)) setFormData((prev) => ({ ...prev, price_per_pack: String(n) }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Unit cost
                      </label>
                      <div className="px-3 py-2 rounded-lg border border-input bg-secondary text-foreground text-right tabular-nums">
                        {formData.pack_size && formData.price_per_pack
                          ? formatCurrency(calculateUnitCost(parseFloat(formData.pack_size), parseFloat(formData.price_per_pack)))
                          : formatCurrency(0)}
                      </div>
                    </div>
                    <Checkbox
                      checked={formData.is_preferred}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, is_preferred: e.target.checked }))
                      }
                      label="Preferred supplier"
                    />
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
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
                          !formData.ingredient_id ||
                          !formData.outlet_id ||
                          !formData.pack_unit ||
                          !formData.pack_size ||
                          !formData.price_per_pack ||
                          addIngredientMutation.isPending
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add ingredient
                      </Button>
                    </div>
                  </form>
                </Modal>

                {/* Ingredients Table */}
                {supplierIngredients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                            Ingredient
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                            Outlet
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                            SKU
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                            Pack size
                          </th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                            Pack unit
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                            Price/pack
                          </th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                            Unit cost
                          </th>
                          <th className="py-3 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierIngredients.map((ingredient) => (
                          <tr
                            key={ingredient.id}
                            className="border-b border-border hover:bg-secondary group"
                          >
                            <td className="py-3 px-2 text-foreground font-medium">
                              <Link
                                href={`/ingredients/${ingredient.ingredient_id}`}
                                className="hover:text-primary"
                              >
                                {ingredient.ingredient_name}
                              </Link>
                            </td>
                            <td className="py-3 px-2 text-muted-foreground text-xs">
                              {ingredient.outlet_name ?? '-'}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground font-mono text-xs">
                              {editingIngredient === ingredient.id ? (
                                <input
                                  type="text"
                                  value={editData[ingredient.id]?.sku ?? ingredient.sku ?? ''}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [ingredient.id]: {
                                        ...editData[ingredient.id],
                                        sku: e.target.value || null,
                                      },
                                    })
                                  }
                                  placeholder="e.g., SKU-001"
                                  className="w-full px-2 py-1 text-sm border border-input rounded-lg bg-card text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              ) : (
                                ingredient.sku ?? '-'
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-foreground tabular-nums">
                              {editingIngredient === ingredient.id ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editData[ingredient.id]?.pack_size ?? ingredient.pack_size.toString()}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [ingredient.id]: {
                                        ...editData[ingredient.id],
                                        pack_size: e.target.value,
                                      },
                                    })
                                  }
                                  onBlur={() => {
                                    const n = parseFloat(editData[ingredient.id]?.pack_size ?? '');
                                    if (!isNaN(n)) setEditData({ ...editData, [ingredient.id]: { ...editData[ingredient.id], pack_size: String(n) } });
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right tabular-nums"
                                />
                              ) : (
                                ingredient.pack_size
                              )}
                            </td>
                            <td className="py-3 px-2">
                              {editingIngredient === ingredient.id ? (
                                <select
                                  value={editData[ingredient.id]?.pack_unit ?? ingredient.pack_unit}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [ingredient.id]: {
                                        ...editData[ingredient.id],
                                        pack_unit: e.target.value,
                                      },
                                    })
                                  }
                                  className="px-2 py-1 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                                >
                                  {UNIT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                ingredient.pack_unit
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-foreground tabular-nums">
                              {editingIngredient === ingredient.id ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editData[ingredient.id]?.price_per_pack ?? ingredient.price_per_pack.toString()}
                                  onChange={(e) =>
                                    setEditData({
                                      ...editData,
                                      [ingredient.id]: {
                                        ...editData[ingredient.id],
                                        price_per_pack: e.target.value,
                                      },
                                    })
                                  }
                                  onBlur={() => {
                                    const n = parseFloat(editData[ingredient.id]?.price_per_pack ?? '');
                                    if (!isNaN(n)) setEditData({ ...editData, [ingredient.id]: { ...editData[ingredient.id], price_per_pack: String(n) } });
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right tabular-nums"
                                />
                              ) : (
                                formatCurrency(ingredient.price_per_pack)
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-foreground tabular-nums">
                              {editingIngredient === ingredient.id
                                ? formatCurrency(
                                    calculateUnitCost(
                                      parseFloat(editData[ingredient.id]?.pack_size ?? String(ingredient.pack_size)),
                                      parseFloat(editData[ingredient.id]?.price_per_pack ?? String(ingredient.price_per_pack))
                                    )
                                  )
                                : formatCurrency((ingredient.pack_size > 0 ? ingredient.price_per_pack / ingredient.pack_size : 0))}
                            </td>
                            <td className="py-3 px-2">
                              <div className="relative group/menu">
                                {/* Three dots button */}
                                <button className="text-muted-foreground hover:text-foreground p-1">
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {/* Dropdown menu */}
                                <div className="absolute right-0 top-full mt-0 bg-popover border border-border rounded-xl shadow-elevation-2 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 min-w-max">
                                  {editingIngredient === ingredient.id ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingIngredient(null);
                                          setEditData({});
                                        }}
                                        disabled={updateIngredientMutation.isPending}
                                        className="w-full justify-start text-[var(--color-feedback-error)] rounded-none first:rounded-t-lg h-8 px-3"
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const dataToSave = editData[ingredient.id];
                                          if (dataToSave) {
                                            const packSize = parseFloat(dataToSave.pack_size ?? '');
                                            const pricePerPack = parseFloat(dataToSave.price_per_pack ?? '');
                                            handleUpdateIngredient(ingredient.id, ingredient.ingredient_id, {
                                              sku: dataToSave.sku,
                                              pack_size: isNaN(packSize) ? undefined : packSize,
                                              pack_unit: dataToSave.pack_unit,
                                              price_per_pack: isNaN(pricePerPack) ? undefined : pricePerPack,
                                              is_preferred: dataToSave.is_preferred,
                                            });
                                            setEditingIngredient(null);
                                            setEditData({});
                                          }
                                        }}
                                        disabled={updateIngredientMutation.isPending}
                                        className="w-full justify-start text-[var(--color-feedback-success)] rounded-none last:rounded-b-lg h-8 px-3"
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
                                          setEditingIngredient(ingredient.id);
                                          setEditData({
                                            [ingredient.id]: {
                                              sku: ingredient.sku,
                                              pack_size: ingredient.pack_size.toString(),
                                              price_per_pack: ingredient.price_per_pack.toString(),
                                              pack_unit: ingredient.pack_unit,
                                            },
                                          });
                                        }}
                                        className="w-full justify-start text-primary hover:opacity-80 rounded-none first:rounded-t-lg h-8 px-3"
                                      >
                                        <EditIcon className="h-4 w-4 mr-2" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteIngredient(ingredient.id)}
                                        disabled={removeIngredientMutation.isPending}
                                        className="w-full justify-start text-[var(--color-feedback-error)] hover:bg-[var(--color-feedback-error-tint)] rounded-none last:rounded-b-lg h-8 px-3"
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
                  <div className="text-center py-6 border border-dashed border-border rounded-lg">
                    <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">
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
