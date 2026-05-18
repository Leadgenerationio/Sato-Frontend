import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SendAgreementDialog } from '../pages/agreements';
import type { ClientDetail, ClientSummary } from '../lib/hooks/use-clients';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b1', clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const clientA: ClientDetail = {
  id: 'client-a',
  companyName: 'Acme Ltd',
  companyNumber: '12345678',
  contactName: 'Jamie Roberts',
  contactEmail: 'jamie@acme.co.uk',
  contactPhone: '',
  address: '',
  addressLine: '',
  addressTown: '',
  addressCounty: '',
  addressCountry: '',
  addressPostcode: '',
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
  agreementSigned: false,
  creditScore: null,
  creditLastChecked: null,
  creditRiskRating: null,
  leadbyteClientId: null,
  endoleCompanyId: null,
  xeroContactId: null,
  notes: '',
  activeCampaigns: 0,
  totalRevenue: 0,
  createdAt: '2026-01-01T00:00:00Z',
  contacts: [],
  documentsCount: 0,
};

const clientB: ClientDetail = {
  ...clientA,
  id: 'client-b',
  companyName: 'Beta Co',
  contactName: 'Priya Singh',
  contactEmail: 'priya@beta.co.uk',
};

const clientSummary = (c: ClientDetail): ClientSummary => ({
  id: c.id,
  companyName: c.companyName,
  contactName: c.contactName,
  contactEmail: c.contactEmail,
  status: c.status,
  currency: c.currency,
  creditScore: c.creditScore,
  activeCampaigns: c.activeCampaigns,
  totalRevenue: c.totalRevenue,
  createdAt: c.createdAt,
  agreementSigned: c.agreementSigned,
  documentsCount: c.documentsCount,
});

vi.mock('@/lib/hooks/use-clients', () => ({
  useClients: () => ({
    data: { clients: [clientSummary(clientA), clientSummary(clientB)], total: 2, page: 1, pageSize: 100 },
  }),
  useClient: (id: string) => ({
    data: id === clientA.id ? clientA : id === clientB.id ? clientB : undefined,
  }),
}));

vi.mock('@/lib/hooks/use-agreements', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/use-agreements')>(
    '../lib/hooks/use-agreements',
  );
  return {
    ...actual,
    useAgreements: () => ({ data: [], isLoading: false }),
    useSendAgreement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRefreshAgreementStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock('@/lib/hooks/use-agreement-templates', () => ({
  useAgreementTemplates: () => ({ data: [] }),
  usePreviewAgreementTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SendAgreementDialog open={true} onOpenChange={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SendAgreementDialog — auto-fill signer from selected client', () => {
  it('signer name + email start empty when no client is selected', () => {
    renderDialog();
    const signerName = screen.getByLabelText(/Signer name/i) as HTMLInputElement;
    const signerEmail = screen.getByLabelText(/Signer email/i) as HTMLInputElement;
    expect(signerName.value).toBe('');
    expect(signerEmail.value).toBe('');
  });

  it('auto-fills signer name + email with the chosen client\'s contact details when the dropdown changes', async () => {
    renderDialog();
    const clientSelect = screen.getByLabelText(/^Client$/i) as HTMLSelectElement;
    fireEvent.change(clientSelect, { target: { value: clientA.id } });

    await waitFor(() => {
      const signerName = screen.getByLabelText(/Signer name/i) as HTMLInputElement;
      expect(signerName.value).toBe('Jamie Roberts');
    });
    const signerEmail = screen.getByLabelText(/Signer email/i) as HTMLInputElement;
    expect(signerEmail.value).toBe('jamie@acme.co.uk');
  });

  it('overwrites signer fields when switching from one client to another', async () => {
    renderDialog();
    const clientSelect = screen.getByLabelText(/^Client$/i) as HTMLSelectElement;
    fireEvent.change(clientSelect, { target: { value: clientA.id } });
    await waitFor(() => {
      expect((screen.getByLabelText(/Signer name/i) as HTMLInputElement).value).toBe('Jamie Roberts');
    });
    fireEvent.change(clientSelect, { target: { value: clientB.id } });
    await waitFor(() => {
      expect((screen.getByLabelText(/Signer name/i) as HTMLInputElement).value).toBe('Priya Singh');
    });
    expect((screen.getByLabelText(/Signer email/i) as HTMLInputElement).value).toBe('priya@beta.co.uk');
  });
});
