/**
 * Item 1 (2026-05-22) audit verification: Sam's 2026-05-15 ask was to surface
 * the onboarding lifecycle WITHOUT a dedicated "Onboarding" tab. Audit found
 * no such tab exists — the 7 tabs are Overview/Campaigns/Invoices/Credit/
 * Documents/Emails/Activity, and the <OnboardingProgress> strip renders
 * inline above <Tabs>. This test pins that structural invariant so a future
 * refactor that hides the stage strip again gets caught.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientDetail } from '@/lib/hooks/use-clients';

function makeClient(over: Partial<ClientDetail> = {}): ClientDetail {
  return {
    id: 'client-1',
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

vi.mock('@/lib/hooks/use-clients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-clients')>('@/lib/hooks/use-clients');
  return {
    ...actual,
    useClient: () => ({ data: makeClient(), isLoading: false, error: null }),
    useCreditHistory: () => ({ data: [], isLoading: false }),
    useRunCreditCheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClientDocuments: () => ({ data: [], isLoading: false }),
    useAddClientDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRemoveClientDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClientInvoices: () => ({ data: { invoices: [] }, isLoading: false, isError: false }),
    useSyncClientInvoices: () => ({ mutateAsync: vi.fn(), isPending: false }),
    // Sam (2026-05-27): admin-side "Mark as signed (external)" override
    // on the onboarding strip uses useUpdateClient. Stub it so the test
    // doesn't try to hit the network.
    useUpdateClient: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

describe('ClientDetailPage — onboarding-strip inline (no dedicated tab)', () => {
  it('renders the stage strip ("Stage X of 4") above the tabs', () => {
    renderPage();
    // The strip surfaces a "Stage N of 4" line — matches the existing
    // OnboardingProgress contract (see onboarding-progress.test.tsx).
    expect(screen.getByText(/Stage \d of 4/)).toBeInTheDocument();
  });

  it('has NO dedicated "Onboarding" tab — the 7 tabs are O/C/I/C/D/E/A', () => {
    const { container } = renderPage();
    // Tabs are Statto segmented buttons (.seg-btn). Querying all of them lets us
    // assert both the count and the absence of an "Onboarding" trigger.
    const triggers = Array.from(container.querySelectorAll('.seg-btn'));
    expect(triggers).toHaveLength(7);
    for (const trigger of triggers) {
      expect(trigger.textContent?.toLowerCase()).not.toBe('onboarding');
    }
    // The 7 expected labels are the current contract.
    const labels = triggers.map((t) => t.textContent?.trim());
    expect(labels).toEqual([
      'Overview', 'Campaigns', 'Invoices', 'Credit',
      'Documents', 'Emails', 'Activity',
    ]);
  });

  it('renders the stage strip BEFORE the tab strip in DOM order', () => {
    const { container } = renderPage();
    const stageStrip = screen.getByText(/Stage \d of 4/);
    const tabStrip = container.querySelector('.seg');
    expect(tabStrip).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING (4) means the tab strip comes AFTER the stage
    // strip, i.e. the strip is above the tabs in the rendered DOM.
    const pos = stageStrip.compareDocumentPosition(tabStrip!);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
