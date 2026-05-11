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

  it('renders the "Send agreement immediately" toggle, default ON', () => {
    renderPage();
    const toggle = screen.getByLabelText(/send agreement immediately/i) as HTMLInputElement;
    expect(toggle).toBeChecked();
  });

  it('redirects to /clients/:id?send-agreement=1 when toggle is on', async () => {
    renderPage();
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clients/new-client-id?send-agreement=1');
    });
  });

  it('redirects to plain /clients/:id when toggle is off', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText(/send agreement immediately/i));
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clients/new-client-id');
    });
  });
});
