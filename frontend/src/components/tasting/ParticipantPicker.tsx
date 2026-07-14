'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { useUsers } from '@/lib/hooks';
import { User } from '@/types';

interface ParticipantPickerProps {
  selectedUsers: User[];
  onChange: (users: User[]) => void;
  disabled?: boolean;
  creatorId?: string;
}

export function ParticipantPicker({
  selectedUsers,
  onChange,
  disabled = false,
  creatorId,
}: ParticipantPickerProps) {
  const { data: allUsers = [] } = useUsers();
  const [query, setQuery] = useState('');

  const unselectedUsers = allUsers.filter(
    (u) => !selectedUsers.some((s) => s.id === u.id)
  );

  const filtered = query
    ? unselectedUsers.filter(
        (u) =>
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())
      )
    : unselectedUsers;

  const addUser = (user: User) => {
    onChange([...selectedUsers, user]);
  };

  const removeUser = (userId: string) => {
    onChange(selectedUsers.filter((u) => u.id !== userId));
  };

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      <div className="flex flex-wrap gap-1">
        {selectedUsers.map((user) => {
          const isCreator = user.id === creatorId;
          return (
            <Badge
              key={user.id}
              variant="default"
              className="flex items-center gap-1 pr-1"
            >
              {user.username}{isCreator && <span className="opacity-60">(Organiser)</span>}
              {!disabled && !isCreator && (
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      {/* Search input + dropdown */}
      {!disabled && (
        <div className="relative">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            placeholder="Search users by name or email..."
          />
          {query && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-xl shadow-elevation-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No users found
                </p>
              ) : (
                filtered.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      addUser(user);
                      setQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center gap-2"
                  >
                    <span className="font-medium">{user.username}</span>
                    <span className="text-muted-foreground text-xs">{user.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
