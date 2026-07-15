'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMenu } from '@/lib/hooks';
import { MenuBuilder } from '@/components/menu/MenuBuilder';
import { useSelectableBrands } from '@/components/units';
import { Skeleton } from '@/components/ui';

interface EditMenuPageProps {
  params: Promise<{ id: string }>;
}

export default function EditMenuPage({ params }: EditMenuPageProps) {
  const { id } = use(params);
  const menuId = parseInt(id, 10);
  const router = useRouter();
  const { data: menu, isLoading, error } = useMenu(menuId);
  const { brands: manageableBrands, isLoading: brandsLoading } = useSelectableBrands(true);

  // Editable only by a Manager AT ONE OF THE BRANDS this menu is served at — the same question the
  // API asks per unit on the write.
  const canEdit =
    menu?.outlets?.some((unit) => manageableBrands.some((brand) => brand.id === unit.unit_id)) ??
    false;

  useEffect(() => {
    if (!isLoading && (error || !menu)) {
      router.push('/menu');
      return;
    }
    if (!isLoading && !brandsLoading && menu && !canEdit) {
      router.push('/menu');
    }
  }, [router, isLoading, brandsLoading, error, menu, canEdit]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-foreground">Edit Menu</h1>
          </div>
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-foreground">Edit Menu</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Menu not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Edit Menu</h1>
          <p className="text-sm text-muted-foreground mt-1">{menu.name} • Version {menu.version_no}</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <MenuBuilder mode="edit" menu={menu} />
      </div>
    </div>
  );
}
