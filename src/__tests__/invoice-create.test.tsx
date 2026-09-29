// M7 (Sam feedback 2026-09-29) — New Invoice follows the client record.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { format } from 'date-fns';
import { InvoiceCreatePage } from '../pages/finance/invoice-create';
import type { InvoiceClient } from '../lib/hooks/use-invoices';

const { mockMutate, mockNavigate } = vi.hoisted(() => ({ mockMutate: vi.fn(), mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CLIENTS: InvoiceClient[] = [
  // "Copious"-shaped: GBP, 4-day terms, not VAT registered.
  { id: 'c-copious', name: 'Yash Test Copious', email: '', status: 'active', vatRegistered: false, vatTreatment: 'outside_scope', vatRate: 20, currency: 'GBP', paymentTermsDays: 4 },
  // "Sonova"-shaped: EUR, still Onboarding, reverse charge.
  { id: 'c-sonova', name: 'Yash Test Sonova', email: '', status: 'onboarding', vatRegistered: true, vatTreatment: 'reverse_charge', vatRate: 20, currency: 'EUR', paymentTermsDays: 30 },
  // UK VAT client on a 5% rate.
  { id: 'c-uk5', name: 'Yash Test UK Five', email: '', status: 'active', vatRegistered: true, vatTreatment: 'uk_standard', vatRate: 5, currency: 'GBP', paymentTermsDays: 14 },
];

vi.mock('@/lib/hooks/use-invoices', () => ({
  useInvoiceClients: () => ({ data: CLIENTS, isLoading: false }),
  useCreateInvoice: () => ({ mutateAsync: mockMutate, isPending: false }),
}));

function renderPage() {
  return render(<MemoryRouter><InvoiceCreatePage /></MemoryRouter>);
}

function addLine() {
  fireEvent.change(screen.getByPlaceholderText('Lead type…'), { target: { value: 'Yash test leads' } });
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
}

function inDays(n: number) {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n), 'yyyy-MM-dd');
}

beforeEach(() => {
  mockMutate.mockReset();
  mockMutate.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-1' });
});

describe('InvoiceCreatePage — follows the client (M7)', () => {
  it('lists onboarding clients, labelled', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'Yash Test Sonova (Onboarding)' })).toBeInTheDocument();
  });

  it('Copious: 4-day terms → due today + 4, no VAT, GBP', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c-copious' } });
    expect(screen.getByText('4-day payment terms')).toBeInTheDocument();
    expect(screen.queryByLabelText(/add vat/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no vat on this invoice/i)).toBeInTheDocument();
    addLine();
    fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ clientId: 'c-copious', currency: 'GBP', addVat: false, dueDate: inDays(4) });
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('confirmCurrencyMismatch');
  });

  it('Sonova: EUR prefilled, reverse charge → no VAT', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c-sonova' } });
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('EUR');
    expect(screen.getByText(/no vat on this invoice — the client's vat treatment is reverse charge/i)).toBeInTheDocument();
  });

  it("uses the client's VAT rate, not 20%", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c-uk5' } });
    expect(screen.getByLabelText('Add VAT (5%)')).toBeChecked();
    addLine();
    expect(screen.getByText('VAT (5%)')).toBeInTheDocument();
    expect(screen.getByText('£105.00')).toBeInTheDocument();
  });

  it('changing currency away from the client warns and needs a confirm before Create', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c-copious' } });
    addLine();
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Yash Test Copious is billed in GBP. This invoice will be in EUR.');
    const create = screen.getByRole('button', { name: /create invoice/i });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Yes, invoice in EUR'));
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ currency: 'EUR', confirmCurrencyMismatch: true });
  });

  it('switching back to the client currency clears the warning', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c-copious' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GBP' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create invoice/i })).toBeEnabled();
  });

  it('offers CHF and PLN', () => {
    renderPage();
    const codes = Array.from((screen.getByLabelText('Currency') as HTMLSelectElement).options).map((o) => o.value);
    expect(codes).toEqual(expect.arrayContaining(['CHF', 'PLN']));
  });
});
