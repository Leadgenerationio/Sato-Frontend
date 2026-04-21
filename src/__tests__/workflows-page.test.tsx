import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowsPage } from '../pages/workflows/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-workflows', () => ({
  useWorkflows: () => ({
    data: [
      { id: 'wf-1', name: 'Weekly Auto-Invoice', description: 'Monday 9 AM', type: 'scheduled', schedule: 'Every Monday 9:00 AM', status: 'active', lastRunAt: '2026-04-14T09:00:00Z', nextRunAt: '2026-04-21T09:00:00Z', totalRuns: 28, successRate: 96.4 },
      { id: 'wf-2', name: 'Monthly Validated Invoice', description: '1st of month', type: 'scheduled', schedule: '1st of month', status: 'active', lastRunAt: null, nextRunAt: null, totalRuns: 6, successRate: 100 },
      { id: 'wf-3', name: 'Invoice Chasing', description: 'Daily 9 AM', type: 'scheduled', schedule: 'Daily 9:00 AM', status: 'active', lastRunAt: null, nextRunAt: null, totalRuns: 180, successRate: 100 },
    ],
    isLoading: false,
    error: null,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><WorkflowsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorkflowsPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /workflows/i })).toBeInTheDocument();
  });

  it('renders all 3 workflows', () => {
    renderPage();
    expect(screen.getByText('Weekly Auto-Invoice')).toBeInTheDocument();
    expect(screen.getByText('Monthly Validated Invoice')).toBeInTheDocument();
    expect(screen.getByText('Invoice Chasing')).toBeInTheDocument();
  });

  it('shows active status badges', () => {
    renderPage();
    const badges = screen.getAllByText(/active/i);
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it('shows run counts', () => {
    renderPage();
    expect(screen.getByText('28 runs')).toBeInTheDocument();
    expect(screen.getByText('180 runs')).toBeInTheDocument();
  });
});
