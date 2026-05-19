import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalLeadsPage } from '../pages/portal/leads';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'client@stato.app', name: 'Client', role: 'client', isActive: true, businessId: null, clientId: 'c1' }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const DUBLIN = '11111111-1111-1111-1111-111111111111';
const CORK = '22222222-2222-2222-2222-222222222222';
const CLARE = '33333333-3333-3333-3333-333333333333';

vi.mock('@/lib/hooks/use-portal', () => ({
  usePortalLeads: () => ({
    data: {
      range: { from: '2026-04-01', to: '2026-04-07' },
      leads: [
        { date: '2026-04-07', campaignId: DUBLIN, campaignName: 'Audiology - Dublin', leadCount: 12, validLeads: 11, invalidLeads: 1 },
        { date: '2026-04-06', campaignId: DUBLIN, campaignName: 'Audiology - Dublin', leadCount: 9, validLeads: 8, invalidLeads: 1 },
        { date: '2026-04-07', campaignId: CORK, campaignName: 'Audiology - Cork', leadCount: 5, validLeads: 5, invalidLeads: 0 },
        { date: '2026-04-05', campaignId: CLARE, campaignName: 'Audiology - Clare', leadCount: 3, validLeads: 3, invalidLeads: 0 },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PortalLeadsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalLeadsPage — By Campaign', () => {
  it('groups leads by campaign and shows total per campaign', () => {
    renderPage();
    // Dublin = 12 + 9 = 21
    const dublinRow = screen.getByText('Audiology - Dublin').closest('tr')!;
    expect(within(dublinRow).getByText('21')).toBeInTheDocument();
    // Cork = 5
    const corkRow = screen.getByText('Audiology - Cork').closest('tr')!;
    expect(within(corkRow).getByText('5')).toBeInTheDocument();
    // Clare = 3
    const clareRow = screen.getByText('Audiology - Clare').closest('tr')!;
    expect(within(clareRow).getByText('3')).toBeInTheDocument();
  });

  it('sorts campaigns by lead count descending', () => {
    renderPage();
    const rows = screen.getAllByRole('row');
    const campaignNames = rows
      .map((r) => r.textContent ?? '')
      .filter((t) => t.includes('Audiology -'));
    expect(campaignNames[0]).toContain('Dublin');
    expect(campaignNames[1]).toContain('Cork');
    expect(campaignNames[2]).toContain('Clare');
  });

  it('expands a campaign to show its daily breakdown', () => {
    renderPage();
    const dublinRow = screen.getByText('Audiology - Dublin').closest('tr')!;
    fireEvent.click(dublinRow);
    // After expanding, both Dublin days should be visible. The 12-lead day has
    // valid=11, invalid=1. Match the values directly.
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('renders date range filter inputs', () => {
    renderPage();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });
});
