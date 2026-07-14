'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import { useTagsForSupplierIngredient } from '@/lib/hooks';
import { TagManagementModal } from './TagManagementModal';

interface TagsCellProps {
  siId: number;
}

export function TagsCell({ siId }: TagsCellProps) {
  const [open, setOpen] = useState(false);
  const { data: tags = [] } = useTagsForSupplierIngredient(siId);

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {tag.name}
          </span>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-lg p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Edit tags"
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
      </div>

      <TagManagementModal
        siId={siId}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
