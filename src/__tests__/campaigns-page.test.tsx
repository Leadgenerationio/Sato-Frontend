import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampaignsPage } from '../pages/campaigns/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-campaigns', () => ({
  useCampaigns: () => ({
    data: {
      campaigns: [
        { id: 'lb-1', name: 'Solar Panel Leads', clientName: 'Apex Media', vertical: 'Solar', status: 'active', leadPrice: 12.5, currency: 'GBP', totalLeads: 500, leadsToday: 20, leadsThisWeek: 100, leadsThisMonth: 400, totalRevenue: 5000, totalCost: 2000, cpl: 4, margin: 60, startDate: '2025-09-01' },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
    error: null,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><CampaignsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignsPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /campaigns/i })).toBeInTheDocument();
  });

  it('renders campaign in table', () => {
    renderPage();
    expect(screen.getByText('Solar Panel Leads')).toBeInTheDocument();
    expect(screen.getByText('Apex Media')).toBeInTheDocument();
    expect(screen.getByText('Solar')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    renderPage();
    expect(screen.getAllByText(/^all$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^active$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^paused$/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/search campaigns/i)).toBeInTheDocument();
  });
});
