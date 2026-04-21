import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mutateAsyncMock = vi.fn();
let pendingState = false;
let errorState = false;

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: pendingState,
    isError: errorState,
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { FileUpload } from '../components/shared/file-upload';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('FileUpload', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    pendingState = false;
    errorState = false;
  });

  it('renders a button with the supplied label', () => {
    render(wrap(<FileUpload folder="creatives" label="Attach creative" />));
    expect(screen.getByText('Attach creative')).toBeTruthy();
  });

  it('calls upload mutation with the selected file', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ key: 'abc', configured: true });
    render(wrap(<FileUpload folder="agreements" />));
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock.mock.calls[0][0]).toEqual({ file, folder: 'agreements' });
  });

  it('rejects files over the size limit without calling the mutation', () => {
    render(wrap(<FileUpload folder="misc" maxSizeMB={1} />));
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    const bigBuf = new Uint8Array(2 * 1024 * 1024);
    const file = new File([bigBuf], 'huge.bin', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
