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
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Create New Menu</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Add a new menu with sections and items</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <MenuBuilder mode="create" />
      </div>
    </div>
  );
}
