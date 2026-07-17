'use client';

import { useState, useMemo } from 'react';
import {
  Badge,
  Button,
  PageHeader,
  SearchInput,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useMemberAccounts, useUpdateUser } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { InviteMemberModal } from './InviteMemberModal';
import { toast } from 'sonner';

/**
 * The organisation's people — from PASSPORT's membership, not Prepper's `users` table.
 *
 * This listed local `users` rows, scoped through the identity link, and an identity link only
 * exists once someone has signed in via Passport SSO. On staging that was 1 of 20 active members:
 * the tab showed the person looking at it and nobody else. The scoping was never wrong — it is the
 * wrong QUESTION. The roster of people in an org is Passport's membership, which embeds email, name
 * and org role for everyone, signed in or not.
 *
 * So a row here may have NO local account (`user_id === null`) — that is the normal state for
 * someone invited but not yet signed in, not an error.
 *
 * Roles are not set here. Org roles come from Passport; brand access lives in the Brand Access tab.
 */
export function UserManagementTab() {
  const [search, setSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState('');

  const { userId } = useAppState();
  const updateUser = useUpdateUser();
  const { data: members, isLoading, error } = useMemberAccounts();

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!search) return members;
    const needle = search.toLowerCase();
    // Search the Passport-owned identity, not `username`: a member who has never signed in has no
    // local row and therefore no username at all.
    return members.filter((m) =>
      `${m.display_name ?? ''} ${m.email}`.toLowerCase().includes(needle)
    );
  }, [members, search]);

  const handlePhoneChange = (targetUserId: string, phoneNumber: string) => {
    updateUser.mutate(
      { userId: targetUserId, data: { phone_number: phoneNumber || null } },
      {
        onSuccess: () => toast.success('Phone number updated'),
        onError: () => toast.error('Failed to update phone number'),
      }
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-950 dark:text-red-400">
          Failed to load members. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Everyone in your organisation, from Passport. Brand access is assigned per brand in the Brand Access tab — Passport owns roles, Prepper cannot set them here."
      />

      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="max-w-md flex-1">
          <SearchInput
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>Invite member</Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Org role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredMembers.length && (
              <TableRow>
                <TableEmpty colSpan={4}>
                  {search ? 'No members match your search' : 'No members found'}
                </TableEmpty>
              </TableRow>
            )}

            {filteredMembers.map((member) => {
              // PATCH /users/{user_id} refuses to edit anyone but the caller, and that is not being
              // widened: 18 of this org's 20 members hold `Admin`, so "admins may edit" would mean
              // everyone may rewrite everyone's contact details while reading like a restriction.
              // A member with no local row has nothing to write to at all.
              const isSelf = member.user_id !== null && member.user_id === userId;
              const isEditing = editingPhoneId === member.platform_user_id;

              return (
                <TableRow key={member.platform_user_id}>
                  <TableCell className="text-foreground">
                    {member.display_name || member.email}
                    {member.display_name && (
                      <span className="ml-2 text-xs text-muted-foreground">{member.email}</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary">{member.org_role}</Badge>
                  </TableCell>

                  <TableCell>
                    {member.user_id === null ? (
                      <Badge variant="secondary">Not signed in</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm">
                    {isEditing && member.user_id ? (
                      <input
                        type="tel"
                        value={editingPhoneValue}
                        onChange={(e) => setEditingPhoneValue(e.target.value)}
                        onBlur={() => {
                          handlePhoneChange(member.user_id as string, editingPhoneValue);
                          setEditingPhoneId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePhoneChange(member.user_id as string, editingPhoneValue);
                            setEditingPhoneId(null);
                          } else if (e.key === 'Escape') {
                            setEditingPhoneId(null);
                          }
                        }}
                        autoFocus
                        disabled={updateUser.isPending}
                        placeholder="Add phone..."
                        className="w-full rounded border border-blue-500 bg-card px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    ) : isSelf ? (
                      <div
                        onClick={() => {
                          setEditingPhoneId(member.platform_user_id);
                          setEditingPhoneValue(member.phone_number || '');
                        }}
                        className="cursor-pointer rounded px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        {member.phone_number || '—'}
                      </div>
                    ) : (
                      <span className="px-2 py-1 text-muted-foreground">
                        {member.phone_number || '—'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
