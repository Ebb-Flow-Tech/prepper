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
 * The roster is brand-first because the brand is the unit people think in, and because the numbers
 * demand it: 10 brands × ~19 Owners/Admins is ~190 rows, which is unreadable flat and fine collapsed.
 *
 * Two rules this component exists to honour:
 *
 *  - **A derived row has no controls.** `source === 'derived'` means the ladder grants the role and
 *    there is no `unit_app_membership` row — nothing to change, nothing to remove. Its
 *    `assignment_id` is `null`, which is also why rows are keyed on `(platform_user_id, unit_id)`.
 *  - **An assigned row always has them, whatever the org role.** An Owner carrying an explicit
 *    `Staff` row is a real demotion on a real row. Suppressing its controls because "Owners are
 *    Managers" would leave a live assignment uneditable forever.
 *
 * `role` is Passport's derived answer, already resolved server-side. This component never infers a
 * role from `org_role` — doing so would re-implement the ladder in a second language and let the
 * table disagree with the permission check.
 */

const ROLE_OPTIONS: { value: BrandRole; label: string }[] = [
  { value: 'Manager', label: 'Manager' },
  { value: 'Staff', label: 'Staff' },
];

interface BrandAccessTableProps {
  brands: PassportBrand[];
  roster: PassportBrandRole[];
  pending: boolean;
  onSetRole: (assignmentId: string, role: BrandRole) => void;
  onRemove: (assignmentId: string) => void;
}

export function BrandAccessTable({
  brands,
  roster,
  pending,
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
                people.map((person) => (
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
                      {person.source === 'derived' || person.assignment_id === null ? (
                        <span className="text-muted-foreground">
                          {person.role}
                          <span className="ml-1 text-xs">· auto</span>
                        </span>
                      ) : (
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
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {person.source === 'assigned' && person.assignment_id !== null && (
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
                ))}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
