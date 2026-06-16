import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalLeadsPage } from '../pages/portal/leads';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'client@stato.app', name: 'Client', role: 'client', isActive: true, businessId: null, clientId: 'c1' }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const CAMP = '11111111-1111-1111-1111-111111111111';

// Regression: YTD (and other custom ranges) — LeadByte's supplier report returns
// per-source SPEND but no per-source valid leads, so bySource[].leads are all 0
// while the daily lead_deliveries rows clearly have data. The summary tiles used
// to show "Total Leads = 0" even though "Peak Day" showed real numbers. The total
// must fall back to the daily valid-lead sum when the by-source total is 0.
vi.mock('@/lib/hooks/use-portal', () => ({
  usePortalLeads: () => ({
    data: {
      range: { from: '2026-01-01', to: '2026-06-16' },
      leads: [
        { date: '2026-06-01', campaignId: CAMP, campaignName: 'Audiology', leadCount: 13, validLeads: 11, invalidLeads: 2 },
        { date: '2026-06-02', campaignId: CAMP, campaignName: 'Audiology', leadCount: 9, validLeads: 8, invalidLeads: 1 },
        { date: '2026-06-03', campaignId: CAMP, campaignName: 'Audiology', leadCount: 5, validLeads: 5, invalidLeads: 0 },
      ],
      // Spend present, leads 0 — the YTD shape from LeadByte.
      bySource: [
        { platform: 'facebook-ads', leads: 0, spend: 14047.78, currency: 'GBP' },
        { platform: 'google-ads', leads: 0, spend: 1882.07, currency: 'GBP' },
      ],
      bySourceWindow: { kind: 'preset', preset: 'ytd' },
    },
    isLoading: false,
    error: null,
  }),
  usePortalDashboard: () => ({ data: { clientType: 'managed' }, isLoading: false, error: null }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />, XAxis: () => <div />, YAxis: () => <div />,
  CartesianGrid: () => <div />, Tooltip: () => <div />,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PortalLeadsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalLeadsPage — Total Leads fallback when by-source leads are 0', () => {
  it('shows the daily valid-lead total (11+8+5=24), not 0, when by-source leads are 0', () => {
    renderPage();
    // The summary tiles: find the "Total Leads" tile and assert its value is 24.
    const totalTile = screen.getByText('Total Leads').closest('.pstat') as HTMLElement;
    expect(within(totalTile).getByText('24')).toBeInTheDocument();
    // Peak Day is the max daily validLeads = 11 (was already correct).
    const peakTile = screen.getByText('Peak Day').closest('.pstat') as HTMLElement;
    expect(within(peakTile).getByText('11')).toBeInTheDocument();
  });
});
