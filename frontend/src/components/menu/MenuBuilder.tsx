'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useRecipes, useOutlets, useCreateMenu, useUpdateMenu, useForkMenu } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Input, Select } from '@/components/ui';
import type { MenuDetail, CreateMenuSectionRequest } from '@/types';

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

  const updateSection = (index: number, field: string, value: any) => {
    const newSections = [...sections];
    (newSections[index] as any)[field] = value;
    setSections(newSections);
  };

  const updateItem = (sectionIndex: number, itemIndex: number, field: string, value: any) => {
    const newSections = [...sections];
    (newSections[sectionIndex].items[itemIndex] as any)[field] = value;
    setSections(newSections);
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

    const sectionData: CreateMenuSectionRequest[] = sections.map((s) => ({
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

    try {
      if (mode === 'create') {
        await createMenuMutation.mutateAsync({
          name,
          is_published: isPublished,
          outlet_ids: selectedOutletIds,
          sections: sectionData,
        });
        router.push('/menu');
      } else if (menu) {
        await updateMenuMutation.mutateAsync({
          menuId: menu.id,
          data: {
            name,
            is_published: isPublished,
            outlet_ids: selectedOutletIds,
            sections: sectionData,
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

        <div className="flex items-center gap-3">
          <input
            id="published"
            type="checkbox"
            checked={isPublished}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPublished(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="published" className="text-sm font-medium cursor-pointer">
            Publish menu
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Outlets *</label>
          <div className="space-y-2">
            {accessibleOutlets.map((outlet) => (
              <div key={outlet.id} className="flex items-center gap-3">
                <input
                  id={`outlet-${outlet.id}`}
                  type="checkbox"
                  checked={selectedOutletIds.includes(outlet.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOutletIds([...selectedOutletIds, outlet.id]);
                    } else {
                      setSelectedOutletIds(selectedOutletIds.filter((id) => id !== outlet.id));
                    }
                  }}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor={`outlet-${outlet.id}`} className="text-sm cursor-pointer">
                  {outlet.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Sections</h3>
          <Button onClick={addSection} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        <div className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="border border-zinc-200 rounded-lg p-4 dark:border-zinc-800">
              <div className="flex gap-2 mb-4">
                <Input
                  value={section.name}
                  onChange={(e) => updateSection(sectionIndex, 'name', e.target.value)}
                  placeholder="Section name"
                  className="flex-1"
                />
                <Button
                  onClick={() => removeSection(sectionIndex)}
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
                    onClick={() => addItem(sectionIndex)}
                    size="sm"
                    variant="ghost"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex gap-2 text-sm bg-zinc-50 p-2 rounded dark:bg-zinc-900">
                    <Select
                      value={item.recipe_id.toString()}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        updateItem(sectionIndex, itemIndex, 'recipe_id', parseInt(e.target.value))
                      }
                      options={
                        recipes?.map((r) => ({
                          value: r.id.toString(),
                          label: r.name,
                        })) || []
                      }
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={item.display_price || ''}
                      onChange={(e) => updateItem(sectionIndex, itemIndex, 'display_price', parseFloat(e.target.value) || null)}
                      placeholder="Price"
                      className="w-20"
                    />
                    <Button
                      onClick={() => removeItem(sectionIndex, itemIndex)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
