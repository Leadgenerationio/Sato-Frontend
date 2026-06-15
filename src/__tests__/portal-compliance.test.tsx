import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalCompliancePage } from '../pages/portal/compliance';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'client@stato.app', name: 'Client', role: 'client', isActive: true, businessId: null, clientId: 'c1' }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const PENDING_CREATIVE = {
  id: 'cr-pending',
  name: 'banner-v1.png',
  type: 'image',
  uploadedAt: '2026-05-01T10:00:00Z',
  fileUrl: 'https://example.com/banner-v1.png',
  approval: { status: 'pending' as const, decidedAt: null, decidedByName: null, feedback: null },
};

const APPROVED_CREATIVE = {
  id: 'cr-approved',
  name: 'banner-v2.png',
  type: 'image',
  uploadedAt: '2026-05-02T10:00:00Z',
  fileUrl: 'https://example.com/banner-v2.png',
  approval: { status: 'approved' as const, decidedAt: '2026-05-03T09:00:00Z', decidedByName: 'Client User', feedback: null },
};

const REJECTED_CREATIVE = {
  id: 'cr-rejected',
  name: 'banner-v3.png',
  type: 'image',
  uploadedAt: '2026-05-04T10:00:00Z',
  fileUrl: 'https://example.com/banner-v3.png',
  approval: { status: 'rejected' as const, decidedAt: '2026-05-05T09:00:00Z', decidedByName: 'Client User', feedback: 'Logo too small' },
};

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: mockApi,
  unwrap: <T,>(res: { data: T }) => res.data,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PortalCompliancePage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockApi.get.mockResolvedValue({
    status: 'success',
    data: {
      compliance: [
        {
          campaignName: 'Solar Panels (UK)',
          creatives: [PENDING_CREATIVE, APPROVED_CREATIVE, REJECTED_CREATIVE],
          landingPages: [],
        },
      ],
    },
  });
  mockApi.post.mockResolvedValue({ status: 'success', data: { event: { id: 'e1', action: 'approved' } } });
});

describe('PortalCompliancePage — asset approval', () => {
  it('renders pending banner when there are creatives needing review', async () => {
    renderPage();
    expect(await screen.findByText(/1 creative.*need.*your review/i)).toBeInTheDocument();
  });

  it('shows Approve and Reject buttons for pending creatives only', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    // Pending row has buttons; approved row doesn't.
    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    expect(approveButtons.length).toBe(1);
    const rejectButtons = screen.getAllByRole('button', { name: /^reject$/i });
    expect(rejectButtons.length).toBe(1);
  });

  it('clicking Approve fires POST to approve endpoint', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/portal/creatives/cr-pending/approve', {});
    });
  });

  it('clicking Reject opens feedback dialog and submitting calls reject endpoint', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    // Dialog opens with textarea
    const textarea = await screen.findByPlaceholderText(/what needs to change/i);
    fireEvent.change(textarea, { target: { value: 'Logo too small' } });

    fireEvent.click(screen.getByRole('button', { name: /submit rejection/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/portal/creatives/cr-pending/reject',
        { feedback: 'Logo too small' },
      );
    });
  });

  it('reject submit is disabled when feedback is empty', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    const submitBtn = await screen.findByRole('button', { name: /submit rejection/i });
    expect(submitBtn).toBeDisabled();
  });

  // FIX 2 (2026-06-15): default landing tab is "Pending Review" — it must
  // exclude BOTH approved and rejected creatives (those need their own tabs).
  it('default Pending view excludes rejected & approved creatives', async () => {
    renderPage();
    // banner-v1.png (pending) appears; approved + rejected do not.
    await screen.findByText('banner-v1.png');
    expect(screen.queryByText('banner-v2.png')).not.toBeInTheDocument(); // approved
    expect(screen.queryByText('banner-v3.png')).not.toBeInTheDocument(); // rejected
  });

  // FIX 2: the three status filter tabs render and default to Pending Review.
  it('renders Pending Review / Approved / Rejected filter tabs', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    expect(screen.getByRole('tab', { name: /pending review/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /approved/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /rejected/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending review/i })).toHaveAttribute('aria-selected', 'true');
  });

  // FIX 2: selecting the Rejected tab shows only rejected creatives.
  // (The selected asset's name also appears in the detail panel header, so we
  // assert presence with getAllByText and absence of the other two names.)
  it('Rejected tab shows only rejected creatives', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    fireEvent.click(screen.getByRole('tab', { name: /rejected/i }));
    await waitFor(() => {
      expect(screen.getAllByText('banner-v3.png').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('banner-v1.png')).not.toBeInTheDocument();
    expect(screen.queryByText('banner-v2.png')).not.toBeInTheDocument();
  });

  // FIX 2: selecting the Approved tab shows only approved creatives.
  it('Approved tab shows only approved creatives', async () => {
    renderPage();
    await screen.findByText('banner-v1.png');
    fireEvent.click(screen.getByRole('tab', { name: /approved/i }));
    await waitFor(() => {
      expect(screen.getAllByText('banner-v2.png').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('banner-v1.png')).not.toBeInTheDocument();
    expect(screen.queryByText('banner-v3.png')).not.toBeInTheDocument();
  });
});

// FIX 3 (2026-06-15): creatives are grouped into dated BATCHES within a tab.
describe('PortalCompliancePage — dated batches', () => {
  // Two pending creatives uploaded on different days → two batch headers, each
  // containing its own asset.
  const PENDING_DAY1 = {
    id: 'cr-d1',
    name: 'day1-asset.png',
    type: 'image',
    uploadedAt: '2026-06-15T10:00:00Z', // Monday 15 June 2026
    fileUrl: 'https://example.com/day1.png',
    approval: { status: 'pending' as const, decidedAt: null, decidedByName: null, feedback: null },
  };
  const PENDING_DAY2 = {
    id: 'cr-d2',
    name: 'day2-asset.png',
    type: 'image',
    uploadedAt: '2026-06-16T10:00:00Z', // Tuesday 16 June 2026
    fileUrl: 'https://example.com/day2.png',
    approval: { status: 'pending' as const, decidedAt: null, decidedByName: null, feedback: null },
  };

  beforeEach(() => {
    mockApi.get.mockResolvedValue({
      status: 'success',
      data: {
        compliance: [
          {
            campaignName: 'Solar Panels (UK)',
            creatives: [PENDING_DAY1, PENDING_DAY2],
            landingPages: [],
          },
        ],
      },
    });
  });

  it('renders two dated batch headers with the right assets under each', async () => {
    renderPage();
    // Both assets visible in the default (pending) tab.
    expect(await screen.findByText('day1-asset.png')).toBeInTheDocument();
    expect(screen.getByText('day2-asset.png')).toBeInTheDocument();
    // Two distinct dated batch headers (formatted en-GB, weekday + long date).
    // We match the date numbers/months loosely to avoid timezone-day flakiness.
    const headers = screen.getAllByRole('button', { expanded: true });
    // At least the two batch headers are expanded.
    expect(headers.length).toBeGreaterThanOrEqual(2);
    // Day-of-month tokens for the two upload days appear in headers.
    expect(screen.getByText(/15 June 2026/)).toBeInTheDocument();
    expect(screen.getByText(/16 June 2026/)).toBeInTheDocument();
  });
});
