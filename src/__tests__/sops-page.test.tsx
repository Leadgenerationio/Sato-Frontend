import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SopsPage } from '../pages/sops/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-sops', () => ({
  useSops: () => ({
    data: {
      sops: [
        { id: 'sop-1', title: 'New Client Onboarding Procedure', content: 'Onboarding steps...', category: 'Onboarding', version: '2.1', author: 'Sam Owner', lastUpdated: '2026-04-10T09:00:00Z', status: 'published' },
        { id: 'sop-2', title: 'Weekly Invoice Batch Review', content: 'Invoice review steps...', category: 'Finance', version: '1.3', author: 'Finance Admin', lastUpdated: '2026-04-08T14:00:00Z', status: 'published' },
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    },
    isLoading: false,
    error: null,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><SopsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SopsPage', () => {
  it('renders page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /sops/i })).toBeInTheDocument();
  });

  it('renders SOP cards', () => {
    renderPage();
    expect(screen.getByText('New Client Onboarding Procedure')).toBeInTheDocument();
    expect(screen.getByText('Weekly Invoice Batch Review')).toBeInTheDocument();
    expect(screen.getByText('Sam Owner')).toBeInTheDocument();
    expect(screen.getByText('Finance Admin')).toBeInTheDocument();
  });

  it('renders category tabs', () => {
    renderPage();
    expect(screen.getAllByText(/^all$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^operations$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^finance$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^onboarding$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^compliance$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^campaigns$/i).length).toBeGreaterThanOrEqual(1);
  });
});
