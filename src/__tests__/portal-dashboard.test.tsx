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

// The dashboard page also pulls invoices, compliance, and leads (delivery /
// spend / quality windows). Stub them all so the component renders; only the
// dashboard fixture carries meaningful data for these assertions.
vi.mock('@/lib/hooks/use-portal', () => ({
  usePortalDashboard: () => ({ data: dashboardFixture, isLoading: false, error: null }),
  usePortalInvoices: () => ({ data: [], isLoading: false, error: null }),
  usePortalCompliance: () => ({ data: [], isLoading: false, error: null }),
  usePortalLeads: () => ({ data: { leads: [], bySource: [] }, isLoading: false, error: null }),
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
    // Reset to the default pay-per-lead fixture before each test so per-test
    // mutations don't leak. Clear any saved dashboard layout too.
    dashboardFixture.clientType = 'ppl';
    dashboardFixture.adSpendByPlatform = [];
    localStorage.clear();
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
    // "Outstanding" appears both as the stat-card label and in the invoices
    // snapshot; assert the stat-card label specifically.
    const labels = screen.getAllByText('Outstanding');
    expect(labels.some((el) => el.classList.contains('pstat-lab'))).toBe(true);
  });

  it('renders lead delivery chart heading', () => {
    renderPage();
    expect(screen.getByText('Recent Lead Deliveries')).toBeInTheDocument();
  });

  // Sam 2026-06-15: the admin "Client type / Ad-spend visibility" toggle gates
  // the portal Ad Spend card. ppl (pay-per-lead) → hidden; managed → visible.
  // This SUPERSEDES the 27-May "no ad-spend on the portal at all" rule.
  it('does NOT render the Ad Spend card for a pay-per-lead client', () => {
    dashboardFixture.clientType = 'ppl';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'GBP' },
    ];
    renderPage();
    // Card removed entirely — not even the empty-state placeholder.
    expect(screen.queryByText('Ad Spend by Platform')).not.toBeInTheDocument();
    expect(screen.queryByText(/No ad-spend data/)).not.toBeInTheDocument();
  });

  it('renders the Ad Spend card for a managed client', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'GBP' },
    ];
    renderPage();
    expect(screen.getByText('Ad Spend by Platform')).toBeInTheDocument();
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
  });

  // When the toggle is turned on, the card must come back automatically even if
  // the client had a saved layout that no longer listed it — no manual editing.
  it('auto-adds the Ad Spend card when managed, even if a saved layout dropped it', () => {
    localStorage.setItem('stato-portal-dash-v1', JSON.stringify(['stats', 'deliveries', 'snapshots']));
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'GBP' },
    ];
    renderPage();
    expect(screen.getByText('Ad Spend by Platform')).toBeInTheDocument();
  });

  it('shows the Ad Spend section for managed clients', () => {
    dashboardFixture.clientType = 'managed';
    renderPage();
    // Managed clients get the ad-spend block — the card when spend data exists,
    // otherwise the empty state. Either way it is rendered (never hidden as for PPL).
    expect(
      screen.getByText((t) => /Ad Spend by Platform|No ad-spend data/.test(t)),
    ).toBeInTheDocument();
  });
});
