import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BankFeedPage } from '../pages/finance/bank-feed';
import type { BankTransaction, CostCategory } from '../lib/hooks/use-bank-feed';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b1', clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const { mockCategorizeMutate } = vi.hoisted(() => ({
  mockCategorizeMutate: vi.fn(),
}));

const advertisingCat: CostCategory = { id: 'cat-ads', name: 'Advertising', bucket: 'advertising', color: null };
const rentCat: CostCategory = { id: 'cat-rent', name: 'Rent', bucket: 'fixed', color: null };

const categorizedTx: BankTransaction = {
  id: 'tx-1',
  xeroBankTransactionId: 'xero-1',
  xeroAccountId: null,
  date: '2026-05-10',
  amount: '-37.69',
  currency: 'GBP',
  description: null,
  vendorName: 'Facebook Ads',
  categoryId: 'cat-ads',
  categoryName: 'Advertising',
  categoryBucket: 'advertising',
  isAutoCategorized: false,
};

vi.mock('@/lib/hooks/use-bank-feed', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/use-bank-feed')>(
    '../lib/hooks/use-bank-feed',
  );
  return {
    ...actual,
    useBankTransactions: () => ({
      data: { transactions: [categorizedTx], total: 1, page: 1, pageSize: 25 },
      isLoading: false,
      error: null,
    }),
    useCostCategories: () => ({ data: [advertisingCat, rentCat] }),
    useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCategorizeTransaction: () => ({ mutateAsync: mockCategorizeMutate, isPending: false }),
    useSyncBankFeed: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useBankFeedSyncStatus: () => ({ data: { lastSyncAt: null } }),
  };
});

vi.mock('@/lib/hooks/use-debounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BankFeedPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCategorizeMutate.mockReset();
  mockCategorizeMutate.mockResolvedValue({ ok: true });
});

describe('BankFeedPage — uncategorize via dropdown', () => {
  it('picking "— Uncategorised —" on an already-categorized row uncategorizes immediately (no dialog)', async () => {
    renderPage();
    // Switch from "Uncategorised" tab default to "All" so the categorized tx shows up
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }));

    // The row's category dropdown (aria-label "Category", so found by that name
    // rather than its visible label) should currently show "Advertising"…
    const categoryTrigger = await screen.findByRole('button', { name: 'Category' });
    expect(categoryTrigger).toHaveTextContent(/Advertising \(advertising\)/);
    // …then picking "— Uncategorised —" uncategorizes the row.
    fireEvent.click(categoryTrigger);
    fireEvent.click(await screen.findByRole('option', { name: /Uncategorised/i }));

    await waitFor(() => {
      expect(mockCategorizeMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          categoryId: null,
        }),
      );
    });
  });
});
