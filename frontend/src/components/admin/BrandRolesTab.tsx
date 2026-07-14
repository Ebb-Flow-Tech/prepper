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
 *    the ladder. An empty roster does not mean nobody has access.
 */

const ROLES: BrandRole[] = ['Manager', 'Staff'];

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
  const error =
    assign.error ?? setRole.error ?? remove.error ?? null;

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
    return <div className="p-6 text-sm text-muted-foreground">Loading brand roles…</div>;
  }

  if (!brands?.length) {
    return (
      <div className="p-6 space-y-2">
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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-foreground">Brand roles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Managed in Passport. A person may hold a different role at each brand — there is no single
          role. Organisation Owners and Admins hold <span className="font-medium">Manager</span> at
          every brand automatically and will not appear below.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage(error)}
        </div>
      )}

      {/* --- assign ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Brand</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Select a brand…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Person</span>
          <select
            value={platformUserId}
            onChange={(e) => setPlatformUserId(e.target.value)}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Select a person…</option>
            {assignable.map((m) => (
              <option key={m.platform_user_id} value={m.platform_user_id}>
                {m.display_name || m.email}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <select
            value={role}
            onChange={(e) => setRole_(e.target.value as BrandRole)}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={handleAssign}
          disabled={pending || !platformUserId || !unitId}
          className="rounded bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {assign.isPending ? 'Assigning…' : 'Assign'}
        </button>
      </div>

      {/* --- roster ------------------------------------------------------------------ */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-secondary">
            <tr className="border-b border-border text-left">
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Person
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Brand
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Org role
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Brand role
              </th>
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody>
            {!roster?.length && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-sm text-muted-foreground">
                  No brand roles assigned. Owners and Admins still hold Manager everywhere.
                </td>
              </tr>
            )}
            {roster?.map((r) => (
              <tr key={r.assignment_id} className="border-b border-border hover:bg-secondary">
                <td className="px-6 py-3 text-sm text-foreground">
                  {r.display_name || r.email}
                  {r.display_name && (
                    <span className="ml-2 text-xs text-muted-foreground">{r.email}</span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-muted-foreground">{r.unit_name}</td>
                <td className="px-6 py-3 text-sm text-muted-foreground">{r.org_role}</td>
                <td className="px-6 py-3 text-sm">
                  <select
                    value={r.role}
                    disabled={pending}
                    onChange={(e) =>
                      setRole.mutate({
                        assignmentId: r.assignment_id,
                        role: e.target.value as BrandRole,
                      })
                    }
                    className="rounded border border-border bg-card px-2 py-1 text-sm text-foreground disabled:opacity-50"
                  >
                    {ROLES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-3 text-right text-sm">
                  <button
                    onClick={() => remove.mutate(r.assignment_id)}
                    disabled={pending}
                    className="text-sm text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
