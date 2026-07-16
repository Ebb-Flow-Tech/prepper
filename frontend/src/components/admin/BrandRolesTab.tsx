'use client';

import { useMemo, useState } from 'react';
import {
  usePassportBrands,
  usePassportBrandRoles,
  usePassportMembers,
  useAssignBrandRole,
  useSetBrandRole,
  useRemoveBrandRole,
} from '@/lib/hooks/usePassportRoles';
import {
  Badge,
  Button,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import type { BrandRole } from '@/types';

/**
 * Brand-app roles, managed in Passport.
 *
 * Passport is the source of truth for who holds which role at which brand. Prepper reads the roster
 * from its projection and writes changes UP through Passport — it never edits these rows locally.
 *
 * Two things that look like bugs but are not:
 *
 *  - A `403` is a NORMAL outcome. Passport applies its own authority matrix after Prepper's: a
 *    brand `Manager` may assign `Staff` but never a peer, and may not change an existing role at
 *    all. Only an org `Owner`/`Admin` can do everything. The message is surfaced verbatim.
 *  - Org `Owner`s and `Admin`s hold `Manager` at every brand with NO row in this table — that is
 *    the ladder. An empty roster does not mean nobody has access. This is stated on screen too,
 *    not just here: it is the single most misleading thing about this page, and a reader of the
 *    source is not the person who needs to know.
 */

const ROLES: BrandRole[] = ['Manager', 'Staff'];
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r }));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function BrandRolesTab() {
  const { data: brands, isLoading: brandsLoading } = usePassportBrands();
  const { data: roster, isLoading: rosterLoading } = usePassportBrandRoles();
  const { data: members } = usePassportMembers();

  const assign = useAssignBrandRole();
  const setRole = useSetBrandRole();
  const remove = useRemoveBrandRole();

  const [platformUserId, setPlatformUserId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [role, setRole_] = useState<BrandRole>('Staff');

  const pending = assign.isPending || setRole.isPending || remove.isPending;
  const error = assign.error ?? setRole.error ?? remove.error ?? null;

  // People already holding a role at the selected brand cannot be assigned there again — Passport
  // would reject it, and offering it invites a pointless 409/duplicate.
  const assignable = useMemo(() => {
    if (!members) return [];
    if (!unitId) return members;
    const taken = new Set(
      (roster ?? []).filter((r) => r.unit_id === unitId).map((r) => r.platform_user_id)
    );
    return members.filter((m) => !taken.has(m.platform_user_id));
  }, [members, roster, unitId]);

  function handleAssign() {
    if (!platformUserId || !unitId) return;
    assign.mutate(
      { platform_user_id: platformUserId, unit_id: unitId, role },
      { onSuccess: () => setPlatformUserId('') }
    );
  }

  if (brandsLoading || rosterLoading) {
    return <p className="text-sm text-muted-foreground">Loading brand roles…</p>;
  }

  // Not an error state: Passport returning nothing here is a normal outcome for someone who is not
  // yet a member of an entitled org, or who has never signed in so has no identity link.
  if (!brands?.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">No brands available.</p>
        <p className="text-sm text-muted-foreground">
          Brands come from Passport. You will see them here once you are an active member of an
          organisation whose brands carry Prepper — and once you have signed in at least once, so
          Passport can link your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand roles"
        description="Managed in Passport. A person may hold a different role at each brand — there is no single role."
      />

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage(error)}
        </div>
      )}

      {/* --- assign ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Brand</span>
          <Select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            options={[
              { value: '', label: 'Select a brand…' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Person</span>
          <Select
            value={platformUserId}
            onChange={(e) => setPlatformUserId(e.target.value)}
            options={[
              { value: '', label: 'Select a person…' },
              ...assignable.map((m) => ({
                value: m.platform_user_id,
                label: m.display_name || m.email,
              })),
            ]}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <Select
            value={role}
            onChange={(e) => setRole_(e.target.value as BrandRole)}
            options={ROLE_OPTIONS}
          />
        </label>

        <Button onClick={handleAssign} disabled={pending || !platformUserId || !unitId}>
          {assign.isPending ? 'Assigning…' : 'Assign'}
        </Button>
      </div>

      {/* The ladder, said out loud. Owners and Admins hold Manager at every brand with no row
          below, so this table can look empty while everyone still has access. */}
      <p className="text-sm text-muted-foreground">
        Organisation <span className="font-medium text-foreground">Owners</span> and{' '}
        <span className="font-medium text-foreground">Admins</span> hold{' '}
        <span className="font-medium text-foreground">Manager</span> at every brand automatically
        and do not appear below. An empty list does not mean nobody has access.
      </p>

      {/* --- roster ------------------------------------------------------------------ */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Org role</TableHead>
            <TableHead>Brand role</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!roster?.length && (
            <TableRow>
              <TableEmpty colSpan={5}>
                No brand roles assigned. Owners and Admins still hold Manager everywhere.
              </TableEmpty>
            </TableRow>
          )}
          {roster?.map((r) => (
            <TableRow key={r.assignment_id}>
              <TableCell className="text-foreground">
                {r.display_name || r.email}
                {r.display_name && (
                  <span className="ml-2 text-xs text-muted-foreground">{r.email}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.unit_name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{r.org_role}</Badge>
              </TableCell>
              <TableCell>
                <Select
                  aria-label={`Brand role for ${r.display_name || r.email} at ${r.unit_name}`}
                  value={r.role}
                  disabled={pending}
                  onChange={(e) =>
                    setRole.mutate({
                      assignmentId: r.assignment_id,
                      role: e.target.value as BrandRole,
                    })
                  }
                  className="h-8 w-auto py-1"
                  options={ROLE_OPTIONS}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(r.assignment_id)}
                  disabled={pending}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
