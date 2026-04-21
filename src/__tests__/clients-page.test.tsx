import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientsPage } from '../pages/clients/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-clients', () => ({
  useClients: () => ({
    data: {
      clients: [
        { id: 'c-1', companyName: 'Apex Media Ltd', contactName: 'James Wright', contactEmail: 'billing@apex.co.uk', status: 'active', currency: 'GBP', creditScore: 82, activeCampaigns: 2, totalRevenue: 45200, createdAt: '2025-06-15' },
        { id: 'c-2', companyName: 'Delta Solutions', contactName: 'Laura Davies', contactEmail: 'pay@delta.co.uk', status: 'paused', currency: 'GBP', creditScore: 42, activeCampaigns: 0, totalRevenue: 12400, createdAt: '2025-07-01' },
      ],
      total: 2,
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
      <MemoryRouter><ClientsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ClientsPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /clients/i })).toBeInTheDocument();
  });

  it('renders clients in table', () => {
    renderPage();
    expect(screen.getByText('Apex Media Ltd')).toBeInTheDocument();
    expect(screen.getByText('Delta Solutions')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    renderPage();
    expect(screen.getAllByText(/^all$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^active$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^prospect$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^churned$/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders credit scores', () => {
    renderPage();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders new client button', () => {
    renderPage();
    expect(screen.getByText('New Client')).toBeInTheDocument();
  });
});
