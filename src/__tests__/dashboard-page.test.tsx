import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../pages/dashboard';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-dashboard', () => ({
  useDashboardStats: () => ({
    data: {
      totalRevenue: 125000,
      revenueChange: 12.4,
      activeClients: 18,
      clientChange: 2,
      activeCampaigns: 7,
      campaignChange: 1,
      totalLeadsThisMonth: 3200,
      leadsChange: 8.2,
      recentInvoices: [
        { id: 'inv-1', invoiceNumber: 'INV-1050', clientName: 'Apex Media', status: 'paid', total: 631.80, currency: 'GBP', daysOverdue: 0, createdAt: '2026-04-10' },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useFinancialOverview: () => ({
    data: [
      { month: 'Jan 2026', revenue: 25000, expenses: 12000, profit: 13000, invoicesPaid: 12, invoicesOverdue: 1, vatCollected: 5000 },
      { month: 'Feb 2026', revenue: 28000, expenses: 13500, profit: 14500, invoicesPaid: 14, invoicesOverdue: 0, vatCollected: 5600 },
    ],
    isLoading: false,
    error: null,
  }),
  useLeadsByDay: () => ({
    data: [
      { day: 'Mon', date: '2026-04-21', leads: 12 },
      { day: 'Tue', date: '2026-04-22', leads: 18 },
      { day: 'Wed', date: '2026-04-23', leads: 9 },
      { day: 'Thu', date: '2026-04-24', leads: 25 },
      { day: 'Fri', date: '2026-04-25', leads: 14 },
      { day: 'Sat', date: '2026-04-26', leads: 4 },
      { day: 'Sun', date: '2026-04-27', leads: 2 },
    ],
    isLoading: false,
    error: null,
  }),
  useRecentActivity: () => ({
    data: [
      { id: 'inv-1', user: 'System', action: 'Invoice INV-1050 created for Apex Media (£632)', timestamp: new Date().toISOString(), category: 'invoice' },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/hooks/use-campaigns', () => ({
  useCampaigns: () => ({
    data: {
      campaigns: [
        { id: '1', name: 'Solar UK', vertical: 'Solar', status: 'active', leadsThisMonth: 100, totalRevenue: 1000, totalCost: 400, currency: 'GBP', clientName: 'Apex', leadPrice: 10, totalLeads: 200, leadsToday: 5, leadsThisWeek: 25, cpl: 4, margin: 60, startDate: '2026-01-01', campaignType: 'pay_per_lead' },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/components/dashboard/bank-widget', () => ({
  BankWidget: () => <div data-testid="bank-widget">BankWidget</div>,
}));

vi.mock('@/components/dashboard/overdue-widget', () => ({
  OverdueWidget: () => <div data-testid="overdue-widget">OverdueWidget</div>,
}));

vi.mock('@/components/dashboard/vat-widget', () => ({
  VatWidget: () => <div data-testid="vat-widget">VatWidget</div>,
}));

vi.mock('@/components/dashboard/pnl-widget', () => ({
  PnlWidget: () => <div data-testid="pnl-widget">PnlWidget</div>,
}));

vi.mock('@/components/dashboard/credit-alert-widget', () => ({
  CreditAlertWidget: () => <div data-testid="credit-alert-widget">CreditAlertWidget</div>,
}));

vi.mock('@/components/dashboard/notification-feed', () => ({
  NotificationFeed: () => <div data-testid="notification-feed">NotificationFeed</div>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><DashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('renders Dashboard heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders Total Revenue stat card', () => {
    renderPage();
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
  });

  it('renders Active Clients stat card', () => {
    renderPage();
    expect(screen.getByText('Active Clients')).toBeInTheDocument();
  });

  it('renders Active Campaigns stat card', () => {
    renderPage();
    expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
  });

  it('renders Leads This Month stat card', () => {
    renderPage();
    expect(screen.getByText('Leads This Month')).toBeInTheDocument();
  });
});
