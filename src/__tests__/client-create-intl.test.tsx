import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientCreatePage } from '../pages/clients/create';

const { mockNavigate, mockMutate } = vi.hoisted(() => ({ mockNavigate: vi.fn(), mockMutate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/lib/hooks/use-clients', () => ({
  useCreateClient: () => ({ mutateAsync: mockMutate, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/clients/create']}>
        <Routes><Route path="/clients/create" element={<ClientCreatePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const country = () => screen.getByLabelText('Country') as HTMLSelectElement;
const currency = () => screen.getByDisplayValue(/GBP|CHF|EUR|PLN|USD/) as HTMLSelectElement;
const vat = () => screen.getByLabelText('VAT treatment') as HTMLSelectElement;

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'UX TEST - Bahnhof AG' } });
  fireEvent.change(screen.getByPlaceholderText('Jamie Roberts'), { target: { value: 'Hans Muster' } });
  fireEvent.change(screen.getByPlaceholderText('jamie@uken.co.uk'), { target: { value: 'hans@bahnhof.ch' } });
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockMutate.mockReset();
  mockMutate.mockResolvedValue({ id: 'c1', companyName: 'UX TEST - Bahnhof AG', companyNumber: '' });
});

describe('New Client: countries outside the UK (Sam M5)', () => {
  it('starts as a UK client with UK VAT and GBP', () => {
    renderPage();
    expect(country().value).toBe('GB');
    expect(vat().value).toBe('uk_standard');
    expect(currency().value).toBe('GBP');
    expect(screen.getByText('Companies House number')).toBeInTheDocument();
  });

  it('choosing Switzerland sets CHF and outside-scope VAT and swaps the UK-only fields', () => {
    renderPage();
    fireEvent.change(country(), { target: { value: 'CH' } });
    expect(currency().value).toBe('CHF');
    expect(vat().value).toBe('outside_scope');
    expect(screen.queryByText('Companies House number')).not.toBeInTheDocument();
    expect(screen.getByText('UID (Swiss company number)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('8001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+41 44 668 18 00')).toBeInTheDocument();
  });

  it('does not overwrite a currency the user picked themselves', () => {
    renderPage();
    fireEvent.change(currency(), { target: { value: 'EUR' } });
    fireEvent.change(country(), { target: { value: 'CH' } });
    expect(currency().value).toBe('EUR');
    expect(vat().value).toBe('outside_scope');
  });

  it('offers CHF, PLN and every VAT treatment', () => {
    renderPage();
    const codes = Array.from(currency().options).map((o) => o.value);
    expect(codes).toEqual(expect.arrayContaining(['GBP', 'EUR', 'USD', 'CHF', 'PLN']));
    expect(Array.from(vat().options).map((o) => o.value)).toEqual(
      ['uk_standard', 'uk_zero_rated', 'reverse_charge', 'outside_scope'],
    );
  });

  it('blocks junk phone and postcode and shows why', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(country(), { target: { value: 'CH' } });
    fireEvent.change(screen.getByPlaceholderText('8001'), { target: { value: '!!!!!!!!' } });
    fireEvent.change(screen.getByPlaceholderText('+41 44 668 18 00'), { target: { value: 'not-a-phone ###' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent).join(' ')).toMatch(/postcode/i);
    expect(alerts.map((a) => a.textContent).join(' ')).toMatch(/phone/i);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('rejects a UK number on a Swiss client', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(country(), { target: { value: 'CH' } });
    fireEvent.change(screen.getByPlaceholderText('+41 44 668 18 00'), { target: { value: '+44 20 1234 5678' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    expect(await screen.findByText(/Switzerland numbers start with \+41/)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('saves a Swiss client with its country, currency and VAT treatment', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(country(), { target: { value: 'CH' } });
    fireEvent.change(screen.getByPlaceholderText('8001'), { target: { value: '8001' } });
    fireEvent.change(screen.getByPlaceholderText('+41 44 668 18 00'), { target: { value: '+41 44 668 18 00' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    const body = mockMutate.mock.calls[0][0];
    expect(body).toMatchObject({
      addressCountry: 'Switzerland',
      addressPostcode: '8001',
      currency: 'CHF',
      vatTreatment: 'outside_scope',
      vatRegistered: false,
      addVatToInvoices: false,
    });
    expect(body).not.toHaveProperty('countryCode');
    expect(body.contacts[0].phone).toBe('+41 44 668 18 00');
  });

  it('reverse charge keeps the VAT number field but hides the UK rate', () => {
    renderPage();
    fireEvent.change(country(), { target: { value: 'PL' } });
    expect(vat().value).toBe('reverse_charge');
    expect(screen.getByPlaceholderText('PL1234567890')).toBeInTheDocument();
    expect(screen.queryByText('VAT Rate (%)')).not.toBeInTheDocument();
    fireEvent.change(vat(), { target: { value: 'uk_standard' } });
    expect(screen.getByText('VAT Rate (%)')).toBeInTheDocument();
  });

  it('a UK client still saves as before (UK VAT, GBP)', async () => {
    renderPage();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      addressCountry: 'United Kingdom', currency: 'GBP', vatTreatment: 'uk_standard', vatRegistered: true, addVatToInvoices: true, vatRate: 20,
    });
  });
});
