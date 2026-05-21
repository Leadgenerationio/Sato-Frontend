import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalInvoicesPage } from '../pages/portal/invoices';

// T8 (Sam, 2026-05-20): the client portal must render Xero's `authorised`
// status as "Pending Payment", and overdue rows as "Overdue", instead of
// echoing the raw enum string back to the buyer.

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'client@stato.app', name: 'Client', role: 'client', isActive: true, businessId: null, clientId: 'c1' },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-portal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-portal')>();
  return {
    ...actual,
    usePortalInvoices: () => ({
      data: [
        { id: 'inv-1', invoiceNumber: 'INV-0394', status: 'authorised', total: '17880', currency: 'GBP', dueDate: '2026-06-01T00:00:00Z', paidDate: null, daysOverdue: 0 },
        { id: 'inv-2', invoiceNumber: 'INV-0390', status: 'overdue', total: '5400', currency: 'GBP', dueDate: '2026-04-15T00:00:00Z', paidDate: null, daysOverdue: 31 },
        { id: 'inv-3', invoiceNumber: 'INV-0380', status: 'paid', total: '9600', currency: 'GBP', dueDate: '2026-03-01T00:00:00Z', paidDate: '2026-02-28T00:00:00Z', daysOverdue: 0 },
      ],
      isLoading: false,
    }),
  };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PortalInvoicesPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalInvoicesPage status labels', () => {
  it('renders Xero "authorised" status as "Pending Payment"', () => {
    renderPage();
    expect(screen.queryByText(/authorised/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/pending payment/i).length).toBeGreaterThan(0);
  });

  it('renders overdue rows as "Overdue" with day count', () => {
    renderPage();
    expect(screen.getAllByText(/overdue \(31d\)/i).length).toBeGreaterThan(0);
  });

  it('renders paid rows as "Paid"', () => {
    renderPage();
    expect(screen.getAllByText(/^paid$/i).length).toBeGreaterThan(0);
  });

  it('never echoes the raw Xero enum string anywhere on the page', () => {
    renderPage();
    const inv0394 = screen.getAllByText('INV-0394')[0];
    const row = inv0394.closest('tr, div');
    expect(row).not.toBeNull();
    if (row) {
      expect(within(row as HTMLElement).queryByText(/authorised/i)).not.toBeInTheDocument();
    }
  });
});
