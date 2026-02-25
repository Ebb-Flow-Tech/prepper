'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';
import { useMenu } from '@/lib/hooks';
import { MenuBuilder } from '@/components/menu/MenuBuilder';
import { Skeleton } from '@/components/ui';

interface EditMenuPageProps {
  params: Promise<{ id: string }>;
}

export default function EditMenuPage({ params }: EditMenuPageProps) {
  const { id } = use(params);
  const menuId = parseInt(id, 10);
  const router = useRouter();
  const { userType, isManager } = useAppState();
  const { data: menu, isLoading, error } = useMenu(menuId);

  // Check authorization
  useEffect(() => {
    if (!isLoading && (error || !menu)) {
      router.push('/menu');
      return;
    }
    if (userType !== 'admin' && !isManager) {
      router.push('/menu');
    }
  }, [userType, isManager, router, isLoading, error, menu]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Edit Menu</h1>
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
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Edit Menu</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Menu not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Edit Menu</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{menu.name} • Version {menu.version_no}</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <MenuBuilder mode="edit" menu={menu} />
      </div>
    </div>
  );
}
