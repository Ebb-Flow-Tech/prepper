'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AppProvider } from './store';
import { ThemeProvider } from './theme';
import { AuthGuard } from '@/components/AuthGuard';
import { setQueryClientRef } from './query-client-ref';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          refetchOnWindowFocus: false,
        },
      },
    });
    setQueryClientRef(client);
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppProvider>
          <AuthGuard>{children}</AuthGuard>
          <Toaster position="bottom-center" richColors />
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
