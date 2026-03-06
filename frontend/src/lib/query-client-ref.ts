import type { QueryClient } from '@tanstack/react-query';

/**
 * Module-level reference to the TanStack QueryClient.
 * Kept separate to avoid circular imports between store.tsx and providers.tsx.
 */
let _queryClient: QueryClient | null = null;

export function setQueryClientRef(client: QueryClient) {
  _queryClient = client;
}

export function getQueryClient(): QueryClient | null {
  return _queryClient;
}
