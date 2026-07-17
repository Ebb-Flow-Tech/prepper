'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import type { BrandRole, PassportBrand, PassportBrandRole } from '@/types';

/**
 * Brands, each expanding to everyone who can reach it.
 *
 * Brand-first because the brand is the unit people think in, and because the numbers demand it: 10
 * brands × ~19 Owners/Admins is ~190 rows, unreadable flat and fine collapsed.
 *
 * **Changing a role and removing one are different questions.** An earlier version answered both
 * with `source === 'derived'` and rendered derived rows as dead text — which, on real data where
 * 187 of 190 rows are derived, made the page ~98% inert with no hint that the assign bar above was
 * the way through. A derived holder has no row to REMOVE, true; but they can absolutely have their
 * role CHANGED — by assigning an explicit one, which overrides the ladder. So:
 *
 *  - derived + may change → a `Select` that ASSIGNS (creating the override), not `set` (which needs
 *    an `assignment_id` that does not exist). It keeps the `· auto` marker until a row exists.
 *  - assigned → `Select` that sets, and `Remove` — **including for an Owner/Admin**, whose explicit
 *    row is real and beats the ladder. Removing it reverts them to `auto`.
 *
 * Who may do what is Passport's authority matrix, mirrored via `isOrgAdmin` and the brand's own
 * `my_role`. Presentation only — Passport re-checks every write and is the real gate.
 *
 * `role` is Passport's derived answer, resolved server-side. This component never infers a role
 * from `org_role`: that would re-implement the ladder in a second language and let the table
 * disagree with the permission check.
 */

const ROLE_OPTIONS: { value: BrandRole; label: string }[] = [
  { value: 'Manager', label: 'Manager' },
  { value: 'Staff', label: 'Staff' },
];

interface BrandAccessTableProps {
  brands: PassportBrand[];
  roster: PassportBrandRole[];
  pending: boolean;
  /** Owner/Admin of the ACTING org: may change any role and remove anyone. */
  isOrgAdmin: boolean;
  onAssign: (platformUserId: string, unitId: string, role: BrandRole) => void;
  onSetRole: (assignmentId: string, role: BrandRole) => void;
  onRemove: (assignmentId: string) => void;
}

export function BrandAccessTable({
  brands,
  roster,
  pending,
  isOrgAdmin,
  onAssign,
  onSetRole,
  onRemove,
}: BrandAccessTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const peopleByBrand = useMemo(() => {
    const map = new Map<string, PassportBrandRole[]>();
    for (const row of roster) {
      const rows = map.get(row.unit_id);
      if (rows) rows.push(row);
      else map.set(row.unit_id, [row]);
    }
    // Assigned rows first, then alphabetical — the people someone can act on are the reason they
    // opened the brand.
    for (const rows of map.values()) {
      rows.sort((a, b) => {
        if (a.source !== b.source) return a.source === 'assigned' ? -1 : 1;
        return (a.display_name || a.email).localeCompare(b.display_name || b.email);
      });
    }
    return map;
  }, [roster]);

  function toggle(brandId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Brand</TableHead>
          <TableHead>People</TableHead>
          <TableHead>Your role</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!brands.length && (
          <TableRow>
            <TableEmpty colSpan={4}>No brands carry Prepper in this organisation.</TableEmpty>
          </TableRow>
        )}

        {brands.map((brand) => {
          const people = peopleByBrand.get(brand.id) ?? [];
          const isOpen = expanded.has(brand.id);
          const panelId = `brand-people-${brand.id}`;

          return (
            <Fragment key={brand.id}>
              <TableRow>
                <TableCell className="text-foreground">
                  <button
                    type="button"
                    onClick={() => toggle(brand.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex items-center gap-2 font-medium hover:text-foreground"
                  >
                    <span aria-hidden="true" className="text-muted-foreground">
                      {isOpen ? '▾' : '▸'}
                    </span>
                    {brand.name}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">{people.length}</TableCell>
                <TableCell>
                  {brand.my_role ? (
                    <Badge variant="secondary">{brand.my_role}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell />
              </TableRow>

              {isOpen && !people.length && (
                <TableRow id={panelId}>
                  <TableCell colSpan={4} className="pl-10 text-muted-foreground">
                    Nobody can reach this brand.
                  </TableCell>
                </TableRow>
              )}

              {isOpen &&
                people.map((person) => {
                  const isDerived = person.source === 'derived' || person.assignment_id === null;
                  const iManageThisBrand = brand.my_role === 'Manager';

                  // Only an org Owner/Admin may CHANGE an existing role — a brand Manager gets a
                  // 403 from Passport, so do not offer it.
                  const mayChange = isOrgAdmin;
                  // A Manager may remove `Staff` at a brand they manage, never a peer Manager.
                  const mayRemove =
                    !isDerived &&
                    (isOrgAdmin || (iManageThisBrand && person.role === 'Staff'));
                  // Overriding the ladder means CREATING a role — assignment, not a change. A
                  // Manager may do that, but only as `Staff`, so for them a derived Manager is not
                  // something they can touch.
                  const mayOverride = isDerived && isOrgAdmin;

                  return (
                    <TableRow key={`${person.platform_user_id}:${person.unit_id}`} id={panelId}>
                      <TableCell className="pl-10 text-foreground">
                        {person.display_name || person.email}
                        {person.display_name && (
                          <span className="ml-2 text-xs text-muted-foreground">{person.email}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{person.org_role}</Badge>
                      </TableCell>
                      <TableCell>
                        {isDerived ? (
                          <div className="flex items-center gap-1">
                            {mayOverride ? (
                              <Select
                                aria-label={`Brand role for ${person.display_name || person.email} at ${brand.name} — currently automatic`}
                                value={person.role}
                                disabled={pending}
                                onChange={(e) =>
                                  onAssign(
                                    person.platform_user_id,
                                    person.unit_id,
                                    e.target.value as BrandRole
                                  )
                                }
                                className="h-8 w-auto py-1"
                                options={ROLE_OPTIONS}
                              />
                            ) : (
                              <span className="text-muted-foreground">{person.role}</span>
                            )}
                            <span
                              className="text-xs text-muted-foreground"
                              title="Automatic: they are an organisation Owner or Admin, so they hold this role at every brand without being given one."
                            >
                              · auto
                            </span>
                          </div>
                        ) : mayChange ? (
                          <Select
                            aria-label={`Brand role for ${person.display_name || person.email} at ${brand.name}`}
                            value={person.role}
                            disabled={pending}
                            onChange={(e) =>
                              onSetRole(person.assignment_id as string, e.target.value as BrandRole)
                            }
                            className="h-8 w-auto py-1"
                            options={ROLE_OPTIONS}
                          />
                        ) : (
                          <span className="text-muted-foreground">{person.role}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {mayRemove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemove(person.assignment_id as string)}
                            disabled={pending}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
