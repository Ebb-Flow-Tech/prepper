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
import { useOrganizations } from '@/lib/hooks';
import { useAppState } from '@/lib/store';
import { Button, PageHeader, Select } from '@/components/ui';
import { BrandAccessTable } from './BrandAccessTable';
import { RoleLegend } from './RoleLegend';
import type { BrandRole } from '@/types';

/**
 * Brand access, managed in Passport.
 *
 * Passport is the source of truth for who can reach which brand. Prepper reads the roster from its
 * projection and writes changes UP through Passport — it never edits these rows locally.
 *
 * Two things that look like bugs but are not:
 *
 *  - A `403` is a NORMAL outcome. Passport applies its own authority matrix after Prepper's: a
 *    brand `Manager` may assign `Staff` but never a peer, and may not change an existing role at
 *    all. Only an org `Owner`/`Admin` can do everything. The message is surfaced verbatim.
 *  - A change does not appear instantly. The write lands in Passport and comes back through sync;
 *    re-reading the projection is the honest thing to do, because applying it locally would make
 *    Prepper the source of truth for a row it does not own.
 *
 * The ladder used to be the third item on that list — Owners and Admins hold `Manager` everywhere
 * with no row, so this table could read empty while everyone had access, and a paragraph on screen
 * had to apologise for it. Derived holders are rows now (`source: 'derived'`), so the page shows
 * what is true instead of explaining why it doesn't. Note the ladder is a FLOOR FOR GAPS: an
 * explicit row beats it, which is why an Owner can be Staff at one brand and Manager at the rest.
 */

const MANAGER_OPTION = { value: 'Manager' as BrandRole, label: 'Manager' };
const STAFF_OPTION = { value: 'Staff' as BrandRole, label: 'Staff' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function BrandAccessTab() {
  const { data: brands, isLoading: brandsLoading } = usePassportBrands();
  const { data: roster, isLoading: rosterLoading } = usePassportBrandRoles();
  const { data: members } = usePassportMembers();
  const { data: organizations } = useOrganizations();
  const { activeOrgId } = useAppState();

  // Passport's authority matrix, mirrored so the UI stops offering what it will refuse:
  //
  //   actor             | assign      | change a role | remove
  //   org Owner/Admin   | either role | yes           | yes
  //   brand Manager     | Staff only  | NO            | Staff only
  //   brand Staff/none  | no          | no            | no
  //
  // This is presentation, NOT enforcement. Passport re-checks every write against the verified end
  // user and is the real gate; hiding a control only stops us asking for a refusal we can predict.
  // Read the role for the ACTING org — `my_org_role` is per-org, and an Owner of org B is not an
  // admin of org A.
  const isOrgAdmin = useMemo(() => {
    if (!organizations?.length) return false;
    const acting = activeOrgId
      ? organizations.find((o) => o.id === activeOrgId)
      : organizations.length === 1
        ? organizations[0]
        : undefined;
    return acting?.my_org_role === 'Owner' || acting?.my_org_role === 'Admin';
  }, [organizations, activeOrgId]);

  // A Manager may assign `Staff` and nothing else.
  const roleOptions = isOrgAdmin ? [MANAGER_OPTION, STAFF_OPTION] : [STAFF_OPTION];

  // Brands you may assign AT: anywhere for an org admin, your own brands if you manage them. A
  // Staff can reach a brand (so it is in `brands`) without being able to give anyone a role there.
  const assignableBrands = useMemo(
    () => (brands ?? []).filter((b) => isOrgAdmin || b.my_role === 'Manager'),
    [brands, isOrgAdmin]
  );

  const assign = useAssignBrandRole();
  const setRole = useSetBrandRole();
  const remove = useRemoveBrandRole();

  const [platformUserId, setPlatformUserId] = useState('');
  const [unitId, setUnitId] = useState('');
  // Defaults to `Staff` — the only role a Manager may grant, and the safer of the two for an admin.
  const [role, setRole_] = useState<BrandRole>('Staff');

  const pending = assign.isPending || setRole.isPending || remove.isPending;
  const error = assign.error ?? setRole.error ?? remove.error ?? null;

  // People who already hold an EXPLICIT role at the selected brand cannot be assigned there again —
  // Passport would reject it, and offering it invites a pointless 409.
  //
  // `source === 'assigned'` only. Derived holders must stay selectable: an Owner appears in the
  // roster at every app-carrying brand, so filtering on the whole roster would drop every Owner and
  // Admin from this list at every brand, permanently. And giving one of them `Staff` is a real,
  // observable act — the explicit row beats the ladder and demotes them at that brand.
  const assignable = useMemo(() => {
    if (!members) return [];
    if (!unitId) return members;
    const taken = new Set(
      (roster ?? [])
        .filter((r) => r.unit_id === unitId && r.source === 'assigned')
        .map((r) => r.platform_user_id)
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
    return <p className="text-sm text-muted-foreground">Loading brand access…</p>;
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
        title="Brand access"
        description="Who can reach each brand. Managed in Passport — a person may hold a different role at each brand."
      />

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage(error)}
        </div>
      )}

      {/* --- assign ---------------------------------------------------------------------
          Hidden entirely for someone who manages no brand: Passport would refuse every write, so
          offering the form would only manufacture a 403. */}
      {assignableBrands.length > 0 && (
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Brand</span>
          <Select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            options={[
              { value: '', label: 'Select a brand…' },
              ...assignableBrands.map((b) => ({ value: b.id, label: b.name })),
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
            options={roleOptions}
          />
        </label>

        <Button onClick={handleAssign} disabled={pending || !platformUserId || !unitId}>
          {assign.isPending ? 'Assigning…' : 'Assign'}
        </Button>

        {!isOrgAdmin && (
          <p className="w-full text-xs text-muted-foreground">
            As a brand Manager you can give someone <span className="font-medium">Staff</span> at a
            brand you manage. Changing an existing role is an organisation Owner or Admin.
          </p>
        )}
      </div>
      )}

      <RoleLegend />

      <BrandAccessTable
        brands={brands}
        roster={roster ?? []}
        pending={pending}
        isOrgAdmin={isOrgAdmin}
        onAssign={(platformUserIdToAssign, brandId, nextRole) =>
          assign.mutate({
            platform_user_id: platformUserIdToAssign,
            unit_id: brandId,
            role: nextRole,
          })
        }
        onSetRole={(assignmentId, nextRole) => setRole.mutate({ assignmentId, role: nextRole })}
        onRemove={(assignmentId) => remove.mutate(assignmentId)}
      />
    </div>
  );
}
