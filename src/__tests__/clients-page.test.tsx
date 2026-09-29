import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientsPage } from '../pages/clients/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

// Feedback S14/S16: spies so tests can assert the filters sent to the API,
// the CSV export call, and the Attio button's visibility.
const h = vi.hoisted(() => ({
  useClients: vi.fn(),
  downloadClientsCsv: vi.fn(async (_filters: Record<string, unknown>) => new Blob(['a,b\r\n'], { type: 'text/csv' })),
  attio: { configured: undefined as boolean | undefined },
  addedBy: { options: undefined as undefined | { id: string; name: string; count: number }[] },
  clientsResult: null as unknown,
}));

vi.mock('@/lib/download', () => ({ saveBlob: vi.fn() }));

vi.mock('@/lib/hooks/use-clients', () => ({
  useAttioConfigured: () => h.attio.configured,
  useClientAddedByOptions: () => ({ data: h.addedBy.options }),
  downloadClientsCsv: h.downloadClientsCsv,
  useClients: (filters: unknown) => { h.useClients(filters); return h.clientsResult; },
}));

const clientsResult = {
    data: {
      clients: [
        { id: 'c-1', companyName: 'Apex Media Ltd', contactName: 'James Wright', contactEmail: 'billing@apex.co.uk', status: 'active', currency: 'GBP', creditScore: 82, activeCampaigns: 2, totalRevenue: 45200, createdAt: '2025-06-15' },
        { id: 'c-2', companyName: 'Delta Solutions', contactName: 'Laura Davies', contactEmail: 'pay@delta.co.uk', status: 'churned', currency: 'GBP', creditScore: 42, activeCampaigns: 0, totalRevenue: 12400, createdAt: '2025-07-01' },
        // Feedback M3/M4 fixtures: an active EUR client with no signed
        // agreement, and a paused client.
        { id: 'c-3', companyName: 'Sonova EUR', contactName: 'Sam', contactEmail: 's@x.pl', status: 'active', agreementSigned: false, documentsCount: 2, currency: 'EUR', creditScore: null, activeCampaigns: 0, totalRevenue: 399791, revenueByCurrency: { EUR: 399791, GBP: 50 }, createdAt: '2025-08-01' },
        { id: 'c-4', companyName: 'Paused Co', contactName: 'P', contactEmail: 'p@x.uk', status: 'paused', agreementSigned: true, documentsCount: 1, currency: 'GBP', creditScore: null, activeCampaigns: 0, totalRevenue: 0, createdAt: '2025-08-02' },
      ],
      total: 4,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
    error: null,
};
h.clientsResult = clientsResult;

beforeEach(() => {
  h.useClients.mockClear();
  h.downloadClientsCsv.mockClear();
  h.attio.configured = undefined;
  h.addedBy.options = undefined;
});

function lastFilters() {
  return h.useClients.mock.calls.at(-1)![0] as Record<string, unknown>;
}

function renderPage(url = '/clients') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}><ClientsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ClientsPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /clients/i })).toBeInTheDocument();
  });

  it('renders clients in table', () => {
    renderPage();
    expect(screen.getByText('Apex Media Ltd')).toBeInTheDocument();
    expect(screen.getByText('Delta Solutions')).toBeInTheDocument();
  });

  it('renders All / Onboarding / Active / Paused / Churned tabs (feedback M4)', () => {
    renderPage();
    const tabs = Array.from(document.querySelectorAll('.inv-tab')).map((el) => el.textContent);
    expect(tabs).toEqual(['All', 'Onboarding', 'Active', 'Paused', 'Churned']);
  });

  it('shows the STORED status — an active client without a signed agreement stays Active, with a warning badge', () => {
    renderPage();
    const row = screen.getByText('Sonova EUR').closest('tr')!;
    expect(row.textContent).toContain('Active');
    expect(row.textContent).not.toContain('Onboarding');
    expect(row.textContent).toContain('No signed agreement');
  });

  it('shows paused as Paused, not "Client Churned"', () => {
    renderPage();
    const row = screen.getByText('Paused Co').closest('tr')!;
    expect(row.querySelector('.pill')?.textContent).toBe('Paused');
    expect(row.textContent).not.toMatch(/churned/i);
  });

  it('formats revenue in the client currency and lists other-currency revenue separately (feedback M3)', () => {
    renderPage();
    const row = screen.getByText('Sonova EUR').closest('tr')!;
    expect(row.textContent).toContain('€399,791.00');
    expect(row.textContent).not.toContain('£399,791.00');
    expect(row.textContent).toContain('+ £50.00');
    // A GBP client still reads in pounds.
    expect(screen.getByText('Apex Media Ltd').closest('tr')!.textContent).toContain('£45,200.00');
  });

  it('renders credit scores', () => {
    renderPage();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders new client button', () => {
    renderPage();
    expect(screen.getByText('New Client')).toBeInTheDocument();
  });

  // ─── Feedback S14: sort, filters, page size, CSV ───
  it('sorts server-side from the column headers, flipping direction on a second click', async () => {
    renderPage();
    expect(lastFilters()).toMatchObject({ sort: 'created', dir: 'desc' });
    fireEvent.click(screen.getByRole('button', { name: /^revenue/i }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ sort: 'revenue', dir: 'desc' }));
    fireEvent.click(screen.getByRole('button', { name: /^revenue/i }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ sort: 'revenue', dir: 'asc' }));
    // Text columns start A→Z.
    fireEvent.click(screen.getByRole('button', { name: /^company/i }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ sort: 'company', dir: 'asc' }));
    expect(screen.getByRole('columnheader', { name: /company/i })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('reads sort + filters from the URL so a shared link keeps the view', () => {
    renderPage('/clients?sort=credit&dir=asc&currency=EUR&country=Poland&limit=50&status=active');
    expect(lastFilters()).toMatchObject({ sort: 'credit', dir: 'asc', currency: 'EUR', country: 'Poland', limit: 50, status: 'active' });
  });

  it('ignores an unknown sort key or page size in the URL', () => {
    renderPage('/clients?sort=drop_table&limit=7');
    expect(lastFilters()).toMatchObject({ sort: 'created', limit: 10 });
  });

  it('filters by currency and changes page size', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/currency/i), { target: { value: 'CHF' } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ currency: 'CHF' }));
    fireEvent.change(screen.getByLabelText(/per page/i), { target: { value: '25' } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ limit: 25 }));
  });

  it('filters by country after typing pauses', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/filter by country/i), { target: { value: 'pol' } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ country: 'pol' }), { timeout: 2000 });
  });

  it('exports exactly the current filters and sort as CSV', async () => {
    renderPage('/clients?sort=revenue&dir=desc&currency=EUR');
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(h.downloadClientsCsv).toHaveBeenCalledTimes(1));
    expect(h.downloadClientsCsv.mock.calls[0][0]).toMatchObject({ sort: 'revenue', dir: 'desc', currency: 'EUR' });
    expect(h.downloadClientsCsv.mock.calls[0][0]).not.toHaveProperty('page');
  });

  it('filters by "Added by" (feedback S14) and sends it with the CSV', async () => {
    h.addedBy.options = [{ id: 'u-1', name: 'Sam Owner', count: 3 }, { id: 'unknown', name: 'Unknown (added before tracking)', count: 5 }];
    renderPage();
    const select = screen.getByLabelText('Added by');
    fireEvent.change(select, { target: { value: 'unknown' } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ addedBy: 'unknown' }));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(h.downloadClientsCsv).toHaveBeenCalledTimes(1));
    expect(h.downloadClientsCsv.mock.calls[0][0]).toMatchObject({ addedBy: 'unknown' });
  });

  it('hides "Added by" on an older backend that has no options endpoint', () => {
    renderPage();
    expect(screen.queryByLabelText('Added by')).toBeNull();
  });

  it('labels the icon buttons (pager + open client)', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Sonova EUR' })).toBeInTheDocument();
  });

  // ─── Feedback S16: no Import button that can only fail ───
  it('hides "Import from Attio" when the backend says Attio is not configured', () => {
    h.attio.configured = false;
    renderPage();
    expect(screen.queryByText(/import from attio/i)).not.toBeInTheDocument();
  });

  it('keeps "Import from Attio" when configured, or when the backend is too old to say', () => {
    h.attio.configured = true;
    const { unmount } = renderPage();
    expect(screen.getByText(/import from attio/i)).toBeInTheDocument();
    unmount();
    h.attio.configured = undefined;
    renderPage();
    expect(screen.getByText(/import from attio/i)).toBeInTheDocument();
  });
});
