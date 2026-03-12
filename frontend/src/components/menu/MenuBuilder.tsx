'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Copy, GripVertical, LayoutGrid, List, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRecipes, useOutlets, useCreateMenu, useUpdateMenu, useForkMenu, useRecipeAllergensBatch, useInfiniteRecipes, useDebouncedValue } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Input, Select, Textarea, Badge, Checkbox } from '@/components/ui';
import type { MenuDetail, Recipe } from '@/types';

interface MenuBuilderProps {
  mode: 'create' | 'edit';
  menu?: MenuDetail;
}

interface LocalSection {
  id?: number;
  name: string;
  order_no: number;
  items: LocalItem[];
}

interface LocalItem {
  id?: number;
  recipe_id: number;
  order_no: number;
  display_price: number | null;
  additional_info: string | null;
  key_highlights: string | null;
  substitution: string | null;
}

interface Allergen {
  id: number;
  name: string;
}

// Multi-Add Content Component
function MultiAddContent({
  sectionItems,
  recipes,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  onConfirm,
  onCancel,
}: {
  sectionItems: LocalItem[];
  recipes: Recipe[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const existingIds = new Set(sectionItems.map((i) => i.recipe_id));

  return (
    <div className="mt-3 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recipe list */}
      <div className="max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
        {recipes.length === 0 && (
          <p className="p-3 text-sm text-zinc-400 text-center">No recipes found</p>
        )}
        {recipes.map((recipe) => {
          const alreadyAdded = existingIds.has(recipe.id);
          const selected = selectedIds.has(recipe.id);
          return (
            <button
              key={recipe.id}
              onClick={() => !alreadyAdded && onToggle(recipe.id)}
              disabled={alreadyAdded}
              className={[
                'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                alreadyAdded
                  ? 'opacity-40 cursor-not-allowed bg-white dark:bg-zinc-950'
                  : selected
                  ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  : 'bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900',
              ].join(' ')}
            >
              <div
                className={[
                  'flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors',
                  selected && !alreadyAdded
                    ? 'bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100'
                    : 'border-zinc-300 dark:border-zinc-600',
                ].join(' ')}
              >
                {selected && !alreadyAdded && (
                  <svg className="h-2.5 w-2.5 text-white dark:text-zinc-900" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="flex-1 truncate">{recipe.name}</span>
              {alreadyAdded && (
                <span className="text-xs text-zinc-400 shrink-0">Added</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2">
          <button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading…' : 'View more'}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select recipes to add'}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={selectedIds.size === 0}>
            Add {selectedIds.size > 0 ? `${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Draggable Section Component
function DraggableSection({
  section,
  sectionIndex,
  recipes,
  onUpdateSection,
  onRemoveSection,
  onRemoveItem,
  onUpdateItem,
  viewMode,
  allergenMap,
  onOpenMultiAdd,
  multiAddPanel,
}: {
  section: LocalSection;
  sectionIndex: number;
  recipes: Recipe[];
  onUpdateSection: (index: number, field: string, value: unknown) => void;
  onRemoveSection: (index: number) => void;
  onRemoveItem: (sectionIndex: number, itemIndex: number) => void;
  onUpdateItem: (sectionIndex: number, itemIndex: number, field: string, value: unknown) => void;
  viewMode: 'card' | 'list';
  allergenMap?: Map<number, Allergen[]>;
  onOpenMultiAdd: () => void;
  multiAddPanel?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `section-${sectionIndex}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const itemIds = section.items.map((_, idx) => `item-${sectionIndex}-${idx}`);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-zinc-200 rounded-lg p-4 dark:border-zinc-800"
    >
      <div className="flex gap-2 mb-4">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 text-zinc-400 hover:text-zinc-600"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <Input
          value={section.name}
          onChange={(e) => onUpdateSection(sectionIndex, 'name', e.target.value)}
          placeholder="Section name"
          className="flex-1"
        />
        <Button
          onClick={() => onRemoveSection(sectionIndex)}
          variant="outline"
          size="sm"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-2 ml-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Items</h4>
          <Button
            onClick={onOpenMultiAdd}
            size="sm"
            variant="ghost"
            title="Add recipes"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <SortableContext
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          <div className={viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-2'}>
            {section.items.map((item, itemIndex) => (
              <DraggableItem
                key={itemIndex}
                item={item}
                itemIndex={itemIndex}
                sectionIndex={sectionIndex}
                recipes={recipes}
                onRemove={() => onRemoveItem(sectionIndex, itemIndex)}
                onUpdate={(field, value) =>
                  onUpdateItem(sectionIndex, itemIndex, field, value)
                }
                viewMode={viewMode}
                allergenMap={allergenMap}
              />
            ))}
          </div>
        </SortableContext>

        {multiAddPanel}
      </div>
    </div>
  );
}

// Draggable Item Component
function DraggableItem({
  item,
  itemIndex,
  sectionIndex,
  recipes,
  onRemove,
  onUpdate,
  viewMode,
  allergenMap,
}: {
  item: LocalItem;
  itemIndex: number;
  sectionIndex: number;
  recipes: Recipe[];
  onRemove: () => void;
  onUpdate: (field: string, value: unknown) => void;
  viewMode: 'card' | 'list';
  allergenMap?: Map<number, Allergen[]>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `item-${sectionIndex}-${itemIndex}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [recipeSearch, setRecipeSearch] = useState('');
  const [highlightsOpen, setHighlightsOpen] = useState(true);
  const [additionalOpen, setAdditionalOpen] = useState(true);
  const [substitutionOpen, setSubstitutionOpen] = useState(true);
  const filteredRecipes = recipeSearch
    ? recipes.filter((r) => r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
    : recipes;

  const recipe = recipes.find((r) => r.id === item.recipe_id);

  if (viewMode === 'card') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
      >
        {/* Recipe Image */}
        {recipe?.image_url && (
          <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={recipe.image_url}
              alt={recipe.name}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Drag Handle and Delete */}
          <div className="flex gap-2">
            <div
              {...attributes}
              {...listeners}
              className="flex items-center justify-center cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 flex-shrink-0"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex-1" />
            <Button
              onClick={onRemove}
              variant="outline"
              size="sm"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Recipe Name */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Recipe Name
            </p>
            <input
              type="text"
              placeholder="Search recipes..."
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md mb-1 bg-white dark:bg-zinc-900 focus:outline-none"
            />
            <Select
              value={item.recipe_id.toString()}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onUpdate('recipe_id', parseInt(e.target.value))
              }
              options={filteredRecipes.map((r) => ({
                value: r.id.toString(),
                label: r.name,
              }))}
              className="w-full"
            />
          </div>

          {/* Allergens */}
          {(allergenMap?.get(item.recipe_id) ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Allergens
              </p>
              <div className="flex flex-wrap gap-1">
                {(allergenMap?.get(item.recipe_id) ?? []).map((a) => (
                  <Badge key={a.id} variant="warning">{a.name}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Price */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Price
            </p>
            <Input
              type="number"
              step="0.01"
              value={item.display_price || ''}
              onChange={(e) =>
                onUpdate('display_price', parseFloat(e.target.value) || null)
              }
              placeholder="Enter price"
              className="w-full"
            />
          </div>

          {/* Key Highlights */}
          <div>
            <button
              type="button"
              onClick={() => setHighlightsOpen(!highlightsOpen)}
              className="flex items-center gap-1.5 w-full text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${highlightsOpen ? '' : '-rotate-90'}`} />
              Key Highlights
            </button>
            {highlightsOpen && (
              <Textarea
                value={item.key_highlights || ''}
                onChange={(e) => onUpdate('key_highlights', e.target.value)}
                placeholder="e.g., signature item, seasonal special"
                className="text-sm"
                rows={2}
              />
            )}
          </div>

          {/* Additional Info */}
          <div>
            <button
              type="button"
              onClick={() => setAdditionalOpen(!additionalOpen)}
              className="flex items-center gap-1.5 w-full text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${additionalOpen ? '' : '-rotate-90'}`} />
              Additional Info
            </button>
            {additionalOpen && (
              <Textarea
                value={item.additional_info || ''}
                onChange={(e) => onUpdate('additional_info', e.target.value)}
                placeholder="e.g., dietary notes, preparation tips"
                className="text-sm"
                rows={2}
              />
            )}
          </div>

          {/* Substitution */}
          <div>
            <button
              type="button"
              onClick={() => setSubstitutionOpen(!substitutionOpen)}
              className="flex items-center gap-1.5 w-full text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${substitutionOpen ? '' : '-rotate-90'}`} />
              Substitution
            </button>
            {substitutionOpen && (
              <Textarea
                value={item.substitution || ''}
                onChange={(e) => onUpdate('substitution', e.target.value)}
                placeholder="e.g., alternative ingredients, preparation notes"
                className="text-sm"
                rows={2}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view (original)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800 space-y-3"
    >
      <div className="flex gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 text-zinc-400 hover:text-zinc-600 flex-shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <input
              type="text"
              placeholder="Search recipes..."
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 focus:outline-none"
            />
            <Select
              value={item.recipe_id.toString()}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onUpdate('recipe_id', parseInt(e.target.value))
              }
              options={
                filteredRecipes?.map((r) => ({
                  value: r.id.toString(),
                  label: r.name,
                })) || []
              }
              className="w-full"
            />
          </div>
          <Input
            type="number"
            step="0.01"
            value={item.display_price || ''}
            onChange={(e) =>
              onUpdate('display_price', parseFloat(e.target.value) || null)
            }
            placeholder="Price"
            className="w-full sm:w-20"
          />
        </div>
        <Button
          onClick={onRemove}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Allergens */}
      {(allergenMap?.get(item.recipe_id) ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 ml-6 mt-1">
          {(allergenMap?.get(item.recipe_id) ?? []).map((a) => (
            <Badge key={a.id} variant="warning">{a.name}</Badge>
          ))}
        </div>
      )}

      {/* Key highlights, additional info, and substitution */}
      <div className="space-y-2 ml-6">
        <Textarea
          value={item.key_highlights || ''}
          onChange={(e) => onUpdate('key_highlights', e.target.value)}
          placeholder="Key highlights (e.g., signature item, seasonal special)"
          className="text-sm"
          rows={2}
        />
        <Textarea
          value={item.additional_info || ''}
          onChange={(e) => onUpdate('additional_info', e.target.value)}
          placeholder="Additional info (e.g., dietary notes, preparation tips)"
          className="text-sm"
          rows={2}
        />
        <Textarea
          value={item.substitution || ''}
          onChange={(e) => onUpdate('substitution', e.target.value)}
          placeholder="Substitution (e.g., alternative ingredients, preparation notes)"
          className="text-sm"
          rows={2}
        />
      </div>
    </div>
  );
}

export function MenuBuilder({ mode, menu }: MenuBuilderProps) {
  const router = useRouter();
  const { userType } = useAppState();
  const { data: recipesData } = useRecipes({ page_size: 30 });
  const recipes = recipesData?.items;
  const { data: outletsData } = useOutlets({ page_size: 30 });
  const outlets = outletsData?.items;
  const createMenuMutation = useCreateMenu();
  const updateMenuMutation = useUpdateMenu();
  const forkMenuMutation = useForkMenu();

  const [name, setName] = useState(menu?.name || '');
  const [isPublished, setIsPublished] = useState(menu?.is_published || false);
  const [selectedOutletIds, setSelectedOutletIds] = useState<number[]>([]);
  const [outletsOpen, setOutletsOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');

  // Multi-add state
  const [multiAddTarget, setMultiAddTarget] = useState<number | null>(null);
  const [multiAddSearch, setMultiAddSearch] = useState('');
  const [multiAddSelectedIds, setMultiAddSelectedIds] = useState<Set<number>>(new Set());
  const debouncedMultiSearch = useDebouncedValue(multiAddSearch, 300);
  const {
    data: multiAddData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteRecipes({ search: debouncedMultiSearch || undefined, page_size: 20 });
  const multiAddRecipes = multiAddData?.pages.flatMap((p) => p.items) ?? [];

  const openMultiAdd = useCallback((sectionIndex: number) => {
    setMultiAddTarget(sectionIndex);
    setMultiAddSearch('');
    setMultiAddSelectedIds(new Set());
  }, []);

  const toggleMultiAddRecipe = useCallback((recipeId: number) => {
    setMultiAddSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  }, []);

  const confirmMultiAdd = useCallback(() => {
    if (multiAddTarget === null) return;
    setSections((prev) => {
      const newSections = [...prev];
      const sectionItems = newSections[multiAddTarget].items;
      const existingIds = new Set(sectionItems.map((i) => i.recipe_id));
      const newItems: LocalItem[] = [];
      multiAddSelectedIds.forEach((recipeId) => {
        if (!existingIds.has(recipeId)) {
          newItems.push({
            recipe_id: recipeId,
            order_no: sectionItems.length + newItems.length,
            display_price: null,
            additional_info: null,
            key_highlights: null,
            substitution: null,
          });
        }
      });
      newSections[multiAddTarget] = {
        ...newSections[multiAddTarget],
        items: [...sectionItems, ...newItems],
      };
      return newSections;
    });
    setMultiAddTarget(null);
  }, [multiAddTarget, multiAddSelectedIds]);

  const cancelMultiAdd = useCallback(() => {
    setMultiAddTarget(null);
  }, []);
  const [sections, setSections] = useState<LocalSection[]>(
    menu?.sections.map((s) => ({
      id: s.id,
      name: s.name,
      order_no: s.order_no,
      items: s.items.map((i) => ({
        id: i.id,
        recipe_id: i.recipe_id,
        order_no: i.order_no,
        display_price: i.display_price,
        additional_info: i.additional_info,
        key_highlights: i.key_highlights,
        substitution: i.substitution,
      })),
    })) || []
  );

  // Extract all recipe IDs from sections for batch allergen fetching
  const recipeIds = useMemo(
    () => sections.flatMap((s) => s.items.map((i) => i.recipe_id)).filter(Boolean) as number[],
    [sections]
  );
  const { data: allergenMap } = useRecipeAllergensBatch(recipeIds);

  // Setup sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize selectedOutletIds from menu when editing
  useEffect(() => {
    if (mode === 'edit' && menu?.outlets) {
      setSelectedOutletIds(menu.outlets.map((o) => o.outlet_id));
    }
  }, [mode, menu?.outlets]);

  const accessibleOutlets = useMemo(() => {
    if (userType === 'admin') return outlets || [];
    return outlets || [];
  }, [outlets, userType]);

  const addSection = () => {
    const newSection: LocalSection = {
      name: `Section ${sections.length + 1}`,
      order_no: sections.length,
      items: [],
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].items.splice(itemIndex, 1);
    setSections(newSections);
  };

  const updateSection = (index: number, field: string, value: unknown) => {
    const newSections = [...sections];
    (newSections[index] as unknown as Record<string, unknown>)[field] = value;
    setSections(newSections);
  };

  const updateItem = (sectionIndex: number, itemIndex: number, field: string, value: unknown) => {
    const newSections = [...sections];
    (newSections[sectionIndex].items[itemIndex] as unknown as Record<string, unknown>)[field] = value;
    setSections(newSections);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Handle section reordering
    if (activeId.startsWith('section-') && overId.startsWith('section-')) {
      const oldIndex = parseInt(activeId.split('-')[1]);
      const newIndex = parseInt(overId.split('-')[1]);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedSections = arrayMove([...sections], oldIndex, newIndex);
        // Update order_no values
        reorderedSections.forEach((s, idx) => {
          s.order_no = idx;
        });
        setSections(reorderedSections);
      }
      return;
    }

    // Handle item reordering within sections
    if (activeId.startsWith('item-') && overId.startsWith('item-')) {
      const [, activeSectionIdx, activeItemIdx] = activeId.split('-').map(Number);
      const [, overSectionIdx, overItemIdx] = overId.split('-').map(Number);

      if (activeSectionIdx === overSectionIdx) {
        const newSections = [...sections];
        const reorderedItems = arrayMove(
          [...newSections[activeSectionIdx].items],
          activeItemIdx,
          overItemIdx
        );
        // Update order_no values
        reorderedItems.forEach((item, idx) => {
          item.order_no = idx;
        });
        newSections[activeSectionIdx].items = reorderedItems;
        setSections(newSections);
      }
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Menu name is required');
      return;
    }

    if (selectedOutletIds.length === 0) {
      toast.error('At least one outlet must be selected');
      return;
    }

    try {
      if (mode === 'create') {
        const createSectionData = sections.map((s) => ({
          name: s.name,
          order_no: s.order_no,
          items: s.items.map((i) => ({
            recipe_id: i.recipe_id,
            order_no: i.order_no,
            display_price: i.display_price,
            additional_info: i.additional_info,
            key_highlights: i.key_highlights,
            substitution: i.substitution,
          })),
        }));

        await createMenuMutation.mutateAsync({
          name,
          is_published: isPublished,
          outlet_ids: selectedOutletIds,
          sections: createSectionData,
        });
        router.push('/menu');
      } else if (menu) {
        const updateSectionData = sections.map((s) => ({
          id: s.id,
          name: s.name,
          order_no: s.order_no,
          items: s.items.map((i) => ({
            id: i.id,
            recipe_id: i.recipe_id,
            order_no: i.order_no,
            display_price: i.display_price,
            additional_info: i.additional_info,
            key_highlights: i.key_highlights,
            substitution: i.substitution,
          })),
        }));

        await updateMenuMutation.mutateAsync({
          menuId: menu.id,
          data: {
            name,
            is_published: isPublished,
            outlet_ids: selectedOutletIds,
            sections: updateSectionData,
          },
        });
        router.push('/menu');
      }
    } catch (error) {
      console.error('Error saving menu:', error);
    }
  };

  const handleFork = async () => {
    if (!menu) return;
    try {
      await forkMenuMutation.mutateAsync(menu.id);
      router.push('/menu');
    } catch (error) {
      console.error('Error forking menu:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Menu Metadata */}
      <div className="space-y-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div>
          <label className="block text-sm font-medium mb-2">Menu Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter menu name"
          />
        </div>

        <Checkbox
          checked={isPublished}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPublished(e.target.checked)}
          label="Publish menu"
        />

        <div>
          <button
            type="button"
            onClick={() => setOutletsOpen(!outletsOpen)}
            className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${outletsOpen ? '' : '-rotate-90'}`} />
            Outlets *
            {selectedOutletIds.length > 0 && (
              <span className="text-xs text-zinc-400 font-normal">({selectedOutletIds.length} selected)</span>
            )}
          </button>
          {outletsOpen && (
            <div className="space-y-2">
              {accessibleOutlets.map((outlet) => (
                <Checkbox
                  key={outlet.id}
                  checked={selectedOutletIds.includes(outlet.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOutletIds([...selectedOutletIds, outlet.id]);
                    } else {
                      setSelectedOutletIds(selectedOutletIds.filter((id) => id !== outlet.id));
                    }
                  }}
                  label={outlet.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Sections (drag to reorder)</h3>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-md p-1">
              <Button
                onClick={() => setViewMode('list')}
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setViewMode('card')}
                size="sm"
                variant={viewMode === 'card' ? 'default' : 'ghost'}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={addSection} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((_, idx) => `section-${idx}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className={viewMode === 'card' ? 'space-y-6' : 'space-y-4'}>
              {sections.map((section, sectionIndex) => (
                <DraggableSection
                  key={sectionIndex}
                  section={section}
                  sectionIndex={sectionIndex}
                  recipes={recipes || []}
                  onUpdateSection={updateSection}
                  onRemoveSection={removeSection}
                  onRemoveItem={removeItem}
                  onUpdateItem={updateItem}
                  viewMode={viewMode}
                  allergenMap={allergenMap}
                  onOpenMultiAdd={() => openMultiAdd(sectionIndex)}
                  multiAddPanel={
                    multiAddTarget === sectionIndex ? (
                      <MultiAddContent
                        sectionItems={section.items}
                        recipes={multiAddRecipes}
                        hasNextPage={!!hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={fetchNextPage}
                        selectedIds={multiAddSelectedIds}
                        onToggle={toggleMultiAddRecipe}
                        search={multiAddSearch}
                        onSearchChange={setMultiAddSearch}
                        onConfirm={confirmMultiAdd}
                        onCancel={cancelMultiAdd}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Button variant="outline" onClick={() => router.push('/menu')}>
          Cancel
        </Button>
        {mode === 'edit' && menu && (
          <Button
            variant="outline"
            onClick={handleFork}
            disabled={forkMenuMutation.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            Fork
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={createMenuMutation.isPending || updateMenuMutation.isPending}
        >
          {mode === 'create' ? 'Create Menu' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
