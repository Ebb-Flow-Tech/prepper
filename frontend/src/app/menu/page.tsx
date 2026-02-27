'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArchiveRestore } from 'lucide-react';
import { useMenus, useDeleteMenu, useRestoreMenu } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, Card, Skeleton, Badge, Checkbox, PageHeader } from '@/components/ui';

export default function MenuPage() {
  const router = useRouter();
  const { userType, isManager } = useAppState();
  const canManage = userType === 'admin' || isManager;

  const [showArchived, setShowArchived] = useState(false);
  const { data: menus, isLoading } = useMenus(canManage && showArchived);

  const deleteMenu = useDeleteMenu();
  const restoreMenu = useRestoreMenu();

  const handleArchive = (menuId: number) => {
    deleteMenu.mutate(menuId);
  };

  const handleRestore = (menuId: number) => {
    restoreMenu.mutate(menuId);
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Menus"
          description="Create and manage restaurant menus"
        >
          {canManage && (
            <Button
              onClick={() => router.push('/menu/new')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Menu
            </Button>
          )}
        </PageHeader>

        {/* Show archived toggle - only for admins/managers */}
        {canManage && (
          <div className="flex items-center gap-2 mb-6">
            <Checkbox
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              label="Show archived"
            />
          </div>
        )}

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
                className={`flex cursor-pointer flex-col justify-between p-4 hover:shadow-lg transition-shadow ${
                  !menu.is_active ? 'opacity-60' : ''
                }`}
              >
                <div onClick={() => router.push(`/menu/preview/${menu.id}`)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{menu.name}</h3>
                    {!menu.is_active && (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </div>
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
                  {canManage && menu.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/menu/edit/${menu.id}`)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                  )}
                  {canManage && (
                    menu.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleArchive(menu.id)}
                        disabled={deleteMenu.isPending}
                        title="Archive menu"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRestore(menu.id)}
                        disabled={restoreMenu.isPending}
                        title="Restore menu"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-zinc-500">No menus available yet.</p>
            {canManage && (
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
