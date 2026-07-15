'use client';

import { User as UserIcon, Store } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useUser, usePassportBrands } from '@/lib/hooks';
import { Skeleton } from '@/components/ui';

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
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">
        {label}
      </p>
      <div className="text-base font-semibold text-foreground pb-3 border-b border-border">
        {children}
      </div>
    </div>
  );
}

/**
 * The account, plus the brands the user actually holds a role at. There is no single "role" to
 * show: the role is per brand, so the brands are the answer.
 */
export function UserProfileTab() {
  const { userId, username, email } = useAppState();

  const { data: user, isLoading: userLoading } = useUser(userId);
  const { data: brands, isLoading: brandsLoading } = usePassportBrands();

  const myBrands = (brands ?? []).filter((brand) => brand.my_role !== null);

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <UserIcon className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Account Information</h1>
          </div>
          {userLoading ? (
            <Skeleton className="h-4 w-32 rounded" />
          ) : user?.updated_at ? (
            <span className="text-sm text-muted-foreground">
              Last updated: {timeAgo(user.updated_at)}
            </span>
          ) : null}
        </div>

        {/* Fields grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8">
          <Field label="Username">
            {userLoading ? <Skeleton className="h-5 w-28 rounded" /> : (username ?? '—')}
          </Field>

          <Field label="Email Address">
            {userLoading ? <Skeleton className="h-5 w-40 rounded" /> : (email ?? '—')}
          </Field>

          <Field label="Phone Number">
            {userLoading ? <Skeleton className="h-5 w-28 rounded" /> : (user?.phone_number ?? '—')}
          </Field>
        </div>

        {/* Brand access — held in Passport, per brand */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-3">
            Your Brands
          </p>

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
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{brand.name}</p>
                    <p className="text-sm text-muted-foreground">{brand.my_role}</p>
                  </div>
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
        </div>
      </div>
    </div>
  );
}
