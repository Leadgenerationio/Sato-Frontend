import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateTaskStatus, type PaginatedTasks, type TaskSummary } from '../lib/hooks/use-tasks';
import { api } from '../lib/api';

// Sam-Loom (jam-video #1) — "when I untick it, it takes a while for it to
// untick or it doesn't untick." Cause was useUpdateTaskStatus only had
// onSuccess invalidate, so the badge waited for the network round-trip
// before flipping. These tests pin the new optimistic behavior.

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn().mockResolvedValue({ data: { status: 'success', data: { task: { id: 't-1', status: 'completed' } } } }),
      delete: vi.fn(),
    },
  };
});

const task: TaskSummary = {
  id: 't-1',
  title: 'Test task',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'sam@example.com',
  category: 'general',
  dueDate: null,
  createdBy: 'sam@example.com',
  createdAt: '2026-05-27T00:00:00.000Z',
};

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useUpdateTaskStatus — optimistic cache update', () => {
  it('flips the cached task status before the PATCH resolves', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const filters = { archive: 'today' as const };
    const initial: PaginatedTasks = { tasks: [task], total: 1, page: 1, pageSize: 50 };
    qc.setQueryData(['tasks', filters], initial);

    // Hold the patch open so we can observe the cache state BEFORE the
    // server responds — the whole point of the fix.
    let resolvePatch!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => { resolvePatch = resolve; });
    vi.mocked(api.patch).mockReturnValueOnce(
      pending as ReturnType<typeof api.patch>,
    );

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper: makeWrapper(qc) });

    act(() => {
      void result.current.mutateAsync({ id: 't-1', status: 'completed' });
    });

    // Before the patch resolves, the cache MUST already show 'completed'.
    await waitFor(() => {
      const after = qc.getQueryData<PaginatedTasks>(['tasks', filters]);
      expect(after?.tasks[0]?.status).toBe('completed');
    });

    resolvePatch({ data: { status: 'success', data: { task: { ...task, status: 'completed' } } } });
  });

  it('rolls the cache back if the PATCH fails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const filters = { archive: 'today' as const };
    const initial: PaginatedTasks = { tasks: [task], total: 1, page: 1, pageSize: 50 };
    qc.setQueryData(['tasks', filters], initial);

    vi.mocked(api.patch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 't-1', status: 'completed' }),
      ).rejects.toThrow();
    });

    await waitFor(() => {
      const after = qc.getQueryData<PaginatedTasks>(['tasks', filters]);
      expect(after?.tasks[0]?.status).toBe('todo');
    });
  });

  it('updates every cached list that contains the task (board + list views)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listFilters = { archive: 'today' as const, status: 'todo' };
    const boardFilters = { archive: 'today' as const };
    const initial: PaginatedTasks = { tasks: [task], total: 1, page: 1, pageSize: 50 };
    qc.setQueryData(['tasks', listFilters], initial);
    qc.setQueryData(['tasks', boardFilters], initial);

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: 't-1', status: 'in_progress' });
    });

    const list = qc.getQueryData<PaginatedTasks>(['tasks', listFilters]);
    const board = qc.getQueryData<PaginatedTasks>(['tasks', boardFilters]);
    expect(list?.tasks[0]?.status).toBe('in_progress');
    expect(board?.tasks[0]?.status).toBe('in_progress');
  });
});
