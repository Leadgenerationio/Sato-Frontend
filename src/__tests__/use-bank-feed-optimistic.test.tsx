import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCategorizeTransaction, type PaginatedTransactions, type BankTransaction } from '../lib/hooks/use-bank-feed';
import { api } from '../lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn().mockResolvedValue({ data: { status: 'success', data: { ok: true } } }),
      delete: vi.fn(),
    },
  };
});

const tx: BankTransaction = {
  id: 'tx-1',
  xeroBankTransactionId: 'xero-1',
  xeroAccountId: null,
  date: '2026-05-10',
  amount: '-37.69',
  currency: 'GBP',
  description: null,
  vendorName: 'Facebook Ads',
  categoryId: null,
  categoryName: null,
  categoryBucket: null,
  isAutoCategorized: false,
};

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCategorizeTransaction — optimistic cache update', () => {
  it('removes the tx from a list filtered to uncategorized=true when it gets a category', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const filters = { uncategorized: true };
    const initial: PaginatedTransactions = { transactions: [tx], total: 1, page: 1, pageSize: 25 };
    qc.setQueryData(['bank-feed', 'transactions', filters], initial);

    const { result } = renderHook(() => useCategorizeTransaction(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ transactionId: 'tx-1', categoryId: 'cat-ads' });
    });

    const after = qc.getQueryData<PaginatedTransactions>(['bank-feed', 'transactions', filters]);
    expect(after?.transactions).toHaveLength(0);
  });

  it('updates the tx in place when the list is not bucket/uncategorized filtered (e.g. the All tab)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const filters = {};
    const initial: PaginatedTransactions = { transactions: [tx], total: 1, page: 1, pageSize: 25 };
    qc.setQueryData(['bank-feed', 'transactions', filters], initial);

    const { result } = renderHook(() => useCategorizeTransaction(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ transactionId: 'tx-1', categoryId: 'cat-ads' });
    });

    const after = qc.getQueryData<PaginatedTransactions>(['bank-feed', 'transactions', filters]);
    expect(after?.transactions).toHaveLength(1);
    expect(after?.transactions[0]?.categoryId).toBe('cat-ads');
  });

  it('rolls back the optimistic update if the mutation fails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const filters = { uncategorized: true };
    const initial: PaginatedTransactions = { transactions: [tx], total: 1, page: 1, pageSize: 25 };
    qc.setQueryData(['bank-feed', 'transactions', filters], initial);

    vi.mocked(api.patch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCategorizeTransaction(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ transactionId: 'tx-1', categoryId: 'cat-ads' }),
      ).rejects.toThrow();
    });

    await waitFor(() => {
      const after = qc.getQueryData<PaginatedTransactions>(['bank-feed', 'transactions', filters]);
      expect(after?.transactions).toHaveLength(1);
      expect(after?.transactions[0]?.categoryId).toBeNull();
    });
  });
});
