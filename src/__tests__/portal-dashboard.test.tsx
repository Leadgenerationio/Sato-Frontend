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
  // The page also pulls invoices/compliance/leads for its snapshot cards +
  // charts; stub them empty (all consumers guard with ?? [] / ?.).
  usePortalInvoices: () => ({ data: undefined, isLoading: false, error: null }),
  usePortalCompliance: () => ({ data: undefined, isLoading: false, error: null }),
  usePortalLeads: () => ({ data: undefined, isLoading: false, error: null }),
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
    // "Outstanding" also appears in the Invoices snapshot sub-text, so scope to
    // ≥1 rather than a unique match.
    expect(screen.getAllByText('Outstanding').length).toBeGreaterThanOrEqual(1);
  });

  it('renders lead delivery chart heading', () => {
    renderPage();
    expect(screen.getByText('Recent Lead Deliveries')).toBeInTheDocument();
  });

  // Ad Spend by Platform is shown on the dashboard for managed clients when the
  // BE returns adSpendByPlatform (falls back to the MTD spend when "This month"
  // is selected and there's no per-source LeadByte breakdown).
  it('renders the Ad Spend card for managed clients with ad-spend data', () => {
    dashboardFixture.clientType = 'managed';
    dashboardFixture.adSpendByPlatform = [
      { platform: 'Google Ads', spend: 300, currency: 'GBP' },
    ];
    renderPage();
    expect(screen.getByText('Ad Spend by Platform')).toBeInTheDocument();
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
  });
});
