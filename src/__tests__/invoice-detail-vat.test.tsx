import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetailPage } from '../pages/finance/invoice-detail';
import { invoiceVatRate } from '../lib/invoice-vat';
import type { InvoiceDetail } from '../lib/hooks/use-invoices';

const { state } = vi.hoisted(() => ({ state: { invoice: null as unknown } }));

vi.mock('@/lib/hooks/use-invoices', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/use-invoices')>('../lib/hooks/use-invoices');
  return {
    ...actual,
    useInvoice: () => ({ data: state.invoice, isLoading: false, error: null }),
    usePushInvoiceToXero: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDownloadInvoicePdf: () => ({ mutate: vi.fn(), isPending: false }),
    useAddInvoiceAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRemoveInvoiceAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function invoice(over: Partial<InvoiceDetail>): InvoiceDetail {
  return {
    id: 'inv-1', invoiceNumber: 'INV-1', clientId: 'c1', clientName: 'Five Percent Ltd', status: 'draft', currency: 'GBP',
    subtotal: '100.00', vatAmount: '5.00', total: '105.00', dueDate: '2026-10-13T00:00:00Z', paidDate: null, daysOverdue: 0,
    createdAt: '2026-09-29T00:00:00Z', xeroInvoiceId: null, lineItems: [{ description: 'Leads', quantity: 1, unitPrice: 100, amount: 100 }],
    chaseCount: 0, lastChasedAt: null, clientEmail: 'a@b.c', vatRegistered: true, attachments: [], ...over,
  };
}

function renderDetail(inv: InvoiceDetail) {
  state.invoice = inv;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/finance/invoices/inv-1']}>
        <Routes><Route path="/finance/invoices/:id" element={<InvoiceDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Invoice detail shows the VAT rate actually charged (Sam M5)', () => {
  it('works the rate out from the invoice, not a fixed 20%', () => {
    renderDetail(invoice({}));
    expect(screen.getByText('VAT (5%)')).toBeInTheDocument();
    expect(screen.getByText('Yes (5%)')).toBeInTheDocument();
    expect(screen.queryByText(/20%/)).not.toBeInTheDocument();
  });

  it('still shows 20% for a 20% invoice', () => {
    renderDetail(invoice({ vatAmount: '20.00', total: '120.00' }));
    expect(screen.getByText('VAT (20%)')).toBeInTheDocument();
    expect(screen.getByText('Yes (20%)')).toBeInTheDocument();
  });

  it('says No, with no VAT line, for an invoice with no VAT even if the client is VAT registered (reverse charge / zero-rated)', () => {
    renderDetail(invoice({ vatAmount: '0.00', total: '100.00', vatRegistered: true }));
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.queryByText(/^VAT/, { selector: '.ci-total-row span' })).not.toBeInTheDocument();
  });

  it('shows no percentage on a tiny invoice where pence make it meaningless', () => {
    renderDetail(invoice({ subtotal: '0.03', vatAmount: '0.01', total: '0.04' }));
    // Once as the totals row, once as the sidebar label: neither carries a percentage.
    expect(screen.getAllByText('VAT')).toHaveLength(2);
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

describe('invoiceVatRate', () => {
  it('handles the edges', () => {
    expect(invoiceVatRate(100, 20)).toBe(20);
    expect(invoiceVatRate(100, 5)).toBe(5);
    expect(invoiceVatRate(83.33, 16.67)).toBe(20);
    expect(invoiceVatRate(100, 0)).toBeNull();
    expect(invoiceVatRate(0, 0)).toBeNull();
    expect(invoiceVatRate(0.5, 0.1)).toBeNull();
  });
});
