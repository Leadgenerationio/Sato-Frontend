import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mutateAsyncMock = vi.fn();
let pendingState = false;
const fetchFreshDownloadUrlMock = vi.fn();

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: pendingState,
    isError: false,
  }),
  fetchFreshDownloadUrl: (...args: unknown[]) => fetchFreshDownloadUrlMock(...args),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { DocumentsTab } from '../pages/clients/detail';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('DocumentsTab', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    fetchFreshDownloadUrlMock.mockReset();
    pendingState = false;
    window.localStorage.clear();
  });

  it('shows the empty state when no docs are stored', () => {
    render(wrap(<DocumentsTab clientId="client-empty" />));
    expect(screen.getByText(/No documents uploaded yet/i)).toBeTruthy();
  });

  it('persists an uploaded doc to localStorage and renders it', async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      key: '1700000000-contract.pdf',
      folder: 'misc',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      configured: true,
      uploadUrl: 'https://signed/upload',
      downloadUrl: 'https://signed/download',
    });

    render(wrap(<DocumentsTab clientId="client-1" />));

    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    const file = new File(['pdf-bytes'], 'contract.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    // Empty-state copy disappears once a doc is added to the list.
    await waitFor(() => expect(screen.queryByText(/No documents uploaded yet/i)).toBeNull());
    // The filename renders in two places (FileUpload's success indicator + the docs list row).
    expect(screen.getAllByText('contract.pdf').length).toBeGreaterThanOrEqual(1);

    const stored = JSON.parse(window.localStorage.getItem('stato:client-docs:client-1')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe('1700000000-contract.pdf');
    expect(stored[0].name).toBe('contract.pdf');
  });

  it('reads previously-stored docs on mount and isolates per clientId', () => {
    window.localStorage.setItem(
      'stato:client-docs:client-A',
      JSON.stringify([
        {
          key: 'k1',
          folder: 'misc',
          name: 'nda-a.pdf',
          size: 1024,
          contentType: 'application/pdf',
          uploadedAt: '2026-04-27T12:00:00.000Z',
        },
      ]),
    );
    window.localStorage.setItem(
      'stato:client-docs:client-B',
      JSON.stringify([
        {
          key: 'k2',
          folder: 'misc',
          name: 'invoice-b.pdf',
          size: 2048,
          contentType: 'application/pdf',
          uploadedAt: '2026-04-27T12:00:00.000Z',
        },
      ]),
    );

    const { rerender } = render(wrap(<DocumentsTab clientId="client-A" />));
    expect(screen.getByText('nda-a.pdf')).toBeTruthy();
    expect(screen.queryByText('invoice-b.pdf')).toBeNull();

    rerender(wrap(<DocumentsTab clientId="client-B" />));
    expect(screen.getByText('invoice-b.pdf')).toBeTruthy();
    expect(screen.queryByText('nda-a.pdf')).toBeNull();
  });

  it('fetches a fresh signed URL when downloading', async () => {
    window.localStorage.setItem(
      'stato:client-docs:client-X',
      JSON.stringify([
        {
          key: 'doc-key-123',
          folder: 'misc',
          name: 'report.pdf',
          size: 512,
          contentType: 'application/pdf',
          uploadedAt: '2026-04-27T12:00:00.000Z',
        },
      ]),
    );
    fetchFreshDownloadUrlMock.mockResolvedValueOnce('https://signed/fresh');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(wrap(<DocumentsTab clientId="client-X" />));
    const downloadBtn = screen.getByLabelText('Download');
    fireEvent.click(downloadBtn);

    await waitFor(() => expect(fetchFreshDownloadUrlMock).toHaveBeenCalledWith('misc', 'doc-key-123'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://signed/fresh', '_blank', 'noopener,noreferrer'));
    openSpy.mockRestore();
  });

  it('removes a doc from list and from localStorage when trash is clicked', async () => {
    window.localStorage.setItem(
      'stato:client-docs:client-Y',
      JSON.stringify([
        {
          key: 'doc-removable',
          folder: 'misc',
          name: 'old.pdf',
          size: 256,
          contentType: 'application/pdf',
          uploadedAt: '2026-04-27T12:00:00.000Z',
        },
      ]),
    );

    render(wrap(<DocumentsTab clientId="client-Y" />));
    expect(screen.getByText('old.pdf')).toBeTruthy();

    const removeBtn = screen.getByLabelText('Remove from list');
    fireEvent.click(removeBtn);

    await waitFor(() => expect(screen.queryByText('old.pdf')).toBeNull());
    const remaining = JSON.parse(window.localStorage.getItem('stato:client-docs:client-Y')!);
    expect(remaining).toHaveLength(0);
  });
});
