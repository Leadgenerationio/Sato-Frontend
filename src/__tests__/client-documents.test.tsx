import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientDocument } from '@/lib/hooks/use-clients';

// Slice 1 Day 3 rewrite: DocumentsTab was migrated off browser localStorage
// onto React Query backed by /api/v1/clients/:id/documents (Sam Loom #36).
// These tests now mock the new hooks instead of localStorage.

const uploadMutateAsyncMock = vi.fn();
const addMutateAsyncMock = vi.fn();
const removeMutateAsyncMock = vi.fn();
const fetchFreshDownloadUrlMock = vi.fn();

let docsState: ClientDocument[] = [];
let docsIsLoading = false;

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({
    mutateAsync: uploadMutateAsyncMock,
    isPending: false,
    isError: false,
  }),
  fetchFreshDownloadUrl: (...args: unknown[]) => fetchFreshDownloadUrlMock(...args),
}));

vi.mock('@/lib/hooks/use-clients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-clients')>('@/lib/hooks/use-clients');
  return {
    ...actual,
    useClientDocuments: () => ({ data: docsState, isLoading: docsIsLoading }),
    useAddClientDocument: () => ({ mutateAsync: addMutateAsyncMock, isPending: false }),
    useRemoveClientDocument: () => ({ mutateAsync: removeMutateAsyncMock, isPending: false }),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { DocumentsTab } from '../pages/clients/detail';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function makeDoc(over: Partial<ClientDocument> = {}): ClientDocument {
  return {
    id: 'doc-' + Math.random().toString(36).slice(2, 9),
    clientId: 'client-1',
    r2Key: '1700000000-contract.pdf',
    folder: 'misc',
    name: 'contract.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    uploadedBy: 'user-1',
    createdAt: '2026-04-27T12:00:00.000Z',
    ...over,
  };
}

describe('DocumentsTab', () => {
  beforeEach(() => {
    uploadMutateAsyncMock.mockReset();
    addMutateAsyncMock.mockReset();
    removeMutateAsyncMock.mockReset();
    fetchFreshDownloadUrlMock.mockReset();
    docsState = [];
    docsIsLoading = false;
  });

  it('shows the empty state when the API returns zero docs', () => {
    docsState = [];
    render(wrap(<DocumentsTab clientId="client-empty" />));
    expect(screen.getByText(/No documents/i)).toBeTruthy();
  });

  it('renders docs returned by useClientDocuments', () => {
    docsState = [
      makeDoc({ id: 'd-1', name: 'nda-a.pdf' }),
      makeDoc({ id: 'd-2', name: 'invoice-b.pdf' }),
    ];
    render(wrap(<DocumentsTab clientId="client-A" />));
    expect(screen.getByText('nda-a.pdf')).toBeTruthy();
    expect(screen.getByText('invoice-b.pdf')).toBeTruthy();
  });

  it('persists an uploaded doc through the add-document mutation', async () => {
    uploadMutateAsyncMock.mockResolvedValueOnce({
      key: '1700000000-contract.pdf',
      folder: 'misc',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      configured: true,
      uploadUrl: 'https://signed/upload',
      downloadUrl: 'https://signed/download',
    });
    addMutateAsyncMock.mockResolvedValueOnce(makeDoc({ name: 'contract.pdf' }));

    render(wrap(<DocumentsTab clientId="client-1" />));

    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    const file = new File(['pdf-bytes'], 'contract.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(addMutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(addMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        r2Key: '1700000000-contract.pdf',
        folder: 'misc',
        name: 'contract.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      }),
    );
  });

  it('fetches a fresh signed URL when downloading', async () => {
    docsState = [makeDoc({ id: 'doc-key-123', name: 'report.pdf', r2Key: 'doc-key-123' })];
    fetchFreshDownloadUrlMock.mockResolvedValueOnce('https://signed/fresh');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(wrap(<DocumentsTab clientId="client-X" />));
    const downloadBtn = screen.getByLabelText('Download');
    fireEvent.click(downloadBtn);

    await waitFor(() => expect(fetchFreshDownloadUrlMock).toHaveBeenCalledWith('misc', 'doc-key-123'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://signed/fresh', '_blank', 'noopener,noreferrer'));
    openSpy.mockRestore();
  });

  it('calls the remove mutation when trash is clicked', async () => {
    docsState = [makeDoc({ id: 'doc-removable', name: 'old.pdf' })];
    removeMutateAsyncMock.mockResolvedValueOnce(undefined);

    render(wrap(<DocumentsTab clientId="client-Y" />));
    expect(screen.getByText('old.pdf')).toBeTruthy();

    const removeBtn = screen.getByLabelText('Remove from list');
    fireEvent.click(removeBtn);

    await waitFor(() => expect(removeMutateAsyncMock).toHaveBeenCalledWith('doc-removable'));
  });
});
