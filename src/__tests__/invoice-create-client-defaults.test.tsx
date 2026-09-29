import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceCreatePage } from '../pages/finance/invoice-create';
import { ApiError } from '../lib/api';

const { mockMutate, mockNavigate, clients } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockNavigate: vi.fn(),
  clients: [
    { id: 'copious', name: 'Copious Limited', email: 'a@b.c', status: 'active', vatRegistered: false, vatTreatment: 'outside_scope', vatRate: 20, currency: 'GBP', paymentTermsDays: 4 },
    { id: 'sonova', name: 'Sonova audiological care polska sp. z o.o', email: 'a@b.c', status: 'onboarding', vatRegistered: true, vatTreatment: 'reverse_charge', vatRate: 20, currency: 'EUR', paymentTermsDays: 30 },
    { id: 'uk5', name: 'Five Percent Ltd', email: 'a@b.c', status: 'active', vatRegistered: true, vatTreatment: 'uk_standard', vatRate: 5, currency: 'GBP', paymentTermsDays: 14 },
  ],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/lib/hooks/use-invoices', () => ({
  useInvoiceClients: () => ({ data: clients, isLoading: false }),
  useCreateInvoice: () => ({ mutateAsync: mockMutate, isPending: false }),
}));
// The real picker is a Radix popover; a plain button that moves the date is enough here.
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ onSelect }: { onSelect: (d: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date(2026, 9, 10))}>Move due date</button>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// 2026-09-29 (a Tuesday) at local noon: four days later is 2026-10-03.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 29, 12, 0, 0));
  mockMutate.mockReset();
  mockMutate.mockResolvedValue({ id: 'inv1', invoiceNumber: 'INV-1' });
  mockNavigate.mockClear();
});
afterEach(() => vi.useRealTimers());

const pick = (id: string) => fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: id } });
const currency = () => screen.getByLabelText('Currency') as HTMLSelectElement;
function fillLine() {
  fireEvent.change(screen.getByPlaceholderText('Lead type…'), { target: { value: 'UX TEST - DO NOT SAVE' } });
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: /create invoice/i }));
const renderPage = () => render(<MemoryRouter><InvoiceCreatePage /></MemoryRouter>);

describe('New Invoice follows the client record (Sam M7)', () => {
  it('lists onboarding clients such as Sonova, labelled with their status', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /Sonova audiological care polska sp. z o.o \(Onboarding\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Copious Limited' })).toBeInTheDocument();
  });

  it("takes currency and due date from the client's terms (4 days, not 30)", async () => {
    renderPage();
    pick('copious');
    expect(currency().value).toBe('GBP');
    fillLine();
    submit();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      clientId: 'copious', currency: 'GBP', dueDate: '2026-10-03', addVat: false,
    });
    expect(mockMutate.mock.calls[0][0].confirmCurrencyMismatch).toBeUndefined();
  });

  it('warns and blocks when the currency differs from the client, until confirmed', async () => {
    renderPage();
    pick('copious');
    fireEvent.change(currency(), { target: { value: 'EUR' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/Copious Limited is billed in GBP, but this invoice is in EUR/);
    fillLine();
    submit();
    expect(mockMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/invoice in EUR instead of GBP/));
    submit();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ currency: 'EUR', confirmCurrencyMismatch: true });
  });

  it('changing the currency back clears the warning', () => {
    renderPage();
    pick('copious');
    fireEvent.change(currency(), { target: { value: 'EUR' } });
    fireEvent.change(currency(), { target: { value: 'GBP' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("does not offer VAT on a reverse-charge client and never sends it", async () => {
    renderPage();
    pick('sonova');
    expect(currency().value).toBe('EUR');
    const vat = screen.getByLabelText(/Add VAT/) as HTMLInputElement;
    expect(vat).toBeDisabled();
    expect(vat).not.toBeChecked();
    expect(screen.getByText(/Reverse charge/)).toBeInTheDocument();
    fillLine();
    expect(screen.queryByText(/^VAT \(/)).not.toBeInTheDocument();
    submit();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ clientId: 'sonova', currency: 'EUR', addVat: false, dueDate: '2026-10-29' });
  });

  it("uses the client's own VAT rate instead of a fixed 20%", async () => {
    renderPage();
    pick('uk5');
    expect(screen.getByLabelText('Add VAT (5%)')).toBeChecked();
    fillLine();
    expect(screen.getByText('VAT (5%)')).toBeInTheDocument();
    expect(screen.getAllByText('£105.00').length).toBeGreaterThan(0);
    submit();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ addVat: true, dueDate: '2026-10-13' });
  });

  it('offers to reset a due date that was moved away from the terms', async () => {
    renderPage();
    pick('copious');
    expect(screen.queryByText(/terms are/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Move due date' }));
    expect(await screen.findByText(/Copious Limited's terms are 4 days \(due 03\/10\/2026\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /use client terms/i }));
    expect(screen.queryByText(/terms are/)).not.toBeInTheDocument();
  });

  it('shows the server wording if it rejects a currency mismatch', async () => {
    mockMutate.mockRejectedValueOnce(new ApiError('Copious Limited is billed in GBP, but this invoice is in GBP.', 422, 'currency_mismatch'));
    renderPage();
    pick('copious');
    fillLine();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/is billed in GBP/);
  });

  it('says drafts are pushed to Xero separately', () => {
    renderPage();
    expect(screen.getByText(/Push it to Xero from the invoice page/)).toBeInTheDocument();
  });
});
