'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useMenu } from '@/lib/hooks';
import { Skeleton } from '@/components/ui';

interface PreviewMenuPageProps {
  params: Promise<{ id: string }>;
}

export default function PreviewMenuPage({ params }: PreviewMenuPageProps) {
  const { id } = use(params);
  const menuId = parseInt(id, 10);
  const { data: menu, isLoading, error } = useMenu(menuId);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{menu.name}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Version {menu.version_no} •{' '}
            {menu.is_published ? 'Published' : 'Draft'}
          </p>
        </div>

        {/* Menu Sections */}
          {menu.sections.length === 0 ? (
            <p className="text-center text-zinc-500">No sections in this menu</p>
          ) : (
            <div className="space-y-4">
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
                      ) : (
                        <ul className="space-y-3">
                          {section.items.map((item) => (
                            <li key={item.id} className="pb-3 border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-medium">{item.recipe_name}</p>
                                  {item.additional_info && (
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                      {item.additional_info}
                                    </p>
                                  )}
                                  {item.key_highlights && (
                                    <p className="text-sm text-zinc-500 italic">
                                      {item.key_highlights}
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
