'use client';

import { useAppState } from '@/lib/store';
import { OutletManagementTab } from '@/components/recipes';

export default function OutletsPage() {
  const { userType } = useAppState();

  return <OutletManagementTab userType={userType} />;
}
