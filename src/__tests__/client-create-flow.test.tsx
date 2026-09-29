import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientCreatePage } from '../pages/clients/create';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b1', clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/use-clients', () => ({
  useCreateClient: () => ({
    mutateAsync: mockMutate,
    isPending: false,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/clients/create']}>
        <Routes>
          <Route path="/clients/create" element={<ClientCreatePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockMutate.mockReset();
  mockMutate.mockResolvedValue({ id: 'new-client-id', companyName: 'Acme Ltd', companyNumber: '12345678' });
});

describe('ClientCreatePage — buyer creation flow (Roadmap B)', () => {
  function fillRequired() {
    // Slice 1 Day 2: Contact Details card was replaced by a Contacts repeater.
    // The first row is the locked-Primary contact; its name/email placeholders
    // changed from "John Smith"/"john@acme.co.uk" to "Jamie Roberts"/"jamie@uken.co.uk".
    fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'Acme Ltd' } });
    fireEvent.change(screen.getByPlaceholderText('Jamie Roberts'), { target: { value: 'John Smith' } });
    fireEvent.change(screen.getByPlaceholderText('jamie@uken.co.uk'), { target: { value: 'john@acme.co.uk' } });
  }

  // S5 (Sam feedback 2026-09-29): the toggle defaults OFF now.
  it('renders the "Send agreement immediately" toggle, default OFF', () => {
    renderPage();
    const toggle = screen.getByLabelText(/send agreement immediately/i) as HTMLInputElement;
    expect(toggle).not.toBeChecked();
  });

  it('redirects to plain /clients/:id by default', async () => {
    renderPage();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clients/new-client-id');
    });
  });

  it('redirects to /clients/:id?send-agreement=1 when the toggle is ticked', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText(/send agreement immediately/i));
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clients/new-client-id?send-agreement=1');
    });
  });
});

// M5 / S4 (Sam feedback 2026-09-29) — non-UK clients.
describe('ClientCreatePage — international setup', () => {
  function fillRequired() {
    fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'Yash Test Zurich AG' } });
    fireEvent.change(screen.getByPlaceholderText('Jamie Roberts'), { target: { value: 'Yash Test' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'yash.test@example.com' } });
  }

  it('picking Switzerland sets CHF, reverse charge and Swiss labels', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Switzerland' } });
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('CHF');
    expect((screen.getByLabelText('VAT treatment') as HTMLSelectElement).value).toBe('reverse_charge');
    expect(screen.getByLabelText('UID (company ID)')).toHaveAttribute('placeholder', 'CHE-123.456.789');
    expect(screen.getByLabelText('Canton')).toBeInTheDocument();
    expect(screen.getByLabelText('Postcode')).toHaveAttribute('placeholder', '8001');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('placeholder', '+41 …');
    expect(screen.queryByPlaceholderText('EC4Y 1AA')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('London')).not.toBeInTheDocument();
  });

  it('offers CHF and PLN', () => {
    renderPage();
    const codes = Array.from((screen.getByLabelText('Currency') as HTMLSelectElement).options).map((o) => o.value);
    expect(codes).toEqual(expect.arrayContaining(['GBP', 'EUR', 'USD', 'CHF', 'PLN']));
  });

  it('blocks the save on a junk postcode and a junk phone, with messages', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Switzerland' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '!!!!!!!!' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: 'not-a-phone ###' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    expect(await screen.findByText(/postcode can only contain/i)).toBeInTheDocument();
    expect(screen.getByText(/use digits only/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('blocks a Swiss postcode in the wrong format', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Switzerland' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'EC4Y 1AA' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    expect(await screen.findByText('Switzerland postcodes look like 8001.')).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('warns (without blocking) when a phone has another country code', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Switzerland' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+44 20 7946 0958' } });
    fireEvent.blur(screen.getByLabelText('Phone'));
    expect(screen.getByText(/this is a united kingdom number/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
  });

  it('saves a valid Swiss client with CHF + reverse charge and no legacy VAT tick', async () => {
    renderPage();
    fillRequired();
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Switzerland' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '8001' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+41 44 668 18 00' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    const body = mockMutate.mock.calls[0][0];
    expect(body).toMatchObject({ addressCountry: 'Switzerland', addressPostcode: '8001', currency: 'CHF', vatTreatment: 'reverse_charge' });
    expect(body).not.toHaveProperty('vatRegistered');
    expect(body).not.toHaveProperty('addVatToInvoices');
    expect(body.contacts[0].phone).toBe('+41 44 668 18 00');
  });

  it('N3 — labels the Endole field as the credit provider ID, not Companies House', () => {
    renderPage();
    expect(screen.getByText('Credit check provider ID (Endole)')).toBeInTheDocument();
    expect(screen.getByLabelText('Companies House number')).toHaveAttribute('id', 'nc-company-number');
  });
});
