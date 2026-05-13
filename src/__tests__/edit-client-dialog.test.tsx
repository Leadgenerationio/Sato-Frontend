import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditClientDialog } from '../components/clients/edit-client-dialog';
import type { ClientDetail } from '../lib/hooks/use-clients';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b1', clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/use-clients', () => ({
  useUpdateClient: () => ({
    mutateAsync: mockMutate,
    isPending: false,
  }),
}));

// Minimal sonner mock so toast.success doesn't blow up in jsdom.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseClient: ClientDetail = {
  id: 'client-1',
  companyName: 'Acme Ltd',
  companyNumber: '12345678',
  contactName: 'Jamie Roberts',
  contactEmail: 'jamie@acme.co.uk',
  contactPhone: '+44 20 1234 5678',
  address: '',
  addressLine: '10 Fleet Street',
  addressTown: 'London',
  addressCounty: 'Greater London',
  addressCountry: 'United Kingdom',
  addressPostcode: 'EC4Y 1AA',
  status: 'active',
  currency: 'GBP',
  paymentTermsDays: 30,
  vatRegistered: false,
  addVatToInvoices: false,
  vatNumber: '',
  vatRate: 20,
  leadPrice: 50,
  billingWorkflow: 'weekly_auto',
  onboardingStatus: 'active',
  agreementSigned: true,
  creditScore: 75,
  creditLastChecked: null,
  creditRiskRating: null,
  leadbyteClientId: null,
  endoleCompanyId: null,
  xeroContactId: null,
  notes: '',
  activeCampaigns: 0,
  totalRevenue: 0,
  createdAt: '2026-01-01T00:00:00Z',
  contacts: [
    { id: 'c1', contactType: 'primary', name: 'Jamie Roberts', email: 'jamie@acme.co.uk', phone: '+44 20 1234 5678', role: 'Director' },
  ],
};

function renderDialog(open = true, onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EditClientDialog client={baseClient} open={open} onOpenChange={onOpenChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockMutate.mockReset();
  mockMutate.mockResolvedValue({ ...baseClient });
});

describe('EditClientDialog', () => {
  it('renders the dialog with the client name pre-populated', () => {
    renderDialog();
    expect(screen.getByText('Edit Client')).toBeInTheDocument();
    const companyInput = screen.getByDisplayValue('Acme Ltd');
    expect(companyInput).toBeInTheDocument();
  });

  it('pre-populates the primary contact fields from client.contacts', () => {
    renderDialog();
    expect(screen.getByDisplayValue('Jamie Roberts')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jamie@acme.co.uk')).toBeInTheDocument();
  });

  it('calls useUpdateClient with updated companyName on submit', async () => {
    renderDialog();
    const companyInput = screen.getByDisplayValue('Acme Ltd');
    fireEvent.change(companyInput, { target: { value: 'New Name Ltd' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'client-1', companyName: 'New Name Ltd' }),
      );
    });
  });

  it('does not submit and shows no mutate call when companyName is cleared', async () => {
    renderDialog();
    const companyInput = screen.getByDisplayValue('Acme Ltd');
    fireEvent.change(companyInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    // mutate should NOT be called — validation blocked it
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('cancel button closes without calling mutate', () => {
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
