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
        { id: 'inv-1', invoiceNumber: 'INV-1050', clientId: 'c-1', clientName: 'Apex Media', status: 'draft', currency: 'GBP', subtotal: 500, vatAmount: 100, total: 600, dueDate: '2026-05-01T00:00:00Z', paidDate: null, daysOverdue: 0, createdAt: '2026-04-01T00:00:00Z' },
        { id: 'inv-2', invoiceNumber: 'INV-1049', clientId: 'c-2', clientName: 'Brightfield', status: 'paid', currency: 'GBP', subtotal: 800, vatAmount: 160, total: 960, dueDate: '2026-04-15T00:00:00Z', paidDate: '2026-04-10T00:00:00Z', daysOverdue: 0, createdAt: '2026-03-15T00:00:00Z' },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
    error: null,
  }),
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
    expect(screen.getAllByText(/^draft$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^paid$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^overdue$/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders CSV and New Invoice buttons', () => {
    renderPage();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
  });
});
