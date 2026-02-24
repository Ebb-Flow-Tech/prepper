'use client';

import { useState, useMemo } from 'react';
import { SearchInput, Skeleton, PageHeader, Button } from '@/components/ui';
import { useUsers, useUpdateUser, useOutlets } from '@/lib/hooks';
import { AddUserModal } from './AddUserModal';
import { toast } from 'sonner';

export function UserManagementTab() {
  const [search, setSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const updateUser = useUpdateUser();
  const { data: users, isLoading, error } = useUsers();
  const { data: outlets } = useOutlets();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user) => {
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          user.username.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [users, search]);

  const handleOutletChange = (userId: string, outletId: number | null) => {
    updateUser.mutate(
      { userId, data: { outlet_id: outletId } },
      {
        onSuccess: () => {
          toast.success('User outlet updated');
        },
        onError: () => {
          toast.error('Failed to update user');
        },
      }
    );
  };

  const handleManagerToggle = (userId: string, isManager: boolean) => {
    updateUser.mutate(
      { userId, data: { is_manager: !isManager } },
      {
        onSuccess: () => {
          toast.success(!isManager ? 'Manager status granted' : 'Manager status revoked');
        },
        onError: () => {
          toast.error('Failed to update user');
        },
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-600 dark:text-red-400">
          Failed to load users. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Users"
          description="Manage user roles and outlet assignments"
        />

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="max-w-md flex-1">
            <SearchInput
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
          <Button onClick={() => setIsAddUserModalOpen(true)}>
            Add User
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {search ? 'No users match your search' : 'No users found'}
            </p>
          </div>
        )}

        {/* Users Table */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-6 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Manager
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Branch
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-6 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                      {user.username}
                    </td>
                    <td className="px-6 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {user.email}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.user_type === 'admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        }`}
                      >
                        {user.user_type === 'admin' ? 'Admin' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {user.user_type === 'admin' ? (
                        <span className="text-zinc-500 dark:text-zinc-400">—</span>
                      ) : (
                        <button
                          onClick={() => handleManagerToggle(user.id, user.is_manager)}
                          disabled={updateUser.isPending}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.is_manager
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {user.is_manager ? 'Manager' : 'Not Manager'}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {user.user_type === 'admin' ? (
                        <span className="text-zinc-500 dark:text-zinc-400">—</span>
                      ) : (
                        <select
                          value={user.outlet_id || ''}
                          onChange={(e) =>
                            handleOutletChange(
                              user.id,
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          disabled={updateUser.isPending}
                          className="px-2 py-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">None</option>
                          {outlets?.map((outlet) => (
                            <option key={outlet.id} value={outlet.id}>
                              {outlet.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
      />
    </div>
  );
}
