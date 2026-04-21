import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdSpendReportPage } from '../pages/reports/ad-spend';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (path: string) => {
      if (path.startsWith('/api/v1/ad-spend/status')) {
        return { status: 'success', data: { configured: true, lastSyncAt: '2026-04-20T12:00:00Z' } };
      }
      if (path.startsWith('/api/v1/ad-spend/summary')) {
        return {
          status: 'success',
          data: {
            rows: [
              { platform: 'google-ads', accountName: 'Will-Writing.io', totalSpend: 320.71, currency: 'GBP', campaigns: 2 },
              { platform: 'facebook-ads', accountName: 'PCPClaim.io', totalSpend: 80.0, currency: 'GBP', campaigns: 1 },
            ],
            total: { total: 400.71, currency: 'GBP', rowCount: 3 },
          },
        };
      }
      if (path.startsWith('/api/v1/ad-spend')) {
        return {
          status: 'success',
          data: [
            {
              id: 'row-1',
              date: '2026-04-19',
              platform: 'google-ads',
              accountId: '6389726025',
              accountName: 'Will-Writing.io',
              campaignId: '123',
              campaignName: 'MXC | 65+ | DISCOVERY | COMPARE | WB',
              spend: '320.710385',
              currency: 'GBP',
              clientId: null,
            },
          ],
        };
      }
      return { status: 'success', data: null };
    }),
    post: vi.fn(),
  },
  ApiError: class extends Error { constructor(m: string, public status: number) { super(m); } },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><AdSpendReportPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdSpendReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /ad spend/i })).toBeInTheDocument();
  });

  it('shows platform filter tabs for all 5 connected networks', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /google ads/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /facebook ads/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /microsoft ads/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tiktok ads/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /taboola/i })).toBeInTheDocument();
  });

  it('renders the summary totals from the API', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/£400\.71/)).toBeInTheDocument());
  });

  it('renders per-platform summary rows', async () => {
    renderPage();
    // Will-Writing.io appears in summary + daily rows, so use getAllByText
    await waitFor(() => expect(screen.getAllByText(/Will-Writing\.io/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/PCPClaim\.io/i)).toBeInTheDocument();
  });

  it('renders daily campaign rows in the bottom table', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/MXC \| 65\+ \| DISCOVERY/)).toBeInTheDocument());
  });
});
