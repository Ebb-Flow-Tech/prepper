'use client';

import { useState } from 'react';
import { useAppState } from '@/lib/store';
import { OutletManagementTab } from '@/components/recipes';
import { UserManagementTab, BrandRolesTab } from '@/components/admin';
import { UserProfileTab } from '@/components/settings/UserProfileTab';
import DesignSystemPage from '@/app/design-system/page';
import { cn } from '@/lib/utils';

type SettingsTab = 'users' | 'outlets' | 'brand-roles' | 'admin' | 'design';

const SETTINGS_TABS: { id: SettingsTab; label: string; adminOnly?: boolean }[] = [
  { id: 'users',       label: 'Users'       },
  { id: 'outlets',     label: 'Outlets'     },
  // Passport's brand roles. Visible to everyone: a brand Manager may assign Staff at their own
  // brand, so this is not admin-only. Passport applies the real authority matrix on the write.
  { id: 'brand-roles', label: 'Brand Roles' },
  { id: 'admin',       label: 'Admin',  adminOnly: true },
  { id: 'design',      label: 'Design'      },
];

export default function SettingsPage() {
  const { userType } = useAppState();
  const [tab, setTab] = useState<SettingsTab>('users');

  const visibleTabs = SETTINGS_TABS.filter((t) => !t.adminOnly || userType === 'admin');

  function renderTabContent() {
    switch (tab) {
      case 'outlets':
        return <OutletManagementTab userType={userType} />;
      case 'brand-roles':
        return <BrandRolesTab />;
      case 'admin':
        if (userType !== 'admin') {
          return (
            <div className="p-6 text-sm text-muted-foreground">
              You do not have permission to view this page.
            </div>
          );
        }
        return <UserManagementTab />;
      case 'design':
        return <DesignSystemPage />;
      case 'users':
      default:
        return <UserProfileTab />;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-card">
        <nav className="flex gap-1 px-4" aria-label="Settings tabs">
          {visibleTabs.map((t) => (
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
