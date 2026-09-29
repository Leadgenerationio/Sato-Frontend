/**
 * Feedback round 1 (29 Sep 2026) on the admin client-detail page:
 *   M4 — the header shows the STORED status; a missing agreement/documents is a
 *        separate warning badge (it used to relabel Active as "Onboarding").
 *   S1 — the client-type switch moves instantly, shows "Saving…", ignores
 *        repeat clicks while saving and snaps back with a clear toast on failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientDetail } from '@/lib/hooks/use-clients';
import { toast } from 'sonner';

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
  useClientActivity: () => ({ data: [], isLoading: false }),
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/clients/client-1']}>
        <Routes>
          <Route path="/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockClient = makeClient();
  mutateAsync.mockReset();
  vi.mocked(toast.error).mockClear();
});

describe('ClientDetailPage — stored status (M4)', () => {
  it('an active client with no signed agreement reads Active + warning badges, never Onboarding', () => {
    mockClient = makeClient({ status: 'active', agreementSigned: false });
    const { container } = renderPage();
    const head = container.querySelector('.page-head')!;
    const pills = Array.from(head.querySelectorAll('.pill')).map((p) => p.textContent?.trim());
    expect(pills).toEqual(['Active', 'No signed agreement', 'No documents']);
  });

  it('a paused client reads Paused', () => {
    mockClient = makeClient({ status: 'paused' });
    const { container } = renderPage();
    expect(container.querySelector('.page-head .pill')?.textContent).toBe('Paused');
  });
});

describe('ClientDetailPage — client-type switch (S1)', () => {
  it('moves instantly, shows Saving…, and ignores repeat clicks until the save settles', async () => {
    const d = deferred();
    mutateAsync.mockReturnValue(d.promise);
    renderPage();
    const sw = screen.getByRole('switch', { name: /client type/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(sw);
    fireEvent.click(sw);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'client-1', clientType: 'managed' });

    await act(async () => { d.resolve(); await d.promise; });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(sw).not.toBeDisabled();
  });

  it('snaps back and says nothing was saved when the save fails', async () => {
    const d = deferred();
    mutateAsync.mockReturnValue(d.promise);
    renderPage();
    const sw = screen.getByRole('switch', { name: /client type/i });
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');

    await act(async () => { d.reject(new Error('Network down')); await d.promise.catch(() => {}); });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/still Pay-per-lead.*Nothing was saved.*Network down/));
  });
});
