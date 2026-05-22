import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampaignDetailPage } from '../pages/campaigns/detail';

// Sam's #1 ask from the 2026-05-15 meeting: the Campaign Detail "Add source"
// row should drive supplier + ad-account from Catchr's connected list (like
// leadreports.io's NCP picker), not a hand-pasted URL. This test pins the
// wiring so:
//   (a) The supplier <select> is auto-populated from useCatchrPlatforms
//   (b) When a supplier is picked, useCatchrAccounts is called and the
//       account checkboxes from Catchr render in the picker.
//   (c) The manual-URL escape hatch shows when no platform accounts are
//       available — so a Catchr outage never blocks the operator.

// ── auth mock ───────────────────────────────────────────────────────────────
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'owner@stato.app',
      name: 'Owner',
      role: 'owner',
      isActive: true,
      businessId: 'b1',
      clientId: null,
    },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// ── recharts is heavy — stub the bits CampaignDetailPage renders so jsdom
//    doesn't blow up on canvas measurement. We don't care about chart output
//    here; we only care about the Traffic Sources card.
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: Stub,
    BarChart: Stub,
    Bar: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    Legend: Stub,
  };
});

// ── sonner ──────────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── hooks mocks ─────────────────────────────────────────────────────────────
const { mockCatchrAccounts, mockCreateTrafficSource } = vi.hoisted(() => ({
  mockCatchrAccounts: vi.fn(),
  mockCreateTrafficSource: vi.fn(),
}));

vi.mock('@/lib/hooks/use-campaigns', () => ({
  useCampaign: () => ({
    data: {
      id: 'camp-1',
      satoId: 'sato-1',
      name: 'Solar UK',
      clientName: 'Apex Media',
      vertical: 'Solar',
      status: 'active',
      campaignType: 'pay_per_lead',
      leadPrice: 30,
      currency: 'GBP',
      totalLeads: 0,
      leadsToday: 0,
      leadsThisWeek: 0,
      leadsThisMonth: 0,
      totalRevenue: 0,
      totalCost: 0,
      cpl: 0,
      margin: 0,
      startDate: '2026-01-01',
      costPerLead: null,
      linkedClients: [],
      leadDeliveries: [],
      suppliers: [],
    },
    isLoading: false,
    error: null,
  }),
  useCampaignDeliveries: () => ({ data: [], isLoading: false }),
  useTrafficSources: () => ({ data: [], isLoading: false }),
  useUpdateCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTrafficSource: () => ({
    mutateAsync: mockCreateTrafficSource,
    isPending: false,
  }),
  useUpdateTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTrafficSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCatchrPlatforms: () => ({
    data: {
      configured: true,
      platforms: [
        { id: 'facebook-ads', name: 'Facebook Ads', connected: true },
        { id: 'google-ads', name: 'Google Ads', connected: true },
        { id: 'tik-tok', name: 'Tik Tok Ads', connected: false },
      ],
    },
    isLoading: false,
  }),
  useCatchrAccounts: (platform?: string) => mockCatchrAccounts(platform),
}));

vi.mock('@/lib/hooks/use-creatives', () => ({
  useCreatives: () => ({ data: [], isLoading: false }),
  useCreateCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubmitCreative: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-client-campaigns', () => ({
  useUnlinkClientCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-uploads', () => ({
  fetchFreshDownloadUrl: vi.fn().mockResolvedValue(''),
  useFileUpload: () => ({
    upload: vi.fn(),
    isUploading: false,
    error: null,
  }),
  useUploadUrl: () => ({ data: '', isLoading: false }),
  fetchPresignedUpload: vi.fn(),
  uploadFileToR2: vi.fn(),
}));

// ── helpers ─────────────────────────────────────────────────────────────────
function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCatchrAccounts.mockReset();
  mockCreateTrafficSource.mockReset();
  mockCreateTrafficSource.mockResolvedValue(undefined);
  // Default: Facebook returns two accounts; everything else returns empty.
  mockCatchrAccounts.mockImplementation((platform?: string) => {
    if (platform === 'facebook-ads') {
      return {
        data: {
          configured: true,
          accounts: [
            { id: '111', name: 'Solar UK · FB',     platform: 'facebook-ads', sourceName: 'fb-src' },
            { id: '222', name: 'Solar UK · FB 2',   platform: 'facebook-ads', sourceName: 'fb-src' },
          ],
        },
        isLoading: false,
      };
    }
    return { data: { configured: true, accounts: [] }, isLoading: false };
  });
});

describe('CampaignDetailPage — Catchr supplier + account picker (Sam 2026-05-15)', () => {
  it('renders the Ad Account Links card and Add source button', () => {
    renderDetail();
    expect(screen.getByText(/Ad Account Links/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add source/i })).toBeInTheDocument();
  });

  it('populates the supplier dropdown from useCatchrPlatforms when Add source is clicked', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));

    // The new row contains the supplier <select>. Both connected Catchr
    // platforms (Facebook, Google) plus baseline extras + "Other" should
    // all show up as <option>s.
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    // The supplier select is the only <select> in the table row.
    const supplier = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === 'facebook-ads'),
    );
    expect(supplier).toBeDefined();
    const optionValues = Array.from(supplier!.options).map((o) => o.value);
    expect(optionValues).toContain('facebook-ads');
    expect(optionValues).toContain('google-ads');
    expect(optionValues).toContain('other'); // Manual-entry escape hatch
  });

  it('renders Catchr ad-account checkboxes for the selected platform', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));

    // Default first supplier is the first connected (Facebook Ads).
    // Catchr's two ad accounts should each render in the picker.
    expect(screen.getByText('Solar UK · FB')).toBeInTheDocument();
    expect(screen.getByText('Solar UK · FB 2')).toBeInTheDocument();

    // The "X selected" counter starts at 0.
    expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
  });

  it('falls back to manual-URL entry when Catchr returns no accounts for the platform', () => {
    // Pin the supplier select to Google by toggling the dropdown — Google's
    // mock returns an empty account list, which should swap the picker for
    // the manual-URL <input> (so a Catchr-degraded operator is never blocked).
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const supplier = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === 'google-ads'),
    )!;
    fireEvent.change(supplier, { target: { value: 'google-ads' } });

    // The manual-URL Input renders with the "No google-ads accounts found"
    // placeholder, per the CatchrMultiAccountPicker fallback path.
    expect(
      screen.getByPlaceholderText(/no google-ads accounts found in catchr/i),
    ).toBeInTheDocument();
  });

  it('passes selected accountIds[] to useCreateTrafficSource on save', async () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));

    // Tick the first Facebook account. We tick by clicking the row label —
    // the underlying checkbox is wired via the <label> wrapper.
    const acct = screen.getByText('Solar UK · FB');
    fireEvent.click(acct);

    // Auto-fill behaviour: the row name should now be the picked account's
    // name (so the operator doesn't have to retype it). We then click Save.
    const saveBtn = screen.getAllByRole('button').find(
      (b) => within(b).queryByText(/^save$/i) !== null || b.querySelector('svg.lucide-save') !== null,
    );
    // Save lives in the same row — find any enabled button next to "Cancel".
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const save = cancelBtn.previousElementSibling as HTMLButtonElement;
    fireEvent.click(save || saveBtn!);

    // Allow microtask for the async onSubmit to flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreateTrafficSource).toHaveBeenCalledTimes(1);
    const payload = mockCreateTrafficSource.mock.calls[0][0];
    expect(payload).toMatchObject({
      platform: 'facebook-ads',
      accountId: '111',
      accountIds: ['111'],
    });
    // Name auto-filled from the picked account.
    expect(payload.name).toBe('Solar UK · FB');
  });
});
