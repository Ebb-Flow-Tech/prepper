'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { userId } = useAppState();

  useEffect(() => {
    if (userId) {
      router.replace('/ingredients');
    } else {
      router.replace('/login');
    }
  }, [userId, router]);

  // Show nothing while redirecting
  return null;
}
