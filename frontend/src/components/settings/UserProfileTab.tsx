'use client';

import { User as UserIcon, Store } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useUser } from '@/lib/hooks';
import { useOutlet } from '@/lib/hooks';
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
      <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-1">
        {label}
      </p>
      <div className="text-base font-medium text-foreground pb-3 border-b border-border">
        {children}
      </div>
    </div>
  );
}

export function UserProfileTab() {
  const { userId, username, email, userType, isManager, outletId } = useAppState();

  const { data: user, isLoading: userLoading } = useUser(userId);
  const { data: outlet, isLoading: outletLoading } = useOutlet(outletId);
  const { data: parentOutlet } = useOutlet(outlet?.parent_outlet_id ?? null);

  const roleLabel = userType === 'admin' ? 'Administrator' : 'Normal';

  const outletSubline = [parentOutlet?.name, outlet?.code].filter(Boolean).join(' \u2022 ');

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <UserIcon className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground">
              Account information
            </h1>
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

          <Field label="Email address">
            {userLoading ? <Skeleton className="h-5 w-40 rounded" /> : (email ?? '—')}
          </Field>

          <Field label="Role">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
              {roleLabel}
            </span>
          </Field>

          <Field label="Managerial status">
            {`Manager: ${isManager ? 'Yes' : 'No'}`}
          </Field>
        </div>

        {/* Assigned Outlet */}
        <div>
          <p className="text-[13px] font-medium text-[var(--color-text-secondary)] mb-3">
            Assigned outlet
          </p>

          {outletLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : outlet ? (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Store className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{outlet.name}</p>
                {outletSubline && (
                  <p className="text-sm text-muted-foreground">{outletSubline}</p>
                )}
              </div>
              <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Change
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No outlet assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}
