'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { useIngredients, useCreateIngredient } from '@/lib/hooks';
import { Button, Input, Select, Skeleton } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Ingredient } from '@/types';

const UNIT_OPTIONS = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'l', label: 'l (liters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
];

function DraggableIngredientCard({ ingredient }: { ingredient: Ingredient }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ingredient-${ingredient.id}`,
    data: { ingredient },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800',
        isDragging && 'opacity-50'
      )}
    >
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{ingredient.name}</p>
        <p className="text-sm text-zinc-500">
          {ingredient.base_unit} •{' '}
          {ingredient.cost_per_base_unit !== null
            ? `${formatCurrency(ingredient.cost_per_base_unit)}/${ingredient.base_unit}`
            : 'no cost set'}
        </p>
      </div>
    </div>
  );
}

function IngredientListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function NewIngredientForm({ onClose }: { onClose: () => void }) {
  const createIngredient = useCreateIngredient();
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('g');
  const [cost, setCost] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    createIngredient.mutate(
      {
        name: name.trim(),
        base_unit: baseUnit,
        cost_per_base_unit: cost ? parseFloat(cost) : null,
      },
      {
        onSuccess: () => {
          toast.success('Ingredient created');
          onClose();
        },
        onError: () => toast.error('Failed to create ingredient'),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ingredient name"
        autoFocus
      />
      <div className="flex gap-2">
        <Select
          value={baseUnit}
          onChange={(e) => setBaseUnit(e.target.value)}
          options={UNIT_OPTIONS}
          className="flex-1"
        />
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Cost"
          className="w-24"
          min={0}
          step={0.01}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={createIngredient.isPending}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RightPanel() {
  const { data: ingredients, isLoading, error } = useIngredients();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];
    const active = ingredients.filter((i) => i.is_active);
    if (!search.trim()) return active;
    const lower = search.toLowerCase();
    return active.filter((i) => i.name.toLowerCase().includes(lower));
  }, [ingredients, search]);

  return (
    <aside className="flex h-full w-72 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">Ingredients</h2>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Ingredient List */}
      <div className="flex-1 overflow-y-auto p-3">
        {showForm && (
          <div className="mb-3">
            <NewIngredientForm onClose={() => setShowForm(false)} />
          </div>
        )}

        {isLoading ? (
          <IngredientListSkeleton />
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Failed to load ingredients
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-500">
              {search ? 'No ingredients found' : 'No ingredients yet'}
            </p>
            {!search && !showForm && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-4 w-4" />
                Add your first ingredient
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="mb-2 text-xs text-zinc-500">
              Drag ingredients to add them to a recipe
            </p>
            {filteredIngredients.map((ingredient) => (
              <DraggableIngredientCard
                key={ingredient.id}
                ingredient={ingredient}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
