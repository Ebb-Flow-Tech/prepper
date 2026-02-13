'use client';

import { useAppState } from '@/lib/store';
import { UserManagementTab } from '@/components/admin';

export default function AdminUsersPage() {
  const { userType } = useAppState();

  // AuthGuard handles the redirect for non-admins
  // This page only renders if user is admin
  if (userType !== 'admin') {
    return null;
  }

  return <UserManagementTab />;
}
