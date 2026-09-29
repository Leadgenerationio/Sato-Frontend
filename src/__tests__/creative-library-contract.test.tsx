import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCreateLibraryCreatives, toCreativesRequest } from '@/lib/hooks/use-creative-library';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/api', () => ({ api, unwrap: <T,>(res: { data?: T }) => res.data as T }));

// Found in the final end-to-end test (Sam round 1, M2): the upload dialog posted { files: [...] } and the
// API answered 400 "Invalid input", so no creative was ever saved. The API takes { creatives: [...] } with a
// mediaType on each, and answers with one result per file.
const file = { r2Key: 'k1.png', name: 'a.png', contentType: 'image/png', sizeBytes: 10, sha256: 'a'.repeat(64), width: 1080, height: 1080 };

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => api.post.mockReset());

describe('toCreativesRequest', () => {
  it('sends { creatives } with a mediaType per file, not { files }', () => {
    const body = toCreativesRequest({
      clientId: 'c1', campaignId: 'k1', landingPageUrl: 'https://example.com/x',
      files: [file, { ...file, r2Key: 'k2.mp4', name: 'b.mp4', contentType: 'video/mp4', durationS: 12 }],
    });
    expect(body).not.toHaveProperty('files');
    expect(body.creatives).toHaveLength(2);
    expect(body.creatives[0]).toMatchObject({ clientId: 'c1', campaignId: 'k1', landingPageUrl: 'https://example.com/x', mediaType: 'image', r2Key: 'k1.png', name: 'a.png', width: 1080 });
    expect(body.creatives[1]).toMatchObject({ mediaType: 'video', durationS: 12 });
  });

  it('leaves out anything not chosen (the API rejects nulls it does not expect)', () => {
    const json = JSON.parse(JSON.stringify(toCreativesRequest({ files: [file] })));
    expect(json.creatives[0]).not.toHaveProperty('clientId');
    expect(json.creatives[0]).not.toHaveProperty('landingPageUrl');
    expect(json.creatives[0]).not.toHaveProperty('durationS');
  });
});

describe('useCreateLibraryCreatives', () => {
  it('reads the per-file results: saved, already-there, and refused', async () => {
    api.post.mockResolvedValue({ data: { results: [
      { id: 'a', created: true, creative: { id: 'a' } },
      { id: 'b', created: false, creative: { id: 'b' } },
      { index: 2, status: 400, error: 'Landing page URL is not valid.' },
    ] } });
    const { result } = renderHook(() => useCreateLibraryCreatives(), { wrapper: wrapper() });
    let out!: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => { out = await result.current.mutateAsync({ clientId: 'c1', files: [file, file, file] }); });
    expect(out.creatives.map((c) => c.id)).toEqual(['a', 'b']);
    expect(out.duplicates).toBe(1);
    expect(out.failures).toEqual([{ index: 2, message: 'Landing page URL is not valid.' }]);
    expect(api.post).toHaveBeenCalledWith('/api/v1/creatives', expect.objectContaining({ creatives: expect.any(Array) }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
