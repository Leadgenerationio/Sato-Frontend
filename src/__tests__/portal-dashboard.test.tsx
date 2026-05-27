import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalDashboardPage } from '../pages/portal/dashboard';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

// Mutable fixture so individual tests can flip clientType / adSpendByPlatform.
// The hoisted object is shared by reference with the mock factory below.
const { dashboardFixture } = vi.hoisted(() => ({
  dashboardFixture: {
    companyName: 'Apex Media Ltd',
    clientType: 'ppl' as 'ppl' | 'managed',
    activeCampaigns: 3,
    totalLeadsThisMonth: 1250,
    totalLeadsAllTime: 15400,
    pendingInvoices: 2,
    overdueInvoices: 1,
    totalOutstanding: 4800,
    agreementSigned: true,
    recentLeads: [
      { date: '2026-04-01', leads: 45 },
      { date: '2026-04-02', leads: 62 },
      { date: '2026-04-03', leads: 38 },
    ],
    adSpendByPlatform: [] as Array<{ platform: string; spend: number; currency: string }>,
  },
}));

vi.mock('@/lib/hooks/use-portal', () => ({
  usePortalDashboard: () => ({ data: dashboardFixture, isLoading: false, error: null }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PortalDashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalDashboardPage', () => {
  beforeEach(() => {
    // Reset to the default PPL fixture before each test so per-test mutations
    // don't leak.
    dashboardFixture.clientType = 'ppl';
    dashboardFixture.adSpendByPlatform = [];
  });

  it('renders company name', () => {
    renderPage();
    expect(screen.getByText('Apex Media Ltd')).toBeInTheDocument();
  });

  it('renders Active Campaigns stat card', () => {
    renderPage();
    expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders Leads This Month stat card', () => {
    renderPage();
    expect(screen.getByText('Leads This Month')).toBeInTheDocument();
  });

  it('renders Outstanding stat card', () => {
    renderPage();
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
  });

  it('renders lead delivery chart heading', () => {
    renderPage();
    expect(screen.getByText('Recent Lead Deliveries')).toBeInTheDocument();
  });

  // Ad spend — managed clients only (feature: portal ad spend for managed clients).
  it('does NOT render the Ad Spend card for a PPL client', () => {
    dashboardFixture.clientType = 'ppl';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Facebook Ads', spend: 120.5, currency: 'GBP' },
    ];
    renderPage();
    // Even if the API somehow returned spend, the PPL gate must hide it.
    expect(screen.queryByText('Ad Spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Facebook Ads')).not.toBeInTheDocument();
  });

  it('renders the per-platform Ad Spend card with a total for a managed client', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'GBP' },
      { platform: 'Facebook Ads', spend: 120.5, currency: 'GBP' },
    ];
    renderPage();
    expect(screen.getByText('Ad Spend')).toBeInTheDocument();
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Facebook Ads')).toBeInTheDocument();
    // Per-platform figures + the £420.50 total are all rendered.
    expect(screen.getByText('£300.00')).toBeInTheDocument();
    expect(screen.getByText('£120.50')).toBeInTheDocument();
    expect(screen.getByText('£420.50')).toBeInTheDocument();
  });

  it('renders non-GBP spend with the correct currency symbol', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'USD' },
    ];
    renderPage();
    // en-GB locale renders USD as "US$300.00" — the point is it's NOT £300,
    // i.e. currency comes from the row, not a hardcoded GBP.
    expect(screen.getAllByText('US$300.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('£300.00')).not.toBeInTheDocument();
  });

  it('renders a separate Total per currency and never sums across currencies', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Facebook Ads', spend: 120.5, currency: 'GBP' },
      { platform: 'Facebook Ads', spend: 50, currency: 'USD' },
    ];
    renderPage();
    // £120.50 shows twice (the single GBP row + its GBP total); US$50.00 once.
    expect(screen.getAllByText('£120.50').length).toBe(2);
    expect(screen.getAllByText('US$50.00').length).toBe(2);
    // Critically: no cross-currency mega-total.
    expect(screen.queryByText('£170.50')).not.toBeInTheDocument();
    expect(screen.queryByText(/170\.50/)).not.toBeInTheDocument();
    // One "Total" label per currency.
    expect(screen.getAllByText('Total')).toHaveLength(2);
  });

  it('shows an empty state on the Ad Spend card for a managed client with no spend', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [];
    renderPage();
    expect(screen.getByText('Ad Spend')).toBeInTheDocument();
    expect(screen.getByText('No ad spend this month')).toBeInTheDocument();
  });
});
