'use client';

import { useState } from 'react';
import { Plus, Trash2, Check, X, Edit2 } from 'lucide-react';
import { useAppState } from '@/lib/store';
import {
  useRecipe,
  useRecipeUnits,
  useRemoveRecipeFromUnit,
  useUpdateRecipeUnit,
  useAddRecipeToUnit,
} from '@/lib/hooks';
import { Card, CardContent, Skeleton, Button, Input } from '@/components/ui';
import { BrandSelect, useBrandNames } from '@/components/units';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * The brands a recipe is served at. Brands come from Passport (read-only here) — this tab only
 * links a recipe to them. Only brands where the caller is `Manager` can be added, because that is
 * what the API allows, and that question is asked per brand.
 */
export function UnitsTab() {
  const { selectedRecipeId } = useAppState();
  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(selectedRecipeId);
  const {
    data: recipeUnits = [],
    isLoading: unitsLoading,
    error: unitsError,
  } = useRecipeUnits(selectedRecipeId);
  const brandNames = useBrandNames();

  const addRecipeToUnit = useAddRecipeToUnit();
  const removeRecipeFromUnit = useRemoveRecipeFromUnit();
  const updateRecipeUnit = useUpdateRecipeUnit();

  const [isAdding, setIsAdding] = useState(false);
  const [newUnitId, setNewUnitId] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState('');

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a recipe from the left panel to view its brands
          </p>
        </div>
      </div>
    );
  }

  if (recipeLoading || unitsLoading) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (recipeError || unitsError || !recipe) {
    return (
      <div className="flex-1 bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  const resetAddForm = () => {
    setIsAdding(false);
    setNewUnitId('');
    setNewPrice('');
  };

  const handleAddUnit = async () => {
    if (!newUnitId) return;
    try {
      await addRecipeToUnit.mutateAsync({
        recipeId: selectedRecipeId,
        data: {
          unit_id: newUnitId,
          is_active: true,
          price_override: newPrice.trim() ? parseFloat(newPrice) : null,
        },
      });
      resetAddForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add brand');
    }
  };

  const handleRemoveUnit = async (unitId: string) => {
    setRemovingUnitId(unitId);
    try {
      await removeRecipeFromUnit.mutateAsync({ recipeId: selectedRecipeId, unitId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove brand');
    } finally {
      setRemovingUnitId(null);
    }
  };

  const handleSavePrice = async (unitId: string) => {
    try {
      await updateRecipeUnit.mutateAsync({
        recipeId: selectedRecipeId,
        unitId,
        data: { price_override: editingPrice.trim() ? parseFloat(editingPrice) : null },
      });
      setEditingUnitId(null);
      setEditingPrice('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update price');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Associated Brands</h2>
            <p className="text-xs text-muted-foreground">
              Brands and outlets are managed in Passport. Here you only choose where this recipe is
              served.
            </p>
          </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Brand
            </Button>
          )}
        </div>

        {isAdding && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Brand
                </label>
                <BrandSelect
                  value={newUnitId}
                  onChange={setNewUnitId}
                  managerOnly
                  excludeUnitIds={recipeUnits.map((link) => link.unit_id)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Price Override (Optional)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter price override"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetAddForm}>
                  Cancel
                </Button>
                <Button onClick={handleAddUnit} disabled={!newUnitId || addRecipeToUnit.isPending}>
                  {addRecipeToUnit.isPending ? 'Adding...' : 'Add Brand'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            {recipeUnits.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No brands associated with this recipe yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                        Brand
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Price Override
                      </th>
                      <th className="py-3 pl-4 text-right font-medium text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeUnits.map((recipeUnit) => (
                      <tr key={recipeUnit.unit_id} className="border-b border-border">
                        <td className="py-3 pr-4 text-foreground">
                          {brandNames.get(recipeUnit.unit_id) ?? recipeUnit.unit_id}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              recipeUnit.is_active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {recipeUnit.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingUnitId === recipeUnit.unit_id ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              placeholder="0.00"
                              className="w-24 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                            />
                          ) : (
                            <span className="text-muted-foreground">
                              {recipeUnit.price_override != null
                                ? formatCurrency(recipeUnit.price_override)
                                : '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-4 text-right space-x-2 flex items-center justify-end">
                          {editingUnitId === recipeUnit.unit_id ? (
                            <>
                              <button
                                onClick={() => handleSavePrice(recipeUnit.unit_id)}
                                className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUnitId(null);
                                  setEditingPrice('');
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingUnitId(recipeUnit.unit_id);
                                  setEditingPrice(recipeUnit.price_override?.toString() ?? '');
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                title="Edit price"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveUnit(recipeUnit.unit_id)}
                                disabled={removingUnitId === recipeUnit.unit_id}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
