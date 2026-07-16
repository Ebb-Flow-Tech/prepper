'use client';

import { useState } from 'react';
import { UserManagementTab, BrandRolesTab } from '@/components/admin';
import { UserProfileTab } from '@/components/settings/UserProfileTab';
import DesignSystemPage from '@/app/design-system/page';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';

type SettingsTab = 'profile' | 'brand-roles' | 'accounts' | 'design';

// No tab is gated by a role flag: Prepper has none. Authority is per-brand and lives in Passport,
// which applies the real matrix on every write.
const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'brand-roles', label: 'Brand Roles' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'design', label: 'Design' },
];

// The page owns the scroll container and the width; tabs render content only.
//
// They each used to decide for themselves, and disagreed: Profile and Accounts set their own
// `h-full w-full overflow-auto` with different max-widths (`max-w-2xl` vs `max-w-7xl`), while
// BrandRoles set neither — so it sat un-scrollable inside this flex and a long roster was
// unreachable. One owner, one answer.
//
// `max-w-5xl` is the compromise: Profile's `max-w-2xl` is too narrow for the roster's five
// columns, and Accounts' `max-w-7xl` strands Profile's field pairs across a wide screen.
const CONTENT_WIDTH = 'mx-auto w-full max-w-5xl p-6';

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as SettingsTab)}
      className="h-full"
    >
      <header className="shrink-0 border-b border-border bg-card">
        <TabsList label="Settings tabs">
          {SETTINGS_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </header>

      <div className="flex-1 overflow-auto">
        <TabsContent value="profile" className={CONTENT_WIDTH}>
          <UserProfileTab />
        </TabsContent>
        <TabsContent value="brand-roles" className={CONTENT_WIDTH}>
          <BrandRolesTab />
        </TabsContent>
        <TabsContent value="accounts" className={CONTENT_WIDTH}>
          <UserManagementTab />
        </TabsContent>
        {/* The design system is a full page of its own and sets its own width. */}
        <TabsContent value="design">
          <DesignSystemPage />
        </TabsContent>
      </div>
    </Tabs>
  );
}
