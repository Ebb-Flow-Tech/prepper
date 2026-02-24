'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAppState } from '@/lib/store';
import { MenuBuilder } from '@/components/menu/MenuBuilder';

export default function NewMenuPage() {
  const router = useRouter();
  const { userType, isManager } = useAppState();

  // Check authorization
  useEffect(() => {
    if (userType !== 'admin' && !isManager) {
      router.push('/menu');
    }
  }, [userType, isManager, router]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Create New Menu</h1>
        <p className="text-sm text-zinc-500">Add a new menu with sections and items</p>
      </div>
      <div className="flex-1 overflow-auto">
        <MenuBuilder mode="create" />
      </div>
    </div>
  );
}
