import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditClientDialog } from '../components/clients/edit-client-dialog';
import type { ClientDetail } from '../lib/hooks/use-clients';

const { mockMutate } = vi.hoisted(() => ({ mockMutate: vi.fn() }));
vi.mock('@/lib/hooks/use-clients', () => ({
  useUpdateClient: () => ({ mutateAsync: mockMutate, isPending: false }),
  useDeleteClient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base: ClientDetail = {
  id: 'client-1', clientType: 'ppl', companyName: 'Sonova audiological care polska sp. z o.o',
  companyNumber: '0', contactName: 'Sam Wynne', contactEmail: 'sam@example.com', contactPhone: '+48 22 123 45 67',
  address: '', addressLine: 'ul. Marszałkowska 1', addressTown: 'Warszawa', addressCounty: '',
  addressCountry: 'Poland', addressPostcode: '00-950', status: 'onboarding', currency: 'EUR',
  paymentTermsDays: 30, vatRegistered: true, addVatToInvoices: false, vatTreatment: 'reverse_charge',
  vatNumber: '', vatRate: 20, leadPrice: 15, billingWorkflow: 'custom', onboardingStatus: 'pending',
  agreementSigned: false, creditScore: null, creditLastChecked: null, creditRiskRating: null,
  leadbyteClientId: null, endoleCompanyId: null, xeroContactId: null, notes: '', activeCampaigns: 0,
  totalRevenue: 0, createdAt: '2026-01-01T00:00:00Z', documentsCount: 0,
  contacts: [{ id: 'c1', contactType: 'primary', name: 'Sam Wynne', email: 'sam@example.com', phone: '+48 22 123 45 67', role: '' }],
};

function renderDialog(client: ClientDetail) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><EditClientDialog client={client} open onOpenChange={vi.fn()} /></MemoryRouter>
    </QueryClientProvider>,
  );
}
const save = () => fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

beforeEach(() => {
  mockMutate.mockReset();
  mockMutate.mockResolvedValue(base);
});

describe('Edit Client: international clients (Sam M5)', () => {
  it('shows the stored country as a picker value, not free text', () => {
    renderDialog(base);
    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('PL');
    expect((screen.getByLabelText(/vat treatment/i) as HTMLSelectElement).value).toBe('reverse_charge');
    expect(screen.getByText('KRS / NIP (Polish company number)')).toBeInTheDocument();
  });

  it('offers Paused (Sam M4) and CHF/PLN', () => {
    renderDialog(base);
    const status = screen.getByDisplayValue('Onboarding') as HTMLSelectElement;
    expect(Array.from(status.options).map((o) => o.value)).toContain('paused');
    const currency = screen.getByDisplayValue('EUR (€)') as HTMLSelectElement;
    expect(Array.from(currency.options).map((o) => o.value)).toEqual(expect.arrayContaining(['CHF', 'PLN']));
  });

  it('saves the treatment with the matching legacy flags', async () => {
    renderDialog(base);
    fireEvent.change(screen.getByLabelText(/vat treatment/i), { target: { value: 'outside_scope' } });
    save();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      addressCountry: 'Poland', vatTreatment: 'outside_scope', vatRegistered: false, addVatToInvoices: false,
    });
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('countryCode');
  });

  it('derives the treatment for a record saved before vat_treatment existed', () => {
    renderDialog({ ...base, vatTreatment: undefined, vatRegistered: true, addVatToInvoices: true });
    expect((screen.getByLabelText(/vat treatment/i) as HTMLSelectElement).value).toBe('uk_standard');
  });

  it('keeps a country it cannot match instead of rewriting it', async () => {
    renderDialog({ ...base, addressCountry: 'Narnia', addressPostcode: '' });
    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('__stored__');
    save();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0].addressCountry).toBe('Narnia');
  });

  it('leaves a blank country blank (it used to become "United Kingdom" on every save)', async () => {
    renderDialog({ ...base, addressCountry: '', addressPostcode: '' });
    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('');
    save();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0].addressCountry).toBe('');
  });

  it('does not block an unrelated edit because of an old odd phone or postcode', async () => {
    renderDialog({
      ...base, contactPhone: '01706 123456', addressPostcode: 'weird!',
      contacts: [{ ...base.contacts[0], phone: '01706 123456' }],
    });
    fireEvent.change(screen.getByDisplayValue('Onboarding'), { target: { value: 'active' } });
    save();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  });

  it('does not block on an old company number that is too long, but checks one that was edited', async () => {
    renderDialog({ ...base, companyNumber: '1'.repeat(25) });
    fireEvent.change(screen.getByDisplayValue('Onboarding'), { target: { value: 'active' } });
    save();
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
  });

  it('checks a phone that was edited', async () => {
    renderDialog(base);
    fireEvent.change(screen.getByDisplayValue('+48 22 123 45 67'), { target: { value: '+44 20 1234 5678' } });
    save();
    expect(await screen.findByText(/Poland numbers start with \+48/)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('re-checks the postcode when the country changes', async () => {
    renderDialog(base);
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
    save();
    expect(await screen.findByText(/Not a valid Switzerland postcode/)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
