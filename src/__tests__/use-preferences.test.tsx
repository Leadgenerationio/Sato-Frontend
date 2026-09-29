import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useServerPreference } from '@/lib/hooks/use-preferences';

// Feedback N2 (29 Sep 2026): preferences follow the user across devices.
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api,
  unwrap: <T,>(res: { data?: T }) => res.data as T,
}));
vi.mock('@/lib/log', () => ({ logError: vi.fn() }));

const decode = (raw: unknown) => (raw === 'flat' || raw === 'vertical' ? raw : undefined);
const KEY = 'stato:campaigns:groupMode';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  api.get.mockReset();
  api.put.mockReset().mockResolvedValue({ data: {} });
});

describe('useServerPreference()', () => {
  it('uses the server value over this browser, and caches it locally', async () => {
    localStorage.setItem(KEY, 'vertical');
    api.get.mockResolvedValue({ data: { preferences: { campaignGrouping: 'flat' } } });
    const { result } = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: wrapper() });
    expect(result.current[0]).toBe('vertical'); // instant, from the cache
    await waitFor(() => expect(result.current[0]).toBe('flat'));
    expect(localStorage.getItem(KEY)).toBe('flat');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('uploads an existing local value once when the server has none (no one loses their setting)', async () => {
    localStorage.setItem(KEY, 'flat');
    api.get.mockResolvedValue({ data: { preferences: {} } });
    const { result } = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: wrapper() });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/users/me/preferences', { campaignGrouping: 'flat' }));
    expect(result.current[0]).toBe('flat');
  });

  it('saves a change to the server and locally', async () => {
    api.get.mockResolvedValue({ data: { preferences: {} } });
    const { result } = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: wrapper() });
    act(() => result.current[1]('flat'));
    expect(result.current[0]).toBe('flat');
    expect(localStorage.getItem(KEY)).toBe('flat');
    expect(api.put).toHaveBeenCalledWith('/api/v1/users/me/preferences', { campaignGrouping: 'flat' });
  });

  it('a late server response does not undo a change the user just made', async () => {
    let resolve!: (v: unknown) => void;
    api.get.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: wrapper() });
    act(() => result.current[1]('flat'));
    await act(async () => { resolve({ data: { preferences: { campaignGrouping: 'vertical' } } }); });
    expect(result.current[0]).toBe('flat');
  });

  it('a change made mid-fetch survives the next mount (stale answer never reaches the cache)', async () => {
    let resolve!: (v: unknown) => void;
    api.get.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const first = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: w });
    act(() => first.result.current[1]('flat'));
    await act(async () => { resolve({ data: { preferences: { campaignGrouping: 'vertical' } } }); });
    first.unmount();
    const second = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: w });
    await new Promise((r) => setTimeout(r, 20));
    expect(second.result.current[0]).toBe('flat');
    expect(localStorage.getItem(KEY)).toBe('flat');
  });

  // A change made before the first GET finishes cancels that GET. It used to write a one-key object
  // into the cache as if it were the server's answer, so a hook for a *different* preference then saw
  // "the server has nothing for me" and uploaded this browser's stale value over the real one.
  it("a change made mid-fetch does not make another preference overwrite the server's saved value", async () => {
    // First GET never answers (it gets cancelled); later GETs return what the server really holds.
    api.get.mockReturnValueOnce(new Promise(() => {}));
    api.get.mockResolvedValue({ data: { preferences: { taskFilters: 'mine' } } });
    localStorage.setItem('stato:tasks:scope', 'all'); // stale value on this browser

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const groupingHook = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: w });
    act(() => groupingHook.result.current[1]('flat'));

    const tasksDecode = (raw: unknown) => (raw === 'mine' || raw === 'all' ? raw : undefined);
    const tasksHook = renderHook(() => useServerPreference('taskFilters', 'stato:tasks:scope', tasksDecode, 'all'), { wrapper: w });
    await waitFor(() => expect(tasksHook.result.current[0]).toBe('mine')); // the server's value wins

    const uploads = api.put.mock.calls.map((c) => c[1]);
    expect(uploads).toContainEqual({ campaignGrouping: 'flat' });
    expect(uploads).not.toContainEqual({ taskFilters: 'all' });
  });

  it('keeps working from localStorage when the preferences call fails (older backend)', async () => {
    localStorage.setItem(KEY, 'flat');
    api.get.mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current[0]).toBe('flat');
  });

  it('ignores a malformed stored value', async () => {
    api.get.mockResolvedValue({ data: { preferences: { campaignGrouping: 42 } } });
    const { result } = renderHook(() => useServerPreference('campaignGrouping', KEY, decode, 'vertical'), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current[0]).toBe('vertical');
  });
});
