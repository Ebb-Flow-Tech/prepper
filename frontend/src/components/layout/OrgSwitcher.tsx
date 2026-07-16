'use client';

import { useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useOrganizations } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/**
 * The organisation the user is acting in.
 *
 * Static text with one org, a picker with several — deliberately. A dropdown that cannot drop is
 * a lie about the shape of the product, and most deployments have exactly one org. The org NAME
 * still shows either way: it is the context every recipe, menu and supplier hangs off, and it was
 * invisible before this.
 *
 * Lives in the top bar rather than Settings because switching changes what every page shows, and
 * the control for that cannot be two clicks deep.
 */
export function OrgSwitcher() {
  const { activeOrgId, setActiveOrgId } = useAppState();
  const { data: organizations, isLoading } = useOrganizations();

  // Resolve the selection against the server's list on every change:
  //  - exactly one org -> select it; the user never thinks about org at all
  //  - a stale selection (membership removed) -> fall back rather than send a header that 403s
  // Reconciling here rather than at login means a membership revoked mid-session self-corrects.
  useEffect(() => {
    if (!organizations?.length) return;
    const stillAMember = organizations.some((org) => org.id === activeOrgId);
    if (!stillAMember) {
      setActiveOrgId(organizations[0].id);
    }
  }, [organizations, activeOrgId, setActiveOrgId]);

  if (isLoading || !organizations?.length) return null;

  const active = organizations.find((org) => org.id === activeOrgId) ?? organizations[0];

  if (organizations.length === 1) {
    return (
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
        title={`${active.name} — you are ${active.my_org_role}`}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="max-w-[12rem] truncate font-medium text-foreground">{active.name}</span>
      </div>
    );
  }

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Active organisation</span>
      <Building2 className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground" />
      <select
        value={active.id}
        onChange={(e) => setActiveOrgId(e.target.value)}
        className={cn(
          'appearance-none rounded-md border border-border bg-card py-1.5 pl-8 pr-8',
          'text-sm font-medium text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
    </label>
  );
}
