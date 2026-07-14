'use client';

import { useState, useMemo } from 'react';
import { SearchInput, Skeleton, PageHeader, Button, Badge } from '@/components/ui';
import { useUsers, useUpdateUser, useOutlets } from '@/lib/hooks';
import { AddUserModal } from './AddUserModal';
import { toast } from 'sonner';

export function UserManagementTab() {
  const [search, setSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');
  const updateUser = useUpdateUser();
  const { data: users, isLoading, error } = useUsers();
  const { data: outletsData } = useOutlets({ page_size: 30 });
  const outlets = outletsData?.items;

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
        <div className="rounded-xl bg-[var(--color-feedback-error-tint)] p-4 text-[var(--color-feedback-error)]">
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
            Add user
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
          <div className="overflow-x-auto border border-border rounded-xl">
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
                  <th className="px-6 py-3 text-left text-sm font-medium text-foreground">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-foreground">
                    Manager
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-foreground">
                    Branch
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
                          className="px-2 py-1 text-sm w-full border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
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
                    <td className="px-6 py-3 text-sm">
                      <Badge>{user.user_type === 'admin' ? 'Admin' : 'Normal'}</Badge>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {user.user_type === 'admin' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <button
                          onClick={() => handleManagerToggle(user.id, user.is_manager)}
                          disabled={updateUser.isPending}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.is_manager
                              ? 'border-[var(--border-strong)] bg-[var(--surface-selected)] text-foreground hover:bg-muted'
                              : 'border-transparent bg-secondary text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {user.is_manager ? 'Manager' : 'Not manager'}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {user.user_type === 'admin' ? (
                        <span className="text-muted-foreground">—</span>
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
                          className="px-2 py-1 text-sm border border-input rounded-lg bg-card text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
