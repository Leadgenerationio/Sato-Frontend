import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTaskCategories } from '../lib/hooks/use-tasks';
import { api } from '../lib/api';

// Sam-Loom (jam-video #5) — the create-form datalist autocomplete feed.
// Pins the contract: GET /api/v1/tasks/categories → { data: { categories } }.

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTaskCategories', () => {
  it('GETs /api/v1/tasks/categories and returns the categories array', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      status: 'success',
      data: { categories: ['Compliance', 'Finance', 'Marketing'] },
    } as Awaited<ReturnType<typeof api.get>>);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTaskCategories(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/v1/tasks/categories');
    expect(result.current.data).toEqual(['Compliance', 'Finance', 'Marketing']);
  });

  it('returns an empty array when the server has no categories yet', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      status: 'success',
      data: { categories: [] },
    } as Awaited<ReturnType<typeof api.get>>);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTaskCategories(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
