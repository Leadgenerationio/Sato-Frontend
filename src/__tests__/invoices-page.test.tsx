import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceListPage } from '../pages/finance/invoices';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-invoices', () => ({
  useInvoices: () => ({
    data: {
      invoices: [
        { id: 'inv-1', invoiceNumber: 'INV-1050', clientId: 'c-1', clientName: 'Apex Media', status: 'draft', currency: 'GBP', subtotal: '500', vatAmount: '100', total: '600', dueDate: '2026-05-01T00:00:00Z', paidDate: null, daysOverdue: 0, createdAt: '2026-04-01T00:00:00Z' },
        { id: 'inv-2', invoiceNumber: 'INV-1049', clientId: 'c-2', clientName: 'Brightfield', status: 'paid', currency: 'GBP', subtotal: '800', vatAmount: '160', total: '960', dueDate: '2026-04-15T00:00:00Z', paidDate: '2026-04-10T00:00:00Z', daysOverdue: 0, createdAt: '2026-03-15T00:00:00Z' },
        // Feedback S12: a Xero import — imported (createdAt) 28 Sep 2026, but
        // Xero dated the invoice 1 Jul 2025. The list must show 1 Jul 2025.
        { id: 'inv-3', invoiceNumber: 'INV-0121', clientId: 'c-3', clientName: 'Sonova', status: 'paid', currency: 'EUR', subtotal: '20550', vatAmount: '0', total: '20550', dueDate: '2025-07-31T00:00:00Z', paidDate: '2025-07-20T00:00:00Z', daysOverdue: 0, createdAt: '2026-09-28T10:00:00Z', invoiceDate: '2025-07-01T00:00:00Z', xeroInvoiceId: 'x-1' },
      ],
      total: 3,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
    error: null,
  }),
  invoiceDateOf: (i: { invoiceDate?: string | null; createdAt: string }) => i.invoiceDate ?? i.createdAt,
  toMoney: (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><InvoiceListPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvoiceListPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /invoices/i })).toBeInTheDocument();
  });

  it('renders invoices in table', () => {
    renderPage();
    expect(screen.getByText('INV-1050')).toBeInTheDocument();
    expect(screen.getByText('INV-1049')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    renderPage();
    expect(screen.getAllByText(/^all$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^sent$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^paid$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^overdue$/i).length).toBeGreaterThanOrEqual(1);
  });

  // Sam request 2026-06-15: no drafts — the 'draft' status tab must not render.
  it('does NOT render a draft status tab', () => {
    renderPage();
    // The only "Draft" text that could appear is the status pill on the draft
    // invoice row (INV-1050); there must be no clickable 'draft' filter tab.
    const draftTabs = screen
      .queryAllByText(/^draft$/i)
      .filter((el) => el.className.includes('inv-tab'));
    expect(draftTabs.length).toBe(0);
  });

  it('renders CSV and New Invoice buttons', () => {
    renderPage();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
  });

  it('shows the Xero invoice date, not the import date (feedback S12)', () => {
    renderPage();
    const row = screen.getByText('INV-0121').closest('tr')!;
    expect(row.textContent).toMatch(/1 Jul 2025/);
    expect(row.textContent).not.toMatch(/28 Sept? 2026/);
    expect(screen.getByRole('button', { name: /invoice date/i })).toBeInTheDocument();
  });
});
