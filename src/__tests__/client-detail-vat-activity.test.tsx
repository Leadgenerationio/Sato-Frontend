/**
 * Feedback round 1 (29 Sep 2026) on the admin client-detail page:
 *   M5/S4 — Billing shows the client's VAT treatment, not "VAT Registered: Yes/No".
 *   S3    — the Activity timeline lists what changed ("VAT Registered: No → Yes").
 *   `?tab=activity` opens the Activity tab directly (links from elsewhere).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientDetail } from '@/lib/hooks/use-clients';

function makeClient(over: Partial<ClientDetail> = {}): ClientDetail {
  return {
    id: 'client-1',
    clientType: 'ppl',
    companyName: 'Acme Ltd',
    contactName: 'Jane Doe',
    contactEmail: 'jane@acme.co',
    status: 'onboarding',
    currency: 'GBP',
    creditScore: null,
    activeCampaigns: 0,
    totalRevenue: 0,
    createdAt: '2026-05-01T09:00:00Z',
    documentsCount: 0,
    companyNumber: '12345678',
    contactPhone: '+44...',
    address: '',
    addressLine: '1 High St',
    addressTown: 'London',
    addressCounty: '',
    addressCountry: 'United Kingdom',
    addressPostcode: 'SW1A 1AA',
    paymentTermsDays: 30,
    vatRegistered: false,
    addVatToInvoices: false,
    vatNumber: '',
    vatRate: 20,
    leadPrice: 25,
    billingWorkflow: 'manual',
    onboardingStatus: 'pending',
    agreementSigned: false,
    creditLastChecked: null,
    creditRiskRating: null,
    leadbyteClientId: null,
    endoleCompanyId: null,
    xeroContactId: null,
    notes: '',
    contacts: [],
    ...over,
  };
}

let mockClient: ClientDetail = makeClient();
let mockEvents: unknown[] = [];
const mutateAsync = vi.fn();

vi.mock('@/lib/hooks/use-clients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-clients')>('@/lib/hooks/use-clients');
  return {
    ...actual,
    useClient: () => ({ data: mockClient, isLoading: false, error: null }),
    useCreditHistory: () => ({ data: [], isLoading: false }),
    useRunCreditCheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClientDocuments: () => ({ data: [], isLoading: false }),
    useAddClientDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRemoveClientDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClientInvoices: () => ({ data: { invoices: [] }, isLoading: false, isError: false }),
    useSyncClientInvoices: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateClient: () => ({ mutateAsync, isPending: false }),
  };
});

// PortalUsersCard on client detail uses useAuth + fetches /api/v1/users.
// Mock both so the test doesn't try to make real network calls.
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-client-campaigns', () => ({
  useClientCampaigns: () => ({ data: [], isLoading: false }),
  useUnlinkClientCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-client-activity', () => ({
  useClientActivity: () => ({ data: mockEvents, isLoading: false }),
  useClientEmails: () => ({ data: [], isLoading: false }),
  useLogClientEmail: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteClientEmail: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  fetchFreshDownloadUrl: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/config/features', () => ({ features: { clientOnboardingStrip: false } }));

import { ClientDetailPage } from '../pages/clients/detail';

function renderPage(url = '/clients/client-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockClient = makeClient();
  mockEvents = [];
});

describe('ClientDetailPage — VAT treatment (M5/S4)', () => {
  it('shows the stored treatment and hides the rate when no VAT is charged', () => {
    mockClient = makeClient({ vatTreatment: 'reverse_charge', vatRegistered: true, vatNumber: 'PL5250007738' });
    renderPage();
    expect(screen.getByText('VAT treatment')).toBeInTheDocument();
    expect(screen.getByText('Reverse charge (EU / international B2B)')).toBeInTheDocument();
    expect(screen.getByText('PL5250007738')).toBeInTheDocument();
    expect(screen.queryByText('VAT Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('VAT Registered')).not.toBeInTheDocument();
  });

  it('shows the rate for standard-rate UK VAT', () => {
    mockClient = makeClient({ vatTreatment: 'uk_standard', vatRegistered: true, addVatToInvoices: true, vatRate: 20 });
    renderPage();
    expect(screen.getByText('UK VAT (standard rate)')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('derives the treatment for a backend that predates vat_treatment', () => {
    mockClient = makeClient({ vatRegistered: false, addVatToInvoices: false });
    renderPage();
    expect(screen.getByText('No VAT (outside scope)')).toBeInTheDocument();
  });
});

describe('ClientDetailPage — ?tab= and Activity diff (S3)', () => {
  const event = {
    id: 'ev-1', clientId: 'client-1', eventType: 'client_updated', actorName: 'Sam',
    createdAt: '2026-09-29T10:00:00Z',
    payload: { changed: ['vatRegistered', 'paymentTermsDays'], diff: {
      vatRegistered: { from: false, to: true },
      paymentTermsDays: { from: 30, to: 4 },
    } },
  };

  it('?tab=activity opens the Activity tab', () => {
    mockEvents = [event];
    renderPage('/clients/client-1?tab=activity');
    expect(screen.getByText('Activity timeline')).toBeInTheDocument();
  });

  it('lists each changed field as old → new', () => {
    mockEvents = [event];
    renderPage('/clients/client-1?tab=activity');
    expect(screen.getByText('Sam updated the client')).toBeInTheDocument();
    const items = Array.from(document.querySelectorAll('.cl-tl-diff li')).map((li) => li.textContent);
    expect(items).toEqual(['VAT Registered: No → Yes', 'Payment terms (days): 30 → 4']);
  });

  it('falls back to the field list for older entries without a diff', () => {
    mockEvents = [{ ...event, payload: { changed: ['clientType'] } }];
    renderPage('/clients/client-1?tab=activity');
    expect(screen.getByText('Sam updated clientType')).toBeInTheDocument();
    expect(document.querySelector('.cl-tl-diff')).toBeNull();
  });

  it('an unknown ?tab= falls back to Overview, and clicking a tab updates it', () => {
    renderPage('/clients/client-1?tab=nope');
    expect(screen.getByText('Billing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.getByText('Activity timeline')).toBeInTheDocument();
  });
});
