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

import { toast } from 'sonner';
import { FileUpload } from '../components/shared/file-upload';
import { CREATIVE_MEDIA_RULE, checkUploadFile } from '../lib/upload-rules';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('FileUpload', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
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

  // Sam feedback S9: "Upload accepts anything (a .exe got as far as the
  // upload request), one file at a time, no preview, raw errors."
  describe('creative uploads (S9)', () => {
    const png = () => new File([new Uint8Array(10)], 'banner.png', { type: 'image/png' });

    it('refuses an .exe before asking the server, with a plain reason', () => {
      render(wrap(<FileUpload folder="creatives" />));
      const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' })] } });
      expect(mutateAsyncMock).not.toHaveBeenCalled();
      expect(vi.mocked(toast.error).mock.calls[0][0]).toBe("setup.exe: this file type can't be uploaded.");
    });

    it('media section refuses a PDF and names what it takes', () => {
      render(wrap(<FileUpload folder="creatives" rule={CREATIVE_MEDIA_RULE} />));
      const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
      expect(input.accept).toContain('image/png');
      expect(input.accept).not.toContain('pdf');
      fireEvent.change(input, { target: { files: [new File(['%PDF'], 'copy.pdf', { type: 'application/pdf' })] } });
      expect(mutateAsyncMock).not.toHaveBeenCalled();
      expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/^copy\.pdf: not a supported file\. Upload images/);
    });

    it('takes several files at once, uploads each, and skips only the bad one', async () => {
      mutateAsyncMock.mockResolvedValue({ key: 'k', configured: true });
      const onUploaded = vi.fn();
      render(wrap(<FileUpload folder="creatives" onUploaded={onUploaded} />));
      const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
      expect(input.multiple).toBe(true);
      const video = new File([new Uint8Array(10)], 'ad.mp4', { type: 'video/mp4' });
      const bad = new File(['x'], 'run.sh', { type: 'application/x-sh' });
      fireEvent.change(input, { target: { files: [png(), video, bad] } });
      await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2));
      expect(mutateAsyncMock.mock.calls.map((c) => c[0].file.name)).toEqual(['banner.png', 'ad.mp4']);
      expect(screen.getAllByTestId('file-upload-thumb')).toHaveLength(1); // image thumbnail
    });

    it('says "File too large" with the limit', () => {
      const big = new File([new Uint8Array(51 * 1024 * 1024)], 'big.mp4', { type: 'video/mp4' });
      expect(checkUploadFile(big, 50, CREATIVE_MEDIA_RULE)).toBe('big.mp4: file too large (51 MB). Max 50 MB.');
    });

    it('shows the server/network reason next to a failed file', async () => {
      mutateAsyncMock.mockRejectedValueOnce(new Error("Couldn't reach the server — nothing was saved."));
      render(wrap(<FileUpload folder="creatives" />));
      fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [png()] } });
      expect(await screen.findByText(/Couldn't reach the server/)).toBeTruthy();
    });

    it('a file whose record fails to save is marked failed, not ticked', async () => {
      mutateAsyncMock.mockResolvedValueOnce({ key: 'k', configured: true });
      const onUploaded = vi.fn().mockRejectedValue(new Error("couldn't be added to the campaign: Campaign not found"));
      render(wrap(<FileUpload folder="creatives" onUploaded={onUploaded} />));
      fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [png()] } });
      await waitFor(() => expect(screen.getByTestId('file-upload-items').querySelector('li')?.dataset.status).toBe('error'));
      expect(screen.getByText(/Campaign not found/)).toBeTruthy();
    });

    it('non-creative folders stay single-file and accept documents', async () => {
      mutateAsyncMock.mockResolvedValueOnce({ key: 'k', configured: true });
      render(wrap(<FileUpload folder="misc" />));
      const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
      expect(input.multiple).toBe(false);
      fireEvent.change(input, { target: { files: [new File(['z'], 'receipts.zip', { type: 'application/zip' })] } });
      await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    });
  });
});
