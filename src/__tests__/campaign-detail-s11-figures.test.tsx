/**
 * Sam S11 (feedback round 1, 2026-09-29) — campaign page figures:
 *  - "Cost £0.00" sat next to a −£1,087.53 loss → the Cost tile now shows the
 *    ad-spend / LeadByte split and the Revenue tile shows the window profit;
 *  - a source with spend but no leads is listed, not drawn as a £0 bar;
 *  - Ad Account Links rows whose leads/revenue can't be split say so instead
 *    of showing £0.00 as if it were real.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CampaignDetail, TrafficSource } from '@/lib/hooks/use-campaigns';

const campaign: CampaignDetail = {
  id: 'camp-1', name: 'Hearing Aids (CH)', clientName: 'Sonova', vertical: 'Hearing Aids', status: 'active',
  campaignType: 'pay_per_lead', leadPrice: 0, currency: 'GBP', totalLeads: 190, leadsToday: 4, leadsThisWeek: 30,
  leadsThisMonth: 190, totalRevenue: 13440, totalCost: 14527.53, cpl: 76.46, margin: -8.1, startDate: '2026-01-01',
  satoId: 'sato-1', costPerLead: null, linkedClients: [], leadDeliveries: [],
  windowReports: {
    today: { leads: 0, revenue: 0, cost: 0, leadbyteCost: 0, adSpend: 0 },
    yesterday: { leads: 0, revenue: 0, cost: 0, leadbyteCost: 0, adSpend: 0 },
    this_week: { leads: 0, revenue: 0, cost: 0, leadbyteCost: 0, adSpend: 0 },
    last_week: { leads: 0, revenue: 0, cost: 0, leadbyteCost: 0, adSpend: 0 },
    this_month: { leads: 190, revenue: 13440, cost: 14527.53, leadbyteCost: 0, adSpend: 14527.53 },
    last_month: { leads: 0, revenue: 0, cost: 0, leadbyteCost: 0, adSpend: 0 },
    ytd: { leads: 190, revenue: 13440, cost: 14527.53, leadbyteCost: 0, adSpend: 14527.53 },
  },
  suppliers: [
    { id: 'facebook-ads', name: 'Facebook', platform: 'facebook-ads', totalSpend: 14527.53, leadbyteCost: 0, adSpend: 14527.53, totalLeads: 190, revenue: 13440, cpl: 76.46 },
    { id: 'taboola', name: 'Taboola', platform: 'taboola', totalSpend: 250, leadbyteCost: 0, adSpend: 250, totalLeads: 0, revenue: 0, cpl: null },
  ],
};

const source = (over: Partial<TrafficSource>): TrafficSource => ({
  id: 's', campaignId: 'sato-1', name: 'n', platform: 'facebook', accountId: 'a', accountIds: ['a'], catchrUrl: null,
  isActive: true, totalSpend: 0, totalLeads: 0, cpl: 0, revenue: 0, netProfit: 0, createdAt: '', ...over,
});
const sources: TrafficSource[] = [
  source({ id: 's1', name: 'Facebook - CH Hearing', totalSpend: 14527.53, totalLeads: 190, cpl: 76.46, revenue: 13440, netProfit: -1087.53, attribution: 'platform' }),
  source({ id: 's2', name: 'Google - CH A', platform: 'google', totalSpend: 100, netProfit: -100, attribution: 'shared' }),
  source({ id: 's3', name: 'Google - CH B', platform: 'google', totalSpend: 50, netProfit: -50, attribution: 'shared' }),
];

vi.mock('@/lib/hooks/use-campaigns', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-campaigns')>('@/lib/hooks/use-campaigns');
  return {
    ...actual,
    useCampaign: () => ({ data: campaign, isLoading: false, error: null }),
    useCampaignDeliveries: () => ({ data: [], isLoading: false }),
    useTrafficSources: () => ({ data: sources, isLoading: false }),
    useUpdateCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCatchrAccounts: () => ({ data: { configured: false, accounts: [] }, isLoading: false }),
    useCatchrPlatforms: () => ({ data: { platforms: [] }, isLoading: false }),
  };
});
vi.mock('@/lib/hooks/use-client-campaigns', () => ({ useUnlinkClientCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/lib/hooks/use-creatives', () => ({
  useCreatives: () => ({ data: [], isLoading: false }),
  useCreateCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubmitCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchCreativeSignedUrl: vi.fn(),
}));
vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  fetchFreshDownloadUrl: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { CampaignDetailPage } from '../pages/campaigns/detail';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes><Route path="/campaigns/:id" element={<CampaignDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignDetailPage — Sam S11 figures', () => {
  it('shows window cost with its ad-spend / LeadByte split and the window profit', () => {
    renderPage();
    expect(screen.getByTestId('window-cost-split')).toHaveTextContent('Ad spend £14,527.53 · LeadByte £0.00');
    expect(screen.getByTestId('window-profit')).toHaveTextContent('Profit -£1,087.53');
  });

  it('labels the headline tiles as year to date', () => {
    renderPage();
    expect(screen.getByText('Revenue · year to date')).toBeInTheDocument();
    expect(screen.getByText('Profit · year to date')).toBeInTheDocument();
  });

  it('lists a source with spend but no leads instead of drawing a £0 bar', () => {
    renderPage();
    expect(screen.getByTestId('spend-without-leads')).toHaveTextContent('Taboola £250.00');
  });

  it('marks shared Ad Account Links rows and keeps them out of the revenue total', () => {
    renderPage();
    expect(screen.getAllByText('— shared with another row on this platform')).toHaveLength(2);
    expect(screen.getByTestId('ad-links-note')).toHaveTextContent('2 rows share a platform');
    // Revenue/profit are labelled as covering only the rows with their own figures,
    // so spend − revenue ≠ profit can't be misread.
    expect(screen.getByTestId('ad-links-totals')).toHaveTextContent(
      '3 sources · last 30 days · spend £14,677.53 · on rows with their own figures: revenue £13,440.00, profit -£1,087.53',
    );
    const row = screen.getByText('Facebook - CH Hearing').closest('tr')!;
    expect(within(row).getByText('£13,440.00')).toBeInTheDocument();
  });

  it('links to the bulk ad-account screen', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Link ad accounts to clients in bulk/ })).toHaveAttribute('href', '/ad-accounts');
  });
});
