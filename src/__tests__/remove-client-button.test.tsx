import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RemoveClientButton } from '../components/clients/edit-client-dialog';
import type { ClientDetail } from '../lib/hooks/use-clients';

const { mockDelete, mockNavigate } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/hooks/use-clients', () => ({
  useDeleteClient: () => ({ mutateAsync: mockDelete, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseClient = {
  id: 'client-1',
  companyName: 'Acme Ltd',
} as ClientDetail;

function renderButton() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RemoveClientButton client={baseClient} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockDelete.mockReset();
  mockDelete.mockResolvedValue(true);
  mockNavigate.mockReset();
});

describe('RemoveClientButton', () => {
  it('opens a confirmation dialog naming the client', () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /remove client/i }));
    expect(screen.getByText('Remove client')).toBeInTheDocument();
    expect(screen.getByText(/type/i)).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until the company name is typed exactly', () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /remove client/i }));
    // The destructive confirm button inside the dialog (the second match).
    const confirm = screen.getAllByRole('button', { name: /remove client/i }).pop()!;
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'Acme' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'Acme Ltd' } });
    expect(confirm).toBeEnabled();
  });

  it('deletes the client and navigates back to /clients on confirm', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /remove client/i }));
    fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'Acme Ltd' } });
    const confirm = screen.getAllByRole('button', { name: /remove client/i }).pop()!;
    fireEvent.click(confirm);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('client-1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/clients'));
  });

  it('does not delete when the typed name does not match', () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /remove client/i }));
    fireEvent.change(screen.getByPlaceholderText('Acme Ltd'), { target: { value: 'Wrong Name' } });
    const confirm = screen.getAllByRole('button', { name: /remove client/i }).pop()!;
    fireEvent.click(confirm);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
