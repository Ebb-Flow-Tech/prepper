'use client';

import { useCallback, useState } from 'react';
import { useInviteMember } from '@/lib/hooks/usePassportRoles';
import { Button, Input, Modal, Select } from '@/components/ui';
import { toast } from 'sonner';
import type { InviteMemberRequest } from '@/types';

/**
 * Invite someone into the organisation — in PASSPORT, not in Prepper.
 *
 * This replaced a modal that created a local `users` row with a password. That row was invisible the
 * moment it was created: the roster is Passport's membership, and a locally-made account has none,
 * so "Add User" added someone nobody could see. Passport owns identity; Prepper projects it.
 *
 * Three things worth knowing before changing this:
 *
 *  - **The role here is the ORG vocabulary** — `Owner` | `Admin` | `Member`. NOT `Manager`/`Staff`,
 *    which are BRAND roles and live in Brand Access. The two lists look interchangeable and are not.
 *  - **Nobody appears instantly.** Prepper never writes the membership row; Passport returns the
 *    aggregate and echoes a `membership.*` event that sync applies. Inserting the row locally to
 *    make this feel fast would make Prepper the source of truth for a row it does not own — and
 *    would make nightly reconciliation report phantom drift. Hence the wording below.
 *  - **Invite first, assign second.** Passport `409`s a brand-role assignment for someone holding no
 *    active org membership, so a brand role cannot bootstrap a member. That is why this lives here
 *    and brand roles live in their own tab.
 *
 * No password field: Passport owns credentials, and the invitee sets their own on first sign-in.
 */

const ORG_ROLES: { value: InviteMemberRequest['role']; label: string }[] = [
  { value: 'Member', label: 'Member' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Owner', label: 'Owner' },
];

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const invite = useInviteMember();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<InviteMemberRequest['role']>('Member');

  const resetForm = useCallback(() => {
    setEmail('');
    setDisplayName('');
    setRole('Member');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      await invite.mutateAsync({
        email: email.trim(),
        display_name: displayName.trim() || null,
        role,
      });
      toast.success("Invited — they'll appear here once Passport syncs.");
      resetForm();
      onClose();
    } catch (error) {
      // Passport's verdict, verbatim. A 403 is a NORMAL outcome — its authority matrix may refuse
      // to let this actor grant the role they picked.
      toast.error(error instanceof Error ? error.message : 'Failed to invite member');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Email *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="chef@example.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Display name (optional)
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Organisation role
          </label>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as InviteMemberRequest['role'])}
            options={ORG_ROLES}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Owners and Admins govern the organisation and get Manager at every brand automatically.
            Give a Member access to specific brands in Brand Access.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Invitations are sent by Passport, which has the final say on whether you may grant this
          role. New members appear in this list once Passport syncs them back — usually a moment
          later, not instantly.
        </p>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={invite.isPending || !email.trim()}>
            {invite.isPending ? 'Inviting…' : 'Send invite'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
