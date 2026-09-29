import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useClient, useUpdateClient } from '@/lib/hooks/use-clients';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api', () => ({ api, unwrap: <T,>(res: { data?: T }) => res.data as T }));

// The client-type switch (S1) shows an optimistic value until the save "settles". If the save resolved
// before the client was refetched, the switch snapped back to the old type for a moment after "Saved".
describe('useUpdateClient settles only once the client on screen is fresh', () => {
  beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

  it('does not resolve until the refetched client has arrived', async () => {
    let releaseRefetch!: () => void;
    const stale = { data: { client: { id: 'c1', clientType: 'ppl' } } };
    const fresh = { data: { client: { id: 'c1', clientType: 'managed' } } };
    api.get
      .mockResolvedValueOnce(stale) // first load
      .mockImplementationOnce(() => new Promise((r) => { releaseRefetch = () => r(fresh); })); // refetch after save
    api.put.mockResolvedValue({ data: { client: { id: 'c1', clientType: 'managed' } } });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({ client: useClient('c1'), update: useUpdateClient() }), { wrapper: w });
    await waitFor(() => expect(result.current.client.data?.clientType).toBe('ppl'));

    let settled = false;
    let typeWhenSettled: unknown;
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.update.mutateAsync({ id: 'c1', clientType: 'managed' }).then(() => {
        settled = true;
        typeWhenSettled = (qc.getQueryData(['client', 'c1']) as { clientType?: string } | undefined)?.clientType;
      });
    });
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    await waitFor(() => expect(releaseRefetch).toBeTypeOf('function')); // the refetch has started
    await new Promise((r) => setTimeout(r, 30));
    expect(settled).toBe(false); // still waiting for the fresh client

    await act(async () => { releaseRefetch(); await p; });
    expect(settled).toBe(true);
    expect(typeWhenSettled).toBe('managed'); // the cache was already fresh at the moment it settled
  });
});
