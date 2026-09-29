/**
 * Creative upload (Sam round 1, M2 + S9): several files at once, a bad file
 * never blocks the good ones, SHA-256 + dimensions sent with each file, and
 * a client is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const presign = vi.fn();
const createMutate = vi.fn();
vi.mock('@/lib/hooks/use-uploads', () => ({ fetchPresignedUpload: (...a: unknown[]) => presign(...a) }));
vi.mock('@/lib/hooks/use-creative-library', () => ({ useCreateLibraryCreatives: () => ({ mutateAsync: createMutate, isPending: false }) }));
vi.mock('@/lib/creative-files', async () => {
  const actual = await vi.importActual<typeof import('@/lib/creative-files')>('@/lib/creative-files');
  return { ...actual, readMediaMeta: async () => ({ width: 1080, height: 1920 }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CreativeUploader } from '@/components/creatives/creative-uploader';

const clients = [{ value: 'c1', label: 'Yash Test Sonova' }];
function renderUp(clientId?: string) {
  return render(<CreativeUploader open onOpenChange={() => {}} clientId={clientId} clientOptions={clients} campaignOptions={[]} />);
}
function drop(files: File[]) {
  fireEvent.change(screen.getByTestId('creative-file-input'), { target: { files } });
}

beforeEach(() => {
  presign.mockReset().mockImplementation(async ({ filename }: { filename: string }) => ({ uploadUrl: 'mock://x', downloadUrl: '', key: `k-${filename}`, folder: 'creatives', contentType: 'image/png', sizeBytes: 3, configured: false }));
  createMutate.mockReset().mockResolvedValue({ creatives: [], duplicates: 0 });
});

describe('CreativeUploader', () => {
  it('refuses a .exe with a plain message but still uploads the images', async () => {
    renderUp('c1');
    drop([
      new File(['abc'], 'hero.png', { type: 'image/png' }),
      new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }),
      new File(['xyz'], 'story.mp4', { type: 'video/mp4' }),
    ]);
    expect(screen.getByText('setup.exe: only images and videos can be uploaded as creatives.')).toBeInTheDocument();
    expect(screen.getByText(/3 files · 1 can't be uploaded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Upload 2 files/ }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const body = createMutate.mock.calls[0][0];
    expect(body.clientId).toBe('c1');
    expect(body.files.map((f: { name: string }) => f.name)).toEqual(['hero.png', 'story.mp4']);
    expect(body.files[0]).toMatchObject({ r2Key: 'k-hero.png', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', width: 1080, height: 1920, sizeBytes: 3 });
    expect(presign).toHaveBeenCalledTimes(2);
    expect(presign.mock.calls.every(([a]) => a.folder === 'creatives')).toBe(true);
  });

  it('needs a client before uploading when none is fixed', () => {
    renderUp();
    drop([new File(['abc'], 'hero.png', { type: 'image/png' })]);
    expect(screen.getByRole('button', { name: /Upload 1 file/ })).toBeDisabled();
    expect(screen.getByText('Choose the client these creatives belong to.')).toBeInTheDocument();
  });

  it('blocks a junk landing page URL', () => {
    renderUp('c1');
    drop([new File(['abc'], 'hero.png', { type: 'image/png' })]);
    fireEvent.change(screen.getByPlaceholderText('https://example.com/offer'), { target: { value: 'not a url' } });
    expect(screen.getByText(/isn't a web address/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload 1 file/ })).toBeDisabled();
  });

  it('a storage failure on one file is reported and the others still save', async () => {
    presign.mockImplementationOnce(async () => { throw new Error("Couldn't reach the server."); });
    renderUp('c1');
    drop([new File(['abc'], 'a.png', { type: 'image/png' }), new File(['abc'], 'b.png', { type: 'image/png' })]);
    fireEvent.click(screen.getByRole('button', { name: /Upload 2 files/ }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0].files.map((f: { name: string }) => f.name)).toEqual(['b.png']);
    const list = within(screen.getByRole('list', { name: 'Files to upload' }));
    expect(list.getByText(/a\.png: Couldn't reach the server\. Nothing was saved for this file\./)).toBeInTheDocument();
  });
});
