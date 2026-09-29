import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useClient, useUpdateClient } from '@/lib/hooks/use-clients';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api', () => ({ api, unwrap: <T,>(res: { data?: T }) => res.data as T }));

// The client-type switch (S1) shows an optimistic value until the save "settles". The client on
// screen must already hold the new value at that moment, without depending on a second request.
describe('useUpdateClient seeds the client on screen from the save', () => {
  beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

  async function setup(refetch: () => Promise<unknown>) {
    api.get.mockResolvedValueOnce({ data: { client: { id: 'c1', clientType: 'ppl', companyName: 'Acme' } } });
    api.get.mockImplementationOnce(refetch);
    api.put.mockResolvedValue({ data: { client: { id: 'c1', clientType: 'managed' } } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const hook = renderHook(() => ({ client: useClient('c1'), update: useUpdateClient() }), { wrapper: w });
    await waitFor(() => expect(hook.result.current.client.data?.clientType).toBe('ppl'));
    return { qc, hook };
  }

  it('resolves with the new value in the cache while the refetch is still pending', async () => {
    const { qc, hook } = await setup(() => new Promise(() => {})); // refetch never answers
    let settled = false;
    await act(async () => { await hook.result.current.update.mutateAsync({ id: 'c1', clientType: 'managed' }); settled = true; });
    expect(settled).toBe(true); // did not wait for the refetch
    const cached = qc.getQueryData(['client', 'c1']) as { clientType?: string; companyName?: string };
    expect(cached.clientType).toBe('managed');
    expect(cached.companyName).toBe('Acme'); // fields the save did not return are kept
  });

  it('keeps the saved value when the follow-up refetch fails (no snap-back)', async () => {
    const { qc, hook } = await setup(async () => { throw new Error('network'); });
    await act(async () => { await hook.result.current.update.mutateAsync({ id: 'c1', clientType: 'managed' }); });
    await new Promise((r) => setTimeout(r, 30));
    expect((qc.getQueryData(['client', 'c1']) as { clientType?: string }).clientType).toBe('managed');
  });
});
