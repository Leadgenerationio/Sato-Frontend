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
          creatives: [PENDING_CREATIVE, APPROVED_CREATIVE],
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

  // Sam (2026-05-27 portal meeting): approved creatives no longer render on
  // the Compliance tab — they move to the Creatives tab grouped by approval
  // date. The Compliance tab now shows only items that still need a
  // decision (pending + rejected + changes_requested).
  it('does NOT render approved creatives on the Compliance tab', async () => {
    renderPage();
    // banner-v1.png (pending) appears; banner-v2.png (approved) does not.
    await screen.findByText('banner-v1.png');
    expect(screen.queryByText('banner-v2.png')).not.toBeInTheDocument();
  });
});
