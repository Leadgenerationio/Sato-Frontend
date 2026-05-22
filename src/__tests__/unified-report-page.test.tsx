import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnifiedReportPage } from '../pages/reports/unified';

// Sam (2026-05-15 meeting #10): the "By source · profitability" roll-up —
// Catchr ad-spend × LeadByte revenue summed across campaigns so the per-
// platform "Facebook spend → Facebook profit / margin" row is one scan away,
// just like LeadReports.io.

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Two campaigns × two Facebook rows + one Google row so the aggregator has
// real work to do (Facebook = 150 leads / £1500 spend / £4500 rev across 2
// campaigns; Google = 50 leads / £500 spend / £1500 rev in one campaign).
vi.mock('@/lib/hooks/use-reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-reports')>();
  return {
    ...actual,
    useUnifiedReport: () => ({
      data: {
        window: 'this_month',
        supplier: null,
        campaign: null,
        rows: [
          {
            campaignId: 'c1', campaignName: 'Solar Panels', clientName: 'UK Energy',
            vertical: 'Solar', supplier: 'Facebook Ads', supplierPlatform: 'Facebook Ads',
            catchrUrl: 'https://catchr.example/fb', leads: 100, spend: 1000,
            revenue: 3000, profit: 2000, cpl: 10, margin: 66.7,
          },
          {
            campaignId: 'c2', campaignName: 'Hearing Aids', clientName: 'Ears Co',
            vertical: 'Hearing Aids', supplier: 'Facebook Ads', supplierPlatform: 'Facebook Ads',
            catchrUrl: null, leads: 50, spend: 500,
            revenue: 1500, profit: 1000, cpl: 10, margin: 66.7,
          },
          {
            campaignId: 'c1', campaignName: 'Solar Panels', clientName: 'UK Energy',
            vertical: 'Solar', supplier: 'Google Ads', supplierPlatform: 'Google Ads',
            catchrUrl: null, leads: 50, spend: 500,
            revenue: 1500, profit: 1000, cpl: 10, margin: 66.7,
          },
        ],
        totals: { leads: 200, spend: 2000, revenue: 6000, profit: 4000, margin: 66.7 },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><UnifiedReportPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UnifiedReportPage — "By source · profitability" roll-up', () => {
  it('renders the new By source card with title and description', () => {
    renderPage();
    const card = screen.getByTestId('by-source-rollup');
    expect(card).toBeInTheDocument();
    expect(within(card).getByText('By source · profitability')).toBeInTheDocument();
    expect(within(card).getByText(/aggregated per platform/i)).toBeInTheDocument();
  });

  it('renders one row per supplier platform (Facebook collapsed across two campaigns)', () => {
    renderPage();
    const card = screen.getByTestId('by-source-rollup');
    // Two distinct platforms in the mock — Facebook Ads (sum of 2 rows) and
    // Google Ads (single row). The platform cell shows the LeadByte string
    // verbatim — assert against the actual rendered text.
    expect(within(card).getByText('Facebook Ads')).toBeInTheDocument();
    expect(within(card).getByText('Google Ads')).toBeInTheDocument();
  });

  it('shows the platform totals row matching the totals strip (leads=200, revenue=£6,000)', () => {
    renderPage();
    const card = screen.getByTestId('by-source-rollup');
    // The footer row repeats the window-scoped totals so the per-platform
    // numbers above are easy to reconcile against the master total.
    expect(within(card).getByText(/Totals · this month/i)).toBeInTheDocument();
  });

  it('keeps the existing By campaign card intact (additive change)', () => {
    renderPage();
    expect(screen.getByTestId('by-campaign-rollup')).toBeInTheDocument();
    expect(screen.getByText('By campaign · roll-up')).toBeInTheDocument();
  });
});
