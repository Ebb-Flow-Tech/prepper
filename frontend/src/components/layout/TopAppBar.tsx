'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChefHat } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useRecipe, useUpdateRecipe, useUpdateRecipeStatus } from '@/lib/hooks';
import { useCosting } from '@/lib/hooks';
import { Input, Select, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import type { RecipeStatus } from '@/types';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export function TopAppBar() {
  const { selectedRecipeId } = useAppState();
  const { data: recipe } = useRecipe(selectedRecipeId);
  const { data: costing } = useCosting(selectedRecipeId);
  const updateRecipe = useUpdateRecipe();
  const updateStatus = useUpdateRecipeStatus();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingYield, setIsEditingYield] = useState(false);
  const [editedYieldQty, setEditedYieldQty] = useState('');
  const [editedYieldUnit, setEditedYieldUnit] = useState('');
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editedPrice, setEditedPrice] = useState('');

  useEffect(() => {
    if (recipe) {
      setEditedName(recipe.name);
      setEditedYieldQty(String(recipe.yield_quantity));
      setEditedYieldUnit(recipe.yield_unit);
      setEditedPrice(recipe.selling_price_est?.toString() || '');
    }
  }, [recipe]);

  const handleNameSave = useCallback(() => {
    if (!recipe || editedName === recipe.name) {
      setIsEditingName(false);
      return;
    }
    updateRecipe.mutate(
      { id: recipe.id, data: { name: editedName } },
      {
        onSuccess: () => {
          setIsEditingName(false);
          toast.success('Recipe name updated');
        },
        onError: () => toast.error('Failed to update name'),
      }
    );
  }, [recipe, editedName, updateRecipe]);

  const handleYieldSave = useCallback(() => {
    if (!recipe) {
      setIsEditingYield(false);
      return;
    }
    const qty = parseFloat(editedYieldQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Invalid yield quantity');
      return;
    }
    updateRecipe.mutate(
      { id: recipe.id, data: { yield_quantity: qty, yield_unit: editedYieldUnit } },
      {
        onSuccess: () => {
          setIsEditingYield(false);
          toast.success('Yield updated');
        },
        onError: () => toast.error('Failed to update yield'),
      }
    );
  }, [recipe, editedYieldQty, editedYieldUnit, updateRecipe]);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!recipe) return;
      const newStatus = e.target.value as RecipeStatus;
      updateStatus.mutate(
        { id: recipe.id, status: newStatus },
        {
          onSuccess: () => toast.success(`Status changed to ${newStatus}`),
          onError: () => toast.error('Failed to update status'),
        }
      );
    },
    [recipe, updateStatus]
  );

  const handlePriceSave = useCallback(() => {
    if (!recipe) {
      setIsEditingPrice(false);
      return;
    }
    const price = editedPrice ? parseFloat(editedPrice) : null;
    if (editedPrice && (isNaN(price!) || price! < 0)) {
      toast.error('Invalid price');
      return;
    }
    updateRecipe.mutate(
      { id: recipe.id, data: { selling_price_est: price } },
      {
        onSuccess: () => {
          setIsEditingPrice(false);
          toast.success('Selling price updated');
        },
        onError: () => toast.error('Failed to update price'),
      }
    );
  }, [recipe, editedPrice, updateRecipe]);

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Logo */}
      <div className="flex items-center gap-2 text-lg font-semibold">
        <ChefHat className="h-6 w-6" />
        <span className="hidden sm:inline">Prepper</span>
      </div>

      {/* Recipe Name */}
      <div className="ml-8 flex-1">
        {recipe ? (
          isEditingName ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              className="max-w-md text-xl font-semibold"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setIsEditingName(true)}
              className="cursor-pointer text-xl font-semibold hover:text-zinc-600 dark:hover:text-zinc-400"
            >
              {recipe.name}
            </h1>
          )
        ) : (
          <span className="text-zinc-400">No recipe selected</span>
        )}
      </div>

      {/* Recipe Metadata */}
      {recipe && (
        <div className="flex items-center gap-4">
          {/* Yield */}
          {isEditingYield ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editedYieldQty}
                onChange={(e) => setEditedYieldQty(e.target.value)}
                className="w-20"
                min={0}
              />
              <Input
                value={editedYieldUnit}
                onChange={(e) => setEditedYieldUnit(e.target.value)}
                className="w-24"
                placeholder="unit"
              />
              <button
                onClick={handleYieldSave}
                className="text-sm text-blue-600 hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingYield(false)}
                className="text-sm text-zinc-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingYield(true)}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <span className="text-zinc-500">Yield:</span>{' '}
              <span className="font-medium">
                {recipe.yield_quantity} {recipe.yield_unit}
              </span>
            </button>
          )}

          {/* Status */}
          <Select
            value={recipe.status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            className="w-28"
          />

          {/* Cost per portion */}
          <div className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm dark:bg-zinc-800">
            <span className="text-zinc-500">Cost:</span>{' '}
            <span className="font-medium">
              {formatCurrency(costing?.cost_per_portion)}
            </span>
          </div>

          {/* Selling Price */}
          {isEditingPrice ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
                className="w-24"
                placeholder="0.00"
                min={0}
                step={0.01}
              />
              <button
                onClick={handlePriceSave}
                className="text-sm text-blue-600 hover:underline"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingPrice(true)}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <span className="text-zinc-500">Price:</span>{' '}
              <span className="font-medium">
                {formatCurrency(recipe.selling_price_est)}
              </span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
