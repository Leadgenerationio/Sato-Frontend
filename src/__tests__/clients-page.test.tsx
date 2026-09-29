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
        { id: 'c-2', companyName: 'Delta Solutions', contactName: 'Laura Davies', contactEmail: 'pay@delta.co.uk', status: 'churned', currency: 'GBP', creditScore: 42, activeCampaigns: 0, totalRevenue: 12400, createdAt: '2025-07-01' },
        // Feedback M3/M4 fixtures: an active EUR client with no signed
        // agreement, and a paused client.
        { id: 'c-3', companyName: 'Sonova EUR', contactName: 'Sam', contactEmail: 's@x.pl', status: 'active', agreementSigned: false, documentsCount: 2, currency: 'EUR', creditScore: null, activeCampaigns: 0, totalRevenue: 399791, revenueByCurrency: { EUR: 399791, GBP: 50 }, createdAt: '2025-08-01' },
        { id: 'c-4', companyName: 'Paused Co', contactName: 'P', contactEmail: 'p@x.uk', status: 'paused', agreementSigned: true, documentsCount: 1, currency: 'GBP', creditScore: null, activeCampaigns: 0, totalRevenue: 0, createdAt: '2025-08-02' },
      ],
      total: 4,
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

  it('renders All / Onboarding / Active / Paused / Churned tabs (feedback M4)', () => {
    renderPage();
    const tabs = Array.from(document.querySelectorAll('.inv-tab')).map((el) => el.textContent);
    expect(tabs).toEqual(['All', 'Onboarding', 'Active', 'Paused', 'Churned']);
  });

  it('shows the STORED status — an active client without a signed agreement stays Active, with a warning badge', () => {
    renderPage();
    const row = screen.getByText('Sonova EUR').closest('tr')!;
    expect(row.textContent).toContain('Active');
    expect(row.textContent).not.toContain('Onboarding');
    expect(row.textContent).toContain('No signed agreement');
  });

  it('shows paused as Paused, not "Client Churned"', () => {
    renderPage();
    const row = screen.getByText('Paused Co').closest('tr')!;
    expect(row.querySelector('.pill')?.textContent).toBe('Paused');
    expect(row.textContent).not.toMatch(/churned/i);
  });

  it('formats revenue in the client currency and lists other-currency revenue separately (feedback M3)', () => {
    renderPage();
    const row = screen.getByText('Sonova EUR').closest('tr')!;
    expect(row.textContent).toContain('€399,791.00');
    expect(row.textContent).not.toContain('£399,791.00');
    expect(row.textContent).toContain('+ £50.00');
    // A GBP client still reads in pounds.
    expect(screen.getByText('Apex Media Ltd').closest('tr')!.textContent).toContain('£45,200.00');
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
