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

  // Sam jam-video #2 (27-May-2026): no ad-spend section on the client
  // portal yet. The dashboard must not render an Ad Spend card even if
  // the BE keeps returning adSpendByPlatform for managed clients.
  it('does NOT render an Ad Spend card on the dashboard', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'GBP' },
    ];
    renderPage();
    expect(screen.queryByText('Ad Spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Google Ads')).not.toBeInTheDocument();
  });
});
