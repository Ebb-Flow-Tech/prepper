'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AppProvider } from './store';
import { AuthGuard } from '@/components/AuthGuard';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AuthGuard>
          {children}
        </AuthGuard>
        <Toaster position="bottom-center" richColors />
      </AppProvider>
    </QueryClientProvider>
  );
}
