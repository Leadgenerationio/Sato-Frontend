/**
 * The onboarding stage strip (<OnboardingProgress>, "Stage X of 4") was
 * removed from the admin client-detail page on request (2026-06-15) — the
 * lifecycle is no longer surfaced inline above the tabs. This test pins that:
 * the strip must NOT render, and the page still shows its 7 tabs (Overview/
 * Campaigns/Invoices/Credit/Documents/Emails/Activity) with no dedicated
 * "Onboarding" tab. (The <OnboardingProgress> component itself is still
 * exported and unit-tested directly in onboarding-progress.test.tsx.)
 *
 * Note: tabs render as `.seg-btn` <button> elements, not Radix role="tab".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// The strip is gated behind features.clientOnboardingStrip. Mock the flag as a
// mutable object so each test can set the state it exercises (the component
// reads the property at render time, so mutating before render() takes effect).
vi.mock('@/config/features', () => ({
  features: { clientOnboardingStrip: false },
}));
import { features } from '@/config/features';

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

describe('ClientDetailPage — onboarding strip (feature-flagged)', () => {
  it('does NOT render the stage strip when the flag is off (default)', () => {
    features.clientOnboardingStrip = false;
    renderPage();
    // The onboarding strip was removed from the detail page (2026-06-15).
    expect(screen.queryByText(/Stage \d of 4/)).not.toBeInTheDocument();
  });

  it('renders the stage strip ("Stage X of 4") when the flag is on', () => {
    features.clientOnboardingStrip = true;
    try {
      renderPage();
      // Re-enabled via VITE_FEATURE_CLIENT_ONBOARDING_STRIP=1.
      expect(screen.getByText(/Stage \d of 4/)).toBeInTheDocument();
    } finally {
      features.clientOnboardingStrip = false;
    }
  });

  it('has NO dedicated "Onboarding" tab — the 7 tabs are O/C/I/C/D/E/A', () => {
    const { container } = renderPage();
    // Tabs render as `.seg-btn` <button> elements (not Radix role="tab").
    const triggers = Array.from(container.querySelectorAll('.seg.cl-detail-seg .seg-btn'));
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
});
