'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronUp, ArrowLeft, LayoutGrid, List } from 'lucide-react';
import { useMenu, useRecipes, useRecipeAllergensBatch } from '@/lib/hooks';
import { Skeleton, Button, Badge } from '@/components/ui';

interface PreviewMenuPageProps {
  params: Promise<{ id: string }>;
}

export default function PreviewMenuPage({ params }: PreviewMenuPageProps) {
  const { id } = use(params);
  const menuId = parseInt(id, 10);
  const { data: menu, isLoading, error } = useMenu(menuId);
  const { data: recipes = [] } = useRecipes();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');

  // Extract all recipe IDs from menu sections for batch allergen fetching
  const recipeIds = useMemo(
    () => menu?.sections.flatMap((s) => s.items.map((i) => i.recipe_id)) ?? [],
    [menu]
  );
  const { data: allergenMap } = useRecipeAllergensBatch(recipeIds);

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center justify-center py-12">
            <p className="text-zinc-500">Menu not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Menu Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{menu.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Version {menu.version_no} •{' '}
              {menu.is_published ? 'Published' : 'Draft'}
            </p>
          </div>
          <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-md p-1">
            <Button
              onClick={() => setViewMode('list')}
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="px-3"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setViewMode('card')}
              size="sm"
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              className="px-3"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Menu Sections */}
          {menu.sections.length === 0 ? (
            <p className="text-center text-zinc-500">No sections in this menu</p>
          ) : (
            <div className={viewMode === 'card' ? 'space-y-8' : 'space-y-4'}>
              {menu.sections.map((section) => (
                <div
                  key={section.id}
                  className="border border-zinc-200 rounded-lg dark:border-zinc-800"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <h2 className="font-semibold">{section.name}</h2>
                    {expandedSections.has(section.id) ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>

                  {expandedSections.has(section.id) && (
                    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                      {section.items.length === 0 ? (
                        <p className="text-sm text-zinc-500">No items</p>
                      ) : viewMode === 'card' ? (
                        <div className="grid grid-cols-2 gap-4">
                          {section.items.map((item) => {
                            const recipe = recipes.find((r) => r.id === item.recipe_id);
                            return (
                              <div key={item.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
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
                                {!recipe?.image_url && (
                                  <div className="w-full h-32 bg-zinc-100 dark:bg-zinc-800" />
                                )}

                                {/* Content */}
                                <div className="p-4 space-y-3">
                                  {/* Recipe Name */}
                                  <div>
                                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                      Recipe Name
                                    </p>
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                      {item.recipe_name}
                                    </p>
                                  </div>

                                  {/* Allergens */}
                                  {(allergenMap?.get(item.recipe_id) ?? []).length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                        Allergens
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {(allergenMap.get(item.recipe_id) ?? []).map((a) => (
                                          <Badge key={a.id} variant="warning">{a.name}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Key Highlights */}
                                  {item.key_highlights && (
                                    <div>
                                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                        Key Highlights
                                      </p>
                                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {item.key_highlights}
                                      </p>
                                    </div>
                                  )}

                                  {/* Additional Info */}
                                  {item.additional_info && (
                                    <div>
                                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                        Additional Info
                                      </p>
                                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {item.additional_info}
                                      </p>
                                    </div>
                                  )}

                                  {/* Price */}
                                  {item.display_price && (
                                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                        Price
                                      </p>
                                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        ${item.display_price.toFixed(2)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {section.items.map((item) => (
                            <li key={item.id} className="pb-3 border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-medium">{item.recipe_name}</p>
                                  {(allergenMap?.get(item.recipe_id) ?? []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(allergenMap.get(item.recipe_id) ?? []).map((a) => (
                                        <Badge key={a.id} variant="warning">{a.name}</Badge>
                                      ))}
                                    </div>
                                  )}
                                  {item.key_highlights && (
                                    <p className="text-sm text-zinc-500 italic mt-2">
                                      {item.key_highlights}
                                    </p>
                                  )}
                                  {item.additional_info && (
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                      {item.additional_info}
                                    </p>
                                  )}
                                </div>
                                {item.display_price && (
                                  <p className="font-semibold ml-4">${item.display_price.toFixed(2)}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
