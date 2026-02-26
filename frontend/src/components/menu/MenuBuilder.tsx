'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Copy, GripVertical, LayoutGrid, List } from 'lucide-react';
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
import { useRecipes, useOutlets, useCreateMenu, useUpdateMenu, useForkMenu, useRecipeAllergensBatch } from '@/lib/hooks';
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
}

// Draggable Section Component
function DraggableSection({
  section,
  sectionIndex,
  recipes,
  onUpdateSection,
  onRemoveSection,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  viewMode,
  allergenMap,
}: {
  section: LocalSection;
  sectionIndex: number;
  recipes: Recipe[];
  onUpdateSection: (index: number, field: string, value: unknown) => void;
  onRemoveSection: (index: number) => void;
  onAddItem: (sectionIndex: number) => void;
  onRemoveItem: (sectionIndex: number, itemIndex: number) => void;
  onUpdateItem: (sectionIndex: number, itemIndex: number, field: string, value: unknown) => void;
  viewMode: 'card' | 'list';
  allergenMap?: Map<number, any[]>;
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
            onClick={() => onAddItem(sectionIndex)}
            size="sm"
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <SortableContext
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          <div className={viewMode === 'card' ? 'grid grid-cols-2 gap-4' : 'space-y-2'}>
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
  allergenMap?: Map<number, any[]>;
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
          <div className="relative w-full h-32 bg-zinc-100 dark:bg-zinc-800">
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
            <Select
              value={item.recipe_id.toString()}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onUpdate('recipe_id', parseInt(e.target.value))
              }
              options={recipes.map((r) => ({
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
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Key Highlights
            </p>
            <Textarea
              value={item.key_highlights || ''}
              onChange={(e) => onUpdate('key_highlights', e.target.value)}
              placeholder="e.g., signature item, seasonal special"
              className="text-sm"
              rows={2}
            />
          </div>

          {/* Additional Info */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Additional Info
            </p>
            <Textarea
              value={item.additional_info || ''}
              onChange={(e) => onUpdate('additional_info', e.target.value)}
              placeholder="e.g., dietary notes, preparation tips"
              className="text-sm"
              rows={2}
            />
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
        <Select
          value={item.recipe_id.toString()}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onUpdate('recipe_id', parseInt(e.target.value))
          }
          options={
            recipes?.map((r) => ({
              value: r.id.toString(),
              label: r.name,
            })) || []
          }
          className="flex-1"
        />
        <Input
          type="number"
          step="0.01"
          value={item.display_price || ''}
          onChange={(e) =>
            onUpdate('display_price', parseFloat(e.target.value) || null)
          }
          placeholder="Price"
          className="w-20"
        />
        <Button
          onClick={onRemove}
          variant="outline"
          size="sm"
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

      {/* Key highlights and additional info */}
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
      </div>
    </div>
  );
}

export function MenuBuilder({ mode, menu }: MenuBuilderProps) {
  const router = useRouter();
  const { userType } = useAppState();
  const { data: recipes } = useRecipes();
  const { data: outlets } = useOutlets();
  const createMenuMutation = useCreateMenu();
  const updateMenuMutation = useUpdateMenu();
  const forkMenuMutation = useForkMenu();

  const [name, setName] = useState(menu?.name || '');
  const [isPublished, setIsPublished] = useState(menu?.is_published || false);
  const [selectedOutletIds, setSelectedOutletIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
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

  const addItem = (sectionIndex: number) => {
    const newItem: LocalItem = {
      recipe_id: recipes?.[0]?.id || 0,
      order_no: sections[sectionIndex].items.length,
      display_price: null,
      additional_info: null,
      key_highlights: null,
    };
    const newSections = [...sections];
    newSections[sectionIndex].items.push(newItem);
    setSections(newSections);
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
          <label className="block text-sm font-medium mb-2">Outlets *</label>
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
              Add Section
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
                  onAddItem={addItem}
                  onRemoveItem={removeItem}
                  onUpdateItem={updateItem}
                  viewMode={viewMode}
                  allergenMap={allergenMap}
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
