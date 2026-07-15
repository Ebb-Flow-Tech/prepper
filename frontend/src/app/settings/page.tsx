'use client';

import { useState } from 'react';
import { UserManagementTab, BrandRolesTab } from '@/components/admin';
import { UserProfileTab } from '@/components/settings/UserProfileTab';
import DesignSystemPage from '@/app/design-system/page';
import { cn } from '@/lib/utils';

type SettingsTab = 'profile' | 'brand-roles' | 'accounts' | 'design';

// No tab is gated by a role flag: Prepper has none. Authority is per-brand and lives in Passport,
// which applies the real matrix on every write.
const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile',     label: 'Profile'     },
  { id: 'brand-roles', label: 'Brand Roles' },
  { id: 'accounts',    label: 'Accounts'    },
  { id: 'design',      label: 'Design'      },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  function renderTabContent() {
    switch (tab) {
      case 'brand-roles':
        return <BrandRolesTab />;
      case 'accounts':
        return <UserManagementTab />;
      case 'design':
        return <DesignSystemPage />;
      case 'profile':
      default:
        return <UserProfileTab />;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-card">
        <nav className="flex gap-1 px-4" aria-label="Settings tabs">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}
