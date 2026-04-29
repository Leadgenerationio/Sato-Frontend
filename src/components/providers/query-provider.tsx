import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Tuned for a dashboard app where most data changes slowly:
// - staleTime 60s: re-navigations within a minute reuse cached data with no
//   network round-trip. Backend already caches LeadByte for 60s, so this
//   matches without making FE feel out of date.
// - gcTime 5min: cached data stays in memory long enough that bouncing
//   between routes feels instant even after long pauses.
// - refetchOnWindowFocus: false — by default React Query refetches every time
//   the user tabs back. Annoying for dashboard widgets that don't need to
//   chase the second.
// - retry: 1 — one retry on flaky 5xx is fine; more delays the user.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
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
