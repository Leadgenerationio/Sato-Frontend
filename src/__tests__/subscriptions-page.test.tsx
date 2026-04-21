import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubscriptionsPage } from '../pages/finance/subscriptions';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><SubscriptionsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SubscriptionsPage', () => {
  it('renders Subscriptions heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /subscriptions/i })).toBeInTheDocument();
  });

  it('renders subscription table with entries', () => {
    renderPage();
    expect(screen.getByText('LeadByte')).toBeInTheDocument();
    expect(screen.getByText('Xero Premium')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
  });

  it('renders Add Subscription button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add subscription/i })).toBeInTheDocument();
  });

  it('renders cost stat cards', () => {
    renderPage();
    expect(screen.getByText('Monthly Cost')).toBeInTheDocument();
    expect(screen.getByText('Annual Cost')).toBeInTheDocument();
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
  });
});
