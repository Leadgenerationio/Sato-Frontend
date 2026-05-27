import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalAdSpendPage } from '../pages/portal/ad-spend';

const { dashboardFixture } = vi.hoisted(() => ({
  dashboardFixture: {
    companyName: 'Apex Media Ltd',
    clientType: 'managed' as 'ppl' | 'managed',
    activeCampaigns: 3,
    totalLeadsThisMonth: 1250,
    totalLeadsAllTime: 15400,
    pendingInvoices: 2,
    overdueInvoices: 1,
    totalOutstanding: 4800,
    agreementSigned: true,
    recentLeads: [],
    adSpendByPlatform: [] as Array<{ platform: string; spend: number; currency: string }>,
  },
}));

vi.mock('@/lib/hooks/use-portal', () => ({
  usePortalDashboard: () => ({ data: dashboardFixture, isLoading: false, error: null }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PortalAdSpendPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalAdSpendPage', () => {
  beforeEach(() => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [];
  });

  it('renders per-platform rows + a total for a managed client', () => {
    dashboardFixture.adSpendByPlatform = [
      { platform: 'google-ads', spend: 300, currency: 'GBP' },
      { platform: 'facebook-ads', spend: 120.5, currency: 'GBP' },
    ];
    renderPage();
    // Raw Catchr platform values are prettified for display.
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Facebook Ads')).toBeInTheDocument();
    expect(screen.queryByText('google-ads')).not.toBeInTheDocument();
    expect(screen.getByText('£300.00')).toBeInTheDocument();
    expect(screen.getByText('£120.50')).toBeInTheDocument();
    expect(screen.getByText('£420.50')).toBeInTheDocument(); // GBP total
  });

  it('renders non-GBP spend with the right symbol (currency comes from the row)', () => {
    dashboardFixture.adSpendByPlatform = [{ platform: 'Google Ads', spend: 300, currency: 'USD' }];
    renderPage();
    expect(screen.getAllByText('US$300.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('£300.00')).not.toBeInTheDocument();
  });

  it('shows one Total per currency, never summing across currencies', () => {
    dashboardFixture.adSpendByPlatform = [
      { platform: 'facebook-ads', spend: 120.5, currency: 'GBP' },
      { platform: 'facebook-ads', spend: 50, currency: 'USD' },
    ];
    renderPage();
    expect(screen.getAllByText('£120.50').length).toBe(2); // row + GBP total
    expect(screen.getAllByText('US$50.00').length).toBe(2);
    expect(screen.queryByText(/170\.50/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Total')).toHaveLength(2);
  });

  it('shows an empty state for a managed client with no spend', () => {
    dashboardFixture.adSpendByPlatform = [];
    renderPage();
    expect(screen.getByText('No ad spend this month')).toBeInTheDocument();
  });

  // Regression for the 2026-05-27 production crash: a malformed currency code
  // must not throw out of Intl.NumberFormat and blank the page.
  it('renders without crashing when a row has a malformed currency code', () => {
    dashboardFixture.adSpendByPlatform = [
      { platform: 'taboola', spend: 10, currency: '' },
      { platform: 'google-ads', spend: 300, currency: 'GBP' },
    ];
    expect(() => renderPage()).not.toThrow();
    expect(screen.getByText('Taboola')).toBeInTheDocument();
    expect(screen.getAllByText('£300.00').length).toBeGreaterThan(0);
  });

  it('shows a not-available state for a PPL client (managed-only feature)', () => {
    dashboardFixture.clientType = 'ppl';
    dashboardFixture.adSpendByPlatform = [{ platform: 'google-ads', spend: 300, currency: 'GBP' }];
    renderPage();
    expect(screen.getByText(/isn't available on your plan/i)).toBeInTheDocument();
    // PPL must never see the actual spend figures.
    expect(screen.queryByText('Google Ads')).not.toBeInTheDocument();
    expect(screen.queryByText('£300.00')).not.toBeInTheDocument();
  });
});
