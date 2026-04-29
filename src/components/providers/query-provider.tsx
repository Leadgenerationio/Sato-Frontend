import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Tuned for a dashboard app where most data changes slowly:
// - staleTime 5min: re-navigations within 5 min reuse cached data with no
//   network round-trip. Matches the backend's LeadByte cache TTL so we
//   never out-stale the server.
// - gcTime 10min: cached data stays in memory long enough that bouncing
//   between routes feels instant even after long pauses.
// - refetchOnWindowFocus: false — by default React Query refetches every time
//   the user tabs back. Annoying for dashboard widgets that don't need to
//   chase the second.
// - retry: 1 — one retry on flaky 5xx is fine; more delays the user.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
