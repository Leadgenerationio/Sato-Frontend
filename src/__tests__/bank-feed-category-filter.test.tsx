import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BankFeedPage } from '../pages/finance/bank-feed';
import type { CostCategory } from '../lib/hooks/use-bank-feed';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b1', clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const advertisingCat: CostCategory = { id: 'cat-ads', name: 'Advertising', bucket: 'advertising', color: null };
const softwareCat: CostCategory = { id: 'cat-software', name: 'Software Subscriptions', bucket: 'fixed', color: null };
const rentCat: CostCategory = { id: 'cat-rent', name: 'Rent', bucket: 'fixed', color: null };

const { useBankTransactionsSpy } = vi.hoisted(() => ({
  useBankTransactionsSpy: vi.fn(),
}));

vi.mock('@/lib/hooks/use-bank-feed', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/use-bank-feed')>(
    '../lib/hooks/use-bank-feed',
  );
  return {
    ...actual,
    useBankTransactions: (filters: unknown) => {
      useBankTransactionsSpy(filters);
      return {
        data: { transactions: [], total: 0, page: 1, pageSize: 25 },
        isLoading: false,
        error: null,
      };
    },
    useCostCategories: () => ({ data: [advertisingCat, softwareCat, rentCat] }),
    useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCategorizeTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  useBankTransactionsSpy.mockReset();
});

describe('BankFeedPage — per-category filter dropdown', () => {
  it('passes categoryId to useBankTransactions when a category is picked', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText(/filter by category/i));
    fireEvent.click(await screen.findByRole('option', { name: /Software Subscriptions \(fixed\)/i }));

    await waitFor(() => {
      expect(useBankTransactionsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoryId: 'cat-software' }),
      );
    });
  });

  it('resets the bucket to "all" when a category filter is picked (so the list does not empty due to bucket+category mismatch)', async () => {
    renderPage();
    // Start by selecting a non-default bucket so the reset is observable
    fireEvent.click(screen.getByRole('button', { name: /^advertising$/i }));
    await waitFor(() => {
      expect(useBankTransactionsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ bucket: 'advertising' }),
      );
    });

    fireEvent.click(screen.getByLabelText(/filter by category/i));
    fireEvent.click(await screen.findByRole('option', { name: /Rent \(fixed\)/i }));

    await waitFor(() => {
      const last = useBankTransactionsSpy.mock.calls.at(-1)?.[0] as {
        categoryId?: string;
        bucket?: string;
        uncategorized?: boolean;
      };
      expect(last?.categoryId).toBe('cat-rent');
      expect(last?.bucket).toBeUndefined();
      expect(last?.uncategorized).toBeUndefined();
    });
  });

  it('clears the categoryId when the dropdown is set back to "All categories"', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText(/filter by category/i));
    fireEvent.click(await screen.findByRole('option', { name: /Software Subscriptions \(fixed\)/i }));
    await waitFor(() => {
      expect(useBankTransactionsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoryId: 'cat-software' }),
      );
    });

    fireEvent.click(screen.getByLabelText(/filter by category/i));
    fireEvent.click(await screen.findByRole('option', { name: /^All categories$/i }));
    await waitFor(() => {
      const last = useBankTransactionsSpy.mock.calls.at(-1)?.[0] as { categoryId?: string };
      expect(last?.categoryId).toBeUndefined();
    });
  });
});
