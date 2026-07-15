'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MenuBuilder } from '@/components/menu/MenuBuilder';
import { useSelectableBrands } from '@/components/units';

export default function NewMenuPage() {
  const router = useRouter();
  // A menu must be attached to a brand the user manages. "Manager" is asked per brand, so the
  // question here is whether they manage ANY brand — not whether they hold a global flag.
  const { brands: manageableBrands, isLoading } = useSelectableBrands(true);

  useEffect(() => {
    if (!isLoading && manageableBrands.length === 0) {
      router.push('/menu');
    }
  }, [isLoading, manageableBrands.length, router]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Create New Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">Add a new menu with sections and items</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <MenuBuilder mode="create" />
      </div>
    </div>
  );
}
