/**
 * Creative library (Sam round 1, M2): thumbnails + video preview, filters go
 * to the API, bulk actions send the selected ids, the detail panel shows the
 * platform ad and landing page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import type { LibraryCreative, CreativeFilters } from '@/lib/hooks/use-creative-library';

const base: LibraryCreative = {
  id: 'cr1', name: 'hearing-hero.jpg', clientId: 'c1', clientName: 'Yash Test Sonova', campaignId: 'k1', campaignName: 'Hearing Aids (CH)',
  platform: 'meta', platformAdId: '120210000000001', platformCreativeId: '9001', platformCampaignName: 'CH | Hearing | Prospecting',
  landingPageId: 'lp1', landingPageUrl: 'https://offers.example.com/hearing', headline: 'Hear better today', bodyText: 'Free test',
  mediaType: 'image', contentType: 'image/jpeg', width: 1080, height: 1080, durationS: null, sizeBytes: 250_000,
  thumbnailUrl: 'https://cdn.test/t1.jpg', fileUrl: 'https://cdn.test/f1.jpg?sig=fresh', status: 'approved', shared: false,
  firstSeen: '2026-09-01T00:00:00Z', lastSeen: '2026-09-28T00:00:00Z', createdAt: '2026-09-01T00:00:00Z',
};
const video: LibraryCreative = { ...base, id: 'cr2', name: 'story.mp4', mediaType: 'video', contentType: 'video/mp4', durationS: 15, thumbnailUrl: 'https://cdn.test/p2.jpg', fileUrl: 'https://cdn.test/f2.mp4', platform: 'taboola', platformAdId: 'tb-77', status: 'draft' };

const copyAsset: LibraryCreative = { ...base, id: 'cr3', name: 'Spring boiler copy', mediaType: 'copy', contentType: 'text/plain', fileUrl: null, thumbnailUrl: null, width: null, height: null, sizeBytes: 60, headline: 'Save 20% on boilers', bodyText: 'Free quote in two minutes.\nNo obligation.', platform: 'manual', platformAdId: null, platformCreativeId: null, platformCampaignName: null };
let items: LibraryCreative[] = [base, video];
const calls: CreativeFilters[] = [];
const bulkMutate = vi.fn();
const updateMutate = vi.fn();
let detail: LibraryCreative | null = null;
let detailError: Error | null = null;

vi.mock('@/lib/hooks/use-creative-library', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-creative-library')>('@/lib/hooks/use-creative-library');
  return {
    ...actual,
    useLibraryCreatives: (f: CreativeFilters) => { calls.push(f); return { data: { creatives: items, total: items.length, page: 1, pageSize: 24 }, isLoading: false, isFetching: false, error: null }; },
    useLibraryCreative: (id: string | null) => ({ data: id && !detailError ? detail : undefined, isLoading: false, error: id ? detailError : null }),
    useLandingPages: () => ({ data: [{ id: 'lp1', clientId: 'c1', clientName: 'Yash Test Sonova', url: 'https://offers.example.com/hearing', normalisedUrl: 'https://offers.example.com/hearing', title: 'Hearing offer', screenshotUrl: null, creativesCount: 2, createdAt: '2026-09-01T00:00:00Z' }] }),
    useBulkCreatives: () => ({ mutateAsync: bulkMutate, isPending: false }),
    useUpdateLibraryCreative: () => ({ mutateAsync: updateMutate, isPending: false }),
    useCreateLibraryCreatives: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});
vi.mock('@/lib/hooks/use-clients', () => ({ useClients: () => ({ data: { clients: [{ id: 'c1', companyName: 'Yash Test Sonova' }, { id: 'c2', companyName: 'Yash Test Copious' }] } }) }));
vi.mock('@/lib/hooks/use-campaigns', () => ({ useCampaigns: () => ({ data: { campaigns: [{ id: 'k1', name: 'Hearing Aids (CH)' }] } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CreativeLibrary } from '@/components/creatives/creative-library';

function renderLib(props: { clientId?: string; url?: string } = {}) {
  const { url, ...rest } = props;
  return render(<MemoryRouter initialEntries={[url ?? '/creatives']}><CreativeLibrary {...rest} /></MemoryRouter>);
}
async function pick(label: string, option: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  detailError = null;
  items = [base, video];
  calls.length = 0;
  bulkMutate.mockReset().mockResolvedValue({ updated: 2 });
  updateMutate.mockReset().mockResolvedValue({});
  detail = null;
  localStorage.clear();
});

describe('CreativeLibrary', () => {
  it('shows a thumbnail card per creative, with the video length on videos', () => {
    renderLib();
    const cards = screen.getAllByTestId('creative-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('button', { name: 'Open hearing-hero.jpg' }).querySelector('img')).toHaveAttribute('src', 'https://cdn.test/t1.jpg');
    expect(within(cards[1]).getByText('15s')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Yash Test Sonova')).toBeInTheDocument();
  });

  it('sends the filters and search to the API and resets to page 1', async () => {
    renderLib();
    await pick('Filter by platform', 'Taboola');
    fireEvent.change(screen.getByLabelText('Search creatives'), { target: { value: 'hero' } });
    await pick('Filter by landing page', 'Hearing offer — https://offers.example.com/hearing');
    const last = calls[calls.length - 1];
    expect(last).toMatchObject({ platform: 'taboola', q: 'hero', landingPageId: 'lp1', page: 1 });
  });

  it('a client tab fixes the client and hides the client filter', () => {
    renderLib({ clientId: 'c2' });
    expect(calls[calls.length - 1].clientId).toBe('c2');
    expect(screen.queryByRole('button', { name: 'Filter by client' })).toBeNull();
  });

  it('bulk "Submit for approval" sends exactly the selected ids', async () => {
    renderLib();
    const grid = within(screen.getByTestId('creative-grid'));
    fireEvent.click(grid.getByLabelText('Select hearing-hero.jpg'));
    fireEvent.click(grid.getByLabelText('Select story.mp4'));
    const bar = within(screen.getByTestId('creative-bulk-bar'));
    expect(bar.getByText('2 selected')).toBeInTheDocument();
    await pick('Bulk action', 'Submit for approval');
    fireEvent.click(bar.getByRole('button', { name: /Apply to 2/ }));
    await waitFor(() => expect(bulkMutate).toHaveBeenCalledWith({ ids: ['cr1', 'cr2'], action: 'submit_for_approval' }));
  });

  it('assign landing page needs a page before Apply is enabled', async () => {
    renderLib();
    fireEvent.click(within(screen.getByTestId('creative-grid')).getByLabelText('Select hearing-hero.jpg'));
    const apply = within(screen.getByTestId('creative-bulk-bar')).getByRole('button', { name: /Apply to 1/ });
    expect(apply).toBeDisabled();
    await pick('Landing page for selected creatives', 'Hearing offer — https://offers.example.com/hearing');
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    await waitFor(() => expect(bulkMutate).toHaveBeenCalledWith({ ids: ['cr1'], action: 'assign_landing_page', landingPageId: 'lp1' }));
  });

  it('detail panel shows the platform ad, landing page and a fresh download link', async () => {
    detail = base;
    renderLib();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open hearing-hero.jpg' })[0]);
    const panel = within(await screen.findByRole('dialog'));
    expect(panel.getByText('120210000000001')).toBeInTheDocument();
    expect(panel.getByText('CH | Hearing | Prospecting')).toBeInTheDocument();
    expect(panel.getAllByRole('link', { name: /offers\.example\.com\/hearing|Open landing page/ }).length).toBeGreaterThan(0);
    expect(panel.getByRole('button', { name: /Download/ }).closest('a')).toHaveAttribute('href', 'https://cdn.test/f1.jpg?sig=fresh');
    expect(panel.getByText('1080×1080 · 244 KB · image/jpeg')).toBeInTheDocument();
  });

  it('?creative=<id> opens that asset straight away (the portalUrl from an MCP upload), and closing it clears the link', async () => {
    detail = base;
    renderLib({ url: '/creatives?creative=cr1' });
    const panel = within(await screen.findByRole('dialog'));
    expect(panel.getByText('120210000000001')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('following a link to another asset while the library is already open opens that asset', async () => {
    detail = base;
    render(<MemoryRouter initialEntries={['/creatives?creative=cr1']}><Link to="/creatives?creative=cr2">next</Link><CreativeLibrary /></MemoryRouter>);
    expect(await within(await screen.findByRole('dialog')).findByText('1080×1080 · 244 KB · image/jpeg')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    detail = video;
    fireEvent.click(screen.getByRole('link', { name: 'next' }));
    const panel = within(await screen.findByRole('dialog'));
    expect(await panel.findByText(/story\.mp4/)).toBeInTheDocument();
  });

  it('an unknown asset id shows the panel\'s error message, not a spinner', async () => {
    detail = null; detailError = new Error('Creative not found');
    renderLib({ url: '/creatives?creative=00000000-0000-4000-8000-000000000000' });
    const panel = within(await screen.findByRole('dialog'));
    expect(await panel.findByText('Creative not found')).toBeInTheDocument();
    expect(panel.queryByText('Loading…')).not.toBeInTheDocument(); // no stale spinner text next to the error
    detailError = null;
  });

  it('a copy-only asset shows its words in the grid and in the panel, with no download and no size', async () => {
    items = [copyAsset]; detail = copyAsset;
    renderLib();
    expect(screen.getByTestId('copy-thumb')).toHaveTextContent('Save 20% on boilers');
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Spring boiler copy' })[0]);
    const panel = within(await screen.findByRole('dialog'));
    const preview = panel.getByTestId('copy-preview');
    expect(preview).toHaveTextContent('Save 20% on boilers');
    expect(preview).toHaveTextContent('Free quote in two minutes.');
    expect(panel.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
    expect(panel.queryByText('Size')).not.toBeInTheDocument();
    expect(panel.queryByText('No preview')).not.toBeInTheDocument();
  });

  it('without ?creative nothing is opened', () => {
    detail = base;
    renderLib();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('video detail plays inline with the poster frame', async () => {
    detail = video;
    renderLib();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open story.mp4' })[0]);
    const panel = await screen.findByRole('dialog');
    const v = panel.querySelector('video')!;
    expect(v).toHaveAttribute('controls');
    expect(v).toHaveAttribute('poster', 'https://cdn.test/p2.jpg');
    expect(v).toHaveAttribute('src', 'https://cdn.test/f2.mp4');
  });

  it('remembers grid vs table per viewer and labels the toggle', () => {
    renderLib();
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('stato.creatives.view')).toBe('table');
    expect(screen.getAllByTestId('creative-row')).toHaveLength(2);
  });
});
