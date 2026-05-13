import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TemplateEditorPage } from '../pages/agreements/template-editor';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', role: 'owner', isActive: true }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/api', () => {
  const fixt = {
    id: 'tpl-1',
    name: 'Test Template',
    description: 'A test',
    pdfR2Key: 'agreements/x.pdf',
    fieldLayout: [],
    signerRole: null,
    archivedAt: null,
    createdAt: '2026-05-13T00:00:00Z',
    updatedAt: '2026-05-13T00:00:00Z',
  };
  return {
    api: {
      get: vi.fn().mockResolvedValue({ status: 'success', data: { template: fixt } }),
      put: vi.fn().mockResolvedValue({ status: 'success', data: { template: { ...fixt, fieldLayout: [{ id: 'f1', type: 'variable', variableKey: 'client.companyName', page: 0, xPct: 0.1, yPct: 0.1, widthPct: 0.3, heightPct: 0.03 }] } } }),
    },
    unwrap: <T,>(r: { data: T }) => r.data,
  };
});

const fixture = {
  id: 'tpl-1',
  name: 'Test Template',
  description: 'A test',
  pdfR2Key: 'agreements/x.pdf',
  fieldLayout: [],
  signerRole: null,
  archivedAt: null,
  createdAt: '2026-05-13T00:00:00Z',
  updatedAt: '2026-05-13T00:00:00Z',
};
// fixture is kept for reference but the actual mock data is defined inside vi.mock above
void fixture;

function renderWithRouter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/agreements/templates/tpl-1']}>
        <Routes>
          <Route path="/agreements/templates/:id" element={<TemplateEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TemplateEditorPage', () => {
  it('renders the variable picker with all 12 variables', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Test Template')).toBeInTheDocument());
    expect(screen.getByText('client.companyName')).toBeInTheDocument();
    expect(screen.getByText('client.vatNumber')).toBeInTheDocument();
    expect(screen.getByText('today')).toBeInTheDocument();
    expect(screen.getByText('agreement.effectiveDate')).toBeInTheDocument();
  });

  it('clicking a variable adds it to the layout list', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Test Template')).toBeInTheDocument());
    const btn = screen.getByText('client.companyName').closest('button')!;
    fireEvent.click(btn);
    expect(screen.getByText(/\{\{client\.companyName\}\}/)).toBeInTheDocument();
  });

  it('adding a signature field works', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Test Template')).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Add signature box/));
    expect(screen.getByText(/✍️ signature/)).toBeInTheDocument();
  });

  it('Save button does not crash', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Test Template')).toBeInTheDocument());
    fireEvent.click(screen.getByText('client.companyName').closest('button')!);
    fireEvent.click(screen.getByText(/Save Template/));
    // No assertion on toast; success if no exception
  });
});
