'use client';

import { Building2, Store, User as UserIcon } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useUser, usePassportBrands, useOrganizations } from '@/lib/hooks';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@/components/ui';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="border-b border-border pb-3 text-base font-semibold text-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * Who you are, which organisation you are in, and what you can do.
 *
 * Every field is read-only, and stays so: the account is Prepper's but the org, brands and roles
 * are Passport's. Showing them as editable here would promise something this app cannot deliver.
 *
 * There is no single "role" to display — the role is per brand, so the brands ARE the answer.
 */
export function UserProfileTab() {
  const { userId, username, email } = useAppState();

  const { data: user, isLoading: userLoading } = useUser(userId);
  const { data: brands, isLoading: brandsLoading } = usePassportBrands();
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();

  const myBrands = (brands ?? []).filter((brand) => brand.my_role !== null);

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account, organisation and brand access.">
        {userLoading ? (
          <Skeleton className="h-4 w-32 rounded" />
        ) : user?.updated_at ? (
          <span className="text-sm text-muted-foreground">
            Last updated: {timeAgo(user.updated_at)}
          </span>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
          <Field label="Username">
            {userLoading ? <Skeleton className="h-5 w-28 rounded" /> : (username ?? '—')}
          </Field>
          <Field label="Email Address">
            {userLoading ? <Skeleton className="h-5 w-40 rounded" /> : (email ?? '—')}
          </Field>
          <Field label="Phone Number">
            {userLoading ? <Skeleton className="h-5 w-28 rounded" /> : (user?.phone_number ?? '—')}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Organisation
          </CardTitle>
          <CardDescription>
            {(organizations?.length ?? 0) > 1
              ? 'You belong to more than one organisation. Switch between them from the top bar.'
              : 'The organisation your recipes, menus and suppliers belong to.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : organizations && organizations.length > 0 ? (
            <div className="flex flex-col gap-2">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{org.name}</p>
                    <p className="text-sm text-muted-foreground">{org.slug}</p>
                  </div>
                  <Badge variant="secondary">{org.my_org_role}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You do not belong to an organisation yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />
            Your brands
          </CardTitle>
          <CardDescription>
            An organisation Owner or Admin manages every brand automatically — those do not appear
            as a role here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brandsLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : myBrands.length > 0 ? (
            <div className="flex flex-col gap-2">
              {myBrands.map((brand) => (
                <div
                  key={brand.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{brand.name}</p>
                  </div>
                  <Badge variant="unit">{brand.my_role}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You do not hold a role at any brand yet.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Brands, outlets and roles are managed in Passport.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
