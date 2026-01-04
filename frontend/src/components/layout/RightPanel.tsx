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
      data-ingredient-card
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card p-3',
        isDragging && 'opacity-50'
      )}
    >
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{ingredient.name}</p>
        <p className="text-sm text-muted-foreground">
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
        <div key={i} className="rounded-lg border border-border p-3">
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-3">
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
    <aside className="flex h-full w-72 flex-col border-l border-border bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">Ingredients</h2>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Ingredient List */}
      <div
        className="flex-1 overflow-y-auto p-3"
        onDoubleClick={(e) => {
          // Only trigger if clicking on the container itself, not on ingredients
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-ingredient-list]')) {
            if (!(e.target as HTMLElement).closest('[data-ingredient-card]')) {
              setShowForm(true);
            }
          }
        }}
      >
        {showForm && (
          <div className="mb-3">
            <NewIngredientForm onClose={() => setShowForm(false)} />
          </div>
        )}

        {isLoading ? (
          <IngredientListSkeleton />
        ) : error ? (
          <div className="rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">
            Failed to load ingredients
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="py-8 text-center" data-ingredient-list>
            <p className="text-sm text-muted-foreground">
              {search ? 'No ingredients found' : 'No ingredients yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Double-click anywhere to add one
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
          <div className="space-y-2" data-ingredient-list>
            <p className="mb-2 text-xs text-muted-foreground">
              Drag to add to recipe • Double-click to create new
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
