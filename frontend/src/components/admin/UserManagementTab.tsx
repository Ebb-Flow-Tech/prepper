'use client';

import { useState, useMemo } from 'react';
import { SearchInput, Skeleton, PageHeader, Button } from '@/components/ui';
import { useUsers, useUpdateUser } from '@/lib/hooks';
import { AddUserModal } from './AddUserModal';
import { toast } from 'sonner';

export function UserManagementTab() {
  const [search, setSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');
  const updateUser = useUpdateUser();
  const { data: users, isLoading, error } = useUsers();

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

  const handlePhoneChange = (userId: string, phoneNumber: string) => {
    updateUser.mutate(
      { userId, data: { phone_number: phoneNumber || null } },
      {
        onSuccess: () => {
          toast.success('User phone number updated');
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
    <div>
      <div>
        <PageHeader
          title="Accounts"
          description="Login accounts and contact details. Roles are assigned per brand in the Brand Roles tab — Passport owns them, Prepper cannot set them here."
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
            <p className="text-muted-foreground">
              {search ? 'No users match your search' : 'No users found'}
            </p>
          </div>
        )}

        {/* Users Table */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-6 py-3 text-left text-sm font-medium text-foreground">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-foreground">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-foreground">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border hover:bg-secondary"
                  >
                    <td className="px-6 py-3 text-sm text-foreground">
                      {user.username}
                    </td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {editingPhoneId === user.id ? (
                        <input
                          type="tel"
                          value={editingPhoneValue}
                          onChange={(e) => setEditingPhoneValue(e.target.value)}
                          onBlur={() => {
                            handlePhoneChange(user.id, editingPhoneValue);
                            setEditingPhoneId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handlePhoneChange(user.id, editingPhoneValue);
                              setEditingPhoneId(null);
                            } else if (e.key === 'Escape') {
                              setEditingPhoneId(null);
                            }
                          }}
                          autoFocus
                          disabled={updateUser.isPending}
                          placeholder="Add phone..."
                          className="px-2 py-1 text-sm w-full border border-blue-500 rounded bg-card text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div
                          onClick={() => {
                            setEditingPhoneId(user.id);
                            setEditingPhoneValue(user.phone_number || '');
                          }}
                          className="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-1 rounded"
                        >
                          {user.phone_number || '—'}
                        </div>
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
