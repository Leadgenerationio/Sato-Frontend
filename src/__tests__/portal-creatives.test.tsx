import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalCreativesPage } from '../pages/portal/creatives';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'client@stato.app', name: 'Client', role: 'client', isActive: true, businessId: null, clientId: 'c1' }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

// Two approved media assets uploaded on different days → two dated batches.
// API returns newest-first; the page preserves that within each batch.
const MEDIA_DAY2 = {
  id: 'cr-media-day2',
  name: 'day2-banner.png',
  type: 'image',
  campaignId: 'camp-1',
  campaignName: 'Solar Panels (UK)',
  section: 'media' as const,
  r2Key: 'creatives/day2-banner.png',
  uploadedAt: '2026-06-16T10:00:00Z', // Tuesday 16 June 2026
  fileUrl: 'https://example.com/day2-banner.png',
  approval: { status: 'approved' as const, decidedAt: '2026-06-17T09:00:00Z', decidedByName: 'Client User', feedback: null },
};

const MEDIA_DAY1 = {
  id: 'cr-media-day1',
  name: 'day1-banner.png',
  type: 'image',
  campaignId: 'camp-1',
  campaignName: 'Solar Panels (UK)',
  section: 'media' as const,
  r2Key: 'creatives/day1-banner.png',
  uploadedAt: '2026-06-15T10:00:00Z', // Monday 15 June 2026
  fileUrl: 'https://example.com/day1-banner.png',
  approval: { status: 'approved' as const, decidedAt: '2026-06-16T09:00:00Z', decidedByName: 'Client User', feedback: null },
};

// A draft-but-not-approved asset must never reach this display-only tab.
const MEDIA_PENDING = {
  ...MEDIA_DAY1,
  id: 'cr-media-pending',
  name: 'pending-banner.png',
  approval: { status: 'pending' as const, decidedAt: null, decidedByName: null, feedback: null },
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
      <MemoryRouter><PortalCreativesPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockApi.get.mockResolvedValue({
    status: 'success',
    data: {
      media: [MEDIA_DAY2, MEDIA_DAY1, MEDIA_PENDING],
      copyLp: [],
    },
  });
});

describe('PortalCreativesPage — dated batches', () => {
  it('groups approved media into dated batch headers, newest day first', async () => {
    renderPage();

    // Both approved assets render (day2 also shows in the auto-selected detail
    // panel, hence getAllByText); the pending one is filtered out.
    expect(await screen.findByText('day1-banner.png')).toBeInTheDocument();
    expect(screen.getAllByText('day2-banner.png').length).toBeGreaterThan(0);
    expect(screen.queryByText('pending-banner.png')).not.toBeInTheDocument();

    // One dated batch header per upload day (en-GB weekday + long date).
    expect(screen.getByText(/15 June 2026/)).toBeInTheDocument();
    expect(screen.getByText(/16 June 2026/)).toBeInTheDocument();
  });

  it('collapses a batch when its header is clicked', async () => {
    renderPage();

    const day1Header = await screen.findByText(/15 June 2026/);
    expect(screen.getByText('day1-banner.png')).toBeInTheDocument();

    fireEvent.click(day1Header);

    // day1's only asset is in the collapsed batch (not selected), so it leaves
    // the DOM entirely; day2 stays (list + detail panel).
    await waitFor(() => {
      expect(screen.queryByText('day1-banner.png')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('day2-banner.png').length).toBeGreaterThan(0);
  });
});
