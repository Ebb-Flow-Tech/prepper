'use client';

import { useState } from 'react';
import { Plus, Trash2, Check, X, Edit2 } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useRecipe, useRecipeOutlets, useRemoveRecipeFromOutlet, useUpdateRecipeOutlet } from '@/lib/hooks';
import { Card, CardContent, Skeleton, Button } from '@/components/ui';
import { AddOutletModal } from './AddOutletModal';
import { formatCurrency } from '@/lib/utils';
import type { Outlet } from '@/types';

interface OutletsTabProps {
  outlets?: Outlet[];
}

export function OutletsTab({ outlets = [] }: OutletsTabProps) {
  const { selectedRecipeId } = useAppState();
  const { data: recipe, isLoading: recipeLoading, error: recipeError } = useRecipe(selectedRecipeId);
  const { data: recipeOutlets = [], isLoading: outletsLoading, error: outletsError } = useRecipeOutlets(selectedRecipeId);
  const allOutlets = outlets;
  const allOutletsLoading = false;
  const removeRecipeFromOutlet = useRemoveRecipeFromOutlet();
  const updateRecipeOutlet = useUpdateRecipeOutlet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingOutletId, setRemovingOutletId] = useState<number | null>(null);
  const [editingOutletId, setEditingOutletId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');

  if (!selectedRecipeId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            Select a recipe from the left panel to view its outlets
          </p>
        </div>
      </div>
    );
  }

  if (recipeLoading || outletsLoading || allOutletsLoading) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 p-6">
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

  if (recipeError || outletsError || !recipe) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
            Recipe not found or failed to load.
          </div>
        </div>
      </div>
    );
  }

  const handleRemoveOutlet = async (outletId: number) => {
    if (!selectedRecipeId) return;
    setRemovingOutletId(outletId);
    try {
      await removeRecipeFromOutlet.mutateAsync({
        recipeId: selectedRecipeId,
        outletId,
      });
    } finally {
      setRemovingOutletId(null);
    }
  };

  const handleStartEditPrice = (outletId: number, currentPrice: number | null) => {
    setEditingOutletId(outletId);
    setEditingPrice(currentPrice?.toString() || '');
  };

  const handleSavePrice = async (outletId: number) => {
    if (!selectedRecipeId) return;
    try {
      const priceValue = editingPrice.trim() ? parseFloat(editingPrice) : null;
      await updateRecipeOutlet.mutateAsync({
        recipeId: selectedRecipeId,
        outletId,
        data: { price_override: priceValue },
      });
      setEditingOutletId(null);
      setEditingPrice('');
    } catch (error) {
      console.error('Failed to update price:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingOutletId(null);
    setEditingPrice('');
  };

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Associated Outlets
          </h2>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Outlet
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {recipeOutlets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No outlets associated with this recipe yet
                </p>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  variant="outline"
                  className="mt-4"
                >
                  Add First Outlet
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="py-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                        Outlet
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                        Price Override
                      </th>
                      <th className="py-3 pl-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeOutlets.map((recipeOutlet) => {
                      // Find the outlet details from the all outlets list
                      const outlet = allOutlets.find((o) => o.id === recipeOutlet.outlet_id);
                      return (
                        <tr
                          key={recipeOutlet.outlet_id}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="py-3 pr-4 text-zinc-900 dark:text-zinc-100">
                            {outlet?.name || `Outlet ${recipeOutlet.outlet_id}`}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                            {outlet?.code || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                recipeOutlet.is_active
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                              }`}
                            >
                              {recipeOutlet.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {editingOutletId === recipeOutlet.outlet_id ? (
                              <input
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                              />
                            ) : (
                              <span className="text-zinc-600 dark:text-zinc-300">
                                {recipeOutlet.price_override != null
                                  ? formatCurrency(recipeOutlet.price_override)
                                  : '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-4 text-right space-x-2 flex items-center justify-end">
                            {editingOutletId === recipeOutlet.outlet_id ? (
                              <>
                                <button
                                  onClick={() => handleSavePrice(recipeOutlet.outlet_id)}
                                  className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                  title="Save"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEditPrice(recipeOutlet.outlet_id, recipeOutlet.price_override)}
                                  className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                                  title="Edit price"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRemoveOutlet(recipeOutlet.outlet_id)}
                                  disabled={removingOutletId === recipeOutlet.outlet_id}
                                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddOutletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} recipeId={selectedRecipeId} outlets={allOutlets} />
    </div>
  );
}
