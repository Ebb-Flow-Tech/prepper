'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useMenus } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Card, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/ui';

export default function MenuPage() {
  const router = useRouter();
  const { userType, isManager } = useAppState();
  const { data: menus, isLoading } = useMenus();

  const canCreate = userType === 'admin' || isManager;

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Menus"
          description="Create and manage restaurant menus"
        >
          {canCreate && (
            <Button
              onClick={() => router.push('/menu/new')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Menu
            </Button>
          )}
        </PageHeader>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : menus && menus.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <Card
                key={menu.id}
                className="flex cursor-pointer flex-col justify-between p-4 hover:shadow-lg transition-shadow"
              >
                <div onClick={() => router.push(`/menu/preview/${menu.id}`)}>
                  <h3 className="font-semibold">{menu.name}</h3>
                  <p className="text-sm text-zinc-500">
                    v{menu.version_no} • {menu.is_published ? 'Published' : 'Draft'}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/menu/preview/${menu.id}`)}
                    className="flex-1"
                  >
                    View
                  </Button>
                  {(userType === 'admin' || isManager) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/menu/edit/${menu.id}`)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-zinc-500">No menus available yet.</p>
            {canCreate && (
              <Button
                onClick={() => router.push('/menu/new')}
                className="mt-4"
              >
                Create your first menu
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
