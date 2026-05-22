/**
 * Item 2 (2026-05-22): Sam asked for LeadByte's per-buyer caps to be surfaced
 * on Campaign Detail. The backend already widened the supplier-spend / deliveries
 * response to include caps (see CampaignDelivery in use-campaigns.ts) and a
 * "Buyer caps & delivery rules" table renders them. This test pins that the
 * Daily Cap (and other windows) actually reach the DOM, so a future refactor
 * dropping the column gets caught.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CampaignDelivery, CampaignDetail } from '@/lib/hooks/use-campaigns';

function makeCampaign(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'camp-1',
    name: 'Solar Panel Leads',
    clientName: 'Apex Media',
    vertical: 'Solar',
    status: 'active',
    campaignType: 'pay_per_lead',
    leadPrice: 12.5,
    currency: 'GBP',
    totalLeads: 500,
    leadsToday: 20,
    leadsThisWeek: 100,
    leadsThisMonth: 400,
    totalRevenue: 5000,
    totalCost: 2000,
    cpl: 4,
    margin: 60,
    startDate: '2025-09-01',
    satoId: null,
    costPerLead: null,
    linkedClients: [],
    leadDeliveries: [],
    suppliers: [],
    ...over,
  };
}

function makeDelivery(over: Partial<CampaignDelivery> = {}): CampaignDelivery {
  return {
    id: 'd-1',
    reference: 'solar-buyer-a',
    status: 'Active',
    buyer: { id: 'buyer-a', name: 'Acme Solar' },
    caps: { day: 250, week: 1500, month: 6000, total: null },
    ...over,
  };
}

const deliveriesData: CampaignDelivery[] = [
  makeDelivery({
    id: 'd-1',
    buyer: { id: 'b-a', name: 'Acme Solar' },
    caps: { day: 250, week: 1500, month: 6000, total: null },
  }),
  makeDelivery({
    id: 'd-2',
    buyer: { id: 'b-b', name: 'Bright Buyers Ltd' },
    caps: { day: 1234, week: null, month: null, total: 50_000 },
  }),
];

vi.mock('@/lib/hooks/use-campaigns', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-campaigns')>('@/lib/hooks/use-campaigns');
  return {
    ...actual,
    useCampaign: () => ({ data: makeCampaign(), isLoading: false, error: null }),
    useCampaignDeliveries: () => ({ data: deliveriesData, isLoading: false }),
    useTrafficSources: () => ({ data: [], isLoading: false }),
    useUpdateCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCatchrAccounts: () => ({ data: { configured: false, accounts: [] }, isLoading: false }),
    useCatchrPlatforms: () => ({ data: { platforms: [] }, isLoading: false }),
  };
});

vi.mock('@/lib/hooks/use-client-campaigns', () => ({
  useUnlinkClientCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-creatives', () => ({
  useCreatives: () => ({ data: [], isLoading: false }),
  useCreateCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubmitCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  fetchFreshDownloadUrl: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { CampaignDetailPage } from '../pages/campaigns/detail';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignDetailPage — buyer-caps table', () => {
  it('renders the "Buyer caps & delivery rules" section heading', () => {
    renderPage();
    expect(screen.getByText(/Buyer caps & delivery rules/i)).toBeInTheDocument();
  });

  it('renders the per-buyer rows with day-cap values', () => {
    renderPage();
    // Buyer names from the mocked /deliveries response.
    expect(screen.getByText('Acme Solar')).toBeInTheDocument();
    expect(screen.getByText('Bright Buyers Ltd')).toBeInTheDocument();
    // Day caps — locale-formatted with UK separators.
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders the wider cap columns (week / month / total) and empty-state placeholders', () => {
    renderPage();
    // Week 1,500 and month 6,000 from row A.
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('6,000')).toBeInTheDocument();
    // Row B has a 50,000 total cap.
    expect(screen.getByText('50,000')).toBeInTheDocument();
    // The em-dash placeholder is used for null cap fields. With row A
    // (total=null) and row B (week=null, month=null) we expect at least 3
    // dashes in the table body.
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});
