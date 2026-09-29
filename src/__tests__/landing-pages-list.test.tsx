/**
 * Landing pages as their own records (Sam round 1, M2): URL validated,
 * tracking tags stripped before save, duplicates per client caught.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const createMutate = vi.fn();
vi.mock('@/lib/hooks/use-creative-library', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-creative-library')>('@/lib/hooks/use-creative-library');
  return {
    ...actual,
    useLandingPages: () => ({ data: [{ id: 'lp1', clientId: 'c1', clientName: 'Yash Test Sonova', url: 'https://offers.example.com/hearing', normalisedUrl: 'https://offers.example.com/hearing', title: null, screenshotUrl: null, creativesCount: 3, createdAt: '2026-09-01T00:00:00Z' }], isLoading: false, error: null }),
    useCreateLandingPage: () => ({ mutateAsync: createMutate, isPending: false }),
    useDeleteLandingPage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});
vi.mock('@/lib/hooks/use-clients', () => ({ useClients: () => ({ data: { clients: [{ id: 'c1', companyName: 'Yash Test Sonova' }] } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LandingPagesList } from '@/components/creatives/landing-pages-list';

const renderList = (clientId?: string) => render(<MemoryRouter><LandingPagesList clientId={clientId} /></MemoryRouter>);
const urlBox = () => screen.getByPlaceholderText('https://example.com/offer');

beforeEach(() => createMutate.mockReset().mockResolvedValue({}));

describe('LandingPagesList', () => {
  it('lists pages with the number of creatives using them', () => {
    renderList();
    expect(screen.getAllByTestId('landing-page-row')[0]).toHaveTextContent('3');
  });

  it('refuses a junk URL', async () => {
    renderList('c1');
    fireEvent.change(urlBox(), { target: { value: 'not a url' } });
    fireEvent.click(screen.getByRole('button', { name: /Add landing page/ }));
    expect(await screen.findByText(/isn't a web address/)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('says tracking tags will be removed', () => {
    renderList('c1');
    fireEvent.change(urlBox(), { target: { value: 'https://Example.com/offer?utm_source=fb' } });
    expect(screen.getByText('Saved as https://example.com/offer (tracking tags removed).')).toBeInTheDocument();
  });

  it('catches the same page twice for one client', async () => {
    renderList('c1');
    fireEvent.change(urlBox(), { target: { value: 'offers.example.com/hearing?fbclid=1' } });
    fireEvent.click(screen.getByRole('button', { name: /Add landing page/ }));
    expect(await screen.findByText('This client already has that landing page.')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('saves a new page for the client', async () => {
    renderList('c1');
    fireEvent.change(urlBox(), { target: { value: 'https://example.com/new' } });
    fireEvent.change(screen.getByPlaceholderText('Spring offer'), { target: { value: 'New offer' } });
    fireEvent.click(screen.getByRole('button', { name: /Add landing page/ }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledWith({ clientId: 'c1', url: 'https://example.com/new', title: 'New offer' }));
  });
});
