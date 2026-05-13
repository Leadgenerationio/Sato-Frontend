import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddCampaignDialog } from '../components/clients/add-campaign-dialog';

// ── auth mock (required by the api layer in test env) ──────────────────────
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b1', clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// ── hoist shared mocks ─────────────────────────────────────────────────────
const { mockLinkMutate } = vi.hoisted(() => ({
  mockLinkMutate: vi.fn(),
}));

// ── hook mocks ─────────────────────────────────────────────────────────────
vi.mock('@/lib/hooks/use-campaigns', () => ({
  useCampaigns: () => ({
    data: {
      campaigns: [
        { id: 'camp-1', name: 'Solar UK', vertical: 'solar', status: 'active', leadPrice: 30, currency: 'GBP', totalLeads: 0, leadsToday: 0, leadsThisWeek: 0, leadsThisMonth: 0, totalRevenue: 0, totalCost: 0, cpl: 0, margin: 0, startDate: '2026-01-01', clientName: '', campaignType: 'pay_per_lead' },
        { id: 'camp-2', name: 'Finance UK', vertical: 'finance', status: 'active', leadPrice: 20, currency: 'GBP', totalLeads: 0, leadsToday: 0, leadsThisWeek: 0, leadsThisMonth: 0, totalRevenue: 0, totalCost: 0, cpl: 0, margin: 0, startDate: '2026-01-01', clientName: '', campaignType: 'pay_per_lead' },
      ],
      total: 2,
      page: 1,
      pageSize: 200,
    },
    isLoading: false,
  }),
}));

vi.mock('@/lib/hooks/use-client-campaigns', () => ({
  useClientCampaigns: () => ({
    // camp-2 is already linked → should be filtered out of the dropdown
    data: [{ id: 'camp-2', name: 'Finance UK', vertical: 'finance', status: 'active', costPerLead: null, leadPrice: null }],
    isLoading: false,
  }),
  useLinkClientCampaign: () => ({
    mutateAsync: mockLinkMutate,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── helpers ────────────────────────────────────────────────────────────────
function renderDialog(open = true, onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AddCampaignDialog clientId="client-1" open={open} onOpenChange={onOpenChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockLinkMutate.mockReset();
  mockLinkMutate.mockResolvedValue(undefined);
});

describe('AddCampaignDialog', () => {
  it('renders the dialog when open', () => {
    renderDialog();
    // Dialog title + submit button both say "Add Campaign"; query by heading role.
    expect(screen.getByRole('heading', { name: 'Add Campaign' })).toBeInTheDocument();
  });

  it('shows only unlinked campaigns in the dropdown', () => {
    renderDialog();
    // Solar UK should be visible (not yet linked)
    expect(screen.getByText(/Solar UK/)).toBeInTheDocument();
    // Finance UK is already linked → must not appear
    expect(screen.queryByText(/Finance UK/)).not.toBeInTheDocument();
  });

  it('calls useLinkClientCampaign with the selected campaign and clientId on submit', async () => {
    renderDialog();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'camp-1' } });
    fireEvent.click(screen.getByRole('button', { name: /add campaign/i }));
    await waitFor(() => {
      expect(mockLinkMutate).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'camp-1', clientId: 'client-1' }),
      );
    });
  });

  it('does not call mutate when no campaign is selected', async () => {
    renderDialog();
    // No selection change — default is empty
    fireEvent.click(screen.getByRole('button', { name: /add campaign/i }));
    expect(mockLinkMutate).not.toHaveBeenCalled();
  });

  it('cancel button closes without calling mutate', () => {
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockLinkMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
