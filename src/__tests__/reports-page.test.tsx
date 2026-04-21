import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsHubPage } from '../pages/reports/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><ReportsHubPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportsHubPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
  });

  it('renders all 5 report cards', () => {
    renderPage();
    expect(screen.getByText('Campaign Performance')).toBeInTheDocument();
    expect(screen.getByText('Client P&L')).toBeInTheDocument();
    expect(screen.getByText('Supplier Performance')).toBeInTheDocument();
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
    expect(screen.getByText('Ad Spend')).toBeInTheDocument();
  });

  it('renders report descriptions', () => {
    renderPage();
    expect(screen.getByText(/leads, cost, revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/per-client monthly/i)).toBeInTheDocument();
  });
});
