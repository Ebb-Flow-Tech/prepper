'use client';

import { usePassportBrands, usePassportBrandRoles } from '@/lib/hooks/usePassportRoles';
import { PageHeader } from '@/components/ui';
import { BrandAccessTable } from './BrandAccessTable';
import { RoleLegend } from './RoleLegend';

/**
 * Brand access — READ ONLY. Passport owns these rows and Prepper only shows them.
 *
 * This tab used to assign, change and remove brand roles by writing UP through Passport. Prepper
 * became a read-only consumer on 2026-08-13: the assignment form, the per-row controls and their
 * mutation hooks are all deleted, and roles are managed in Passport's dashboard. What remains is
 * the answer to "who can reach which brand", read from the projection.
 *
 * Two things that look like bugs but are not:
 *
 *  - **A person can hold a different role at each brand.** There is no single "effective role" —
 *    the roster is a map, and collapsing it would be a lie.
 *  - **Owners and Admins appear at every app-carrying brand with no stored row.** That is
 *    Passport's ladder, and the roster shows them as `source: 'derived'`. Reading only stored rows
 *    once showed 3 holders where roughly 190 existed, and the page carried a paragraph apologising
 *    for it. The ladder is a FLOOR FOR GAPS: an explicit row beats it, which is why an Owner can be
 *    `Staff` at one brand and `Manager` at the rest.
 */
export function BrandAccessTab() {
  const { data: brands, isLoading: brandsLoading } = usePassportBrands();
  const { data: roster, isLoading: rosterLoading } = usePassportBrandRoles();

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

      <RoleLegend />

      <BrandAccessTable brands={brands} roster={roster ?? []} />
    </div>
  );
}
