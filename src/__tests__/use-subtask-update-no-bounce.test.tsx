import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateSubtask, useTask, type TaskDetail } from '../lib/hooks/use-tasks';
import { api } from '../lib/api';

// Sam — 27 May 2026 — "the tick in tasks are still jumping around — think
// there is still delay." Activity log shows the same subtask flipping
// completed→reopened→completed multiple times in the same second.
//
// Root cause: useUpdateSubtask's onSettled fired qc.invalidateQueries on
// ['task', taskId], which triggered a refetch via the mounted useTask
// observer. Under rapid clicks the refetch races with the next mutation's
// optimistic flip and stomps it with the server's pre-second-click value
// for a visible blink.
//
// Fix: replace onSettled-invalidate with onSuccess that writes the
// server response directly into the cache. The PATCH already returns
// the authoritative subtask — no need to refetch the whole task.
//
// Test pins the no-refetch invariant deterministically: any unexpected
// api.get('/tasks/<id>') after the mutation settles is a regression.

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

const TASK_ID = 'task-1';
const SUBTASK_ID = 'sub-1';

function makeTask(over: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: TASK_ID,
    title: 'Onboarding',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee: 'sam@example.com',
    category: 'general',
    dueDate: null,
    createdBy: 'sam@example.com',
    createdAt: '2026-05-27T00:00:00.000Z',
    comments: [],
    auditLog: [],
    subtasks: [
      {
        id: SUBTASK_ID,
        taskId: TASK_ID,
        title: 'Send welcome email',
        isDone: false,
        position: 0,
        createdAt: '2026-05-27T00:00:00.000Z',
        updatedAt: '2026-05-27T00:00:00.000Z',
      },
    ],
    attachments: [],
    activity: [],
    ...over,
  };
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useUpdateSubtask — no refetch bounce', () => {
  it('writes the PATCH server response into the cache without triggering a refetch', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData<TaskDetail>(['task', TASK_ID], makeTask());

    // useTask observer needs api.get to return the task on mount/refetch.
    // Track every call so the bug-detection assertion further down can
    // count post-mutation refetches deterministically.
    vi.mocked(api.get).mockImplementation(async () => ({
      status: 'success',
      data: { task: makeTask() },
    }) as Awaited<ReturnType<typeof api.get>>);

    // Server returns the canonical post-click subtask.
    vi.mocked(api.patch).mockResolvedValueOnce({
      status: 'success',
      data: {
        subtask: {
          id: SUBTASK_ID,
          taskId: TASK_ID,
          title: 'Send welcome email',
          isDone: true,
          position: 0,
          createdAt: '2026-05-27T00:00:00.000Z',
          updatedAt: '2026-05-27T00:00:01.000Z',
        },
      },
    } as Awaited<ReturnType<typeof api.patch>>);

    // Mount a useTask observer alongside the mutation so onSettled-invalidate
    // would actually trigger a refetch (without an active observer the
    // invalidate marks-stale but never fetches, and the bug is invisible).
    const { result } = renderHook(
      () => ({
        update: useUpdateSubtask(TASK_ID),
        task: useTask(TASK_ID),
      }),
      { wrapper: makeWrapper(qc) },
    );

    // Let the initial useTask mount fire its first fetch so it doesn't
    // pollute the post-mutation count.
    await waitFor(() =>
      expect(
        vi.mocked(api.get).mock.calls.filter(
          ([url]) => typeof url === 'string' && url === `/api/v1/tasks/${TASK_ID}`,
        ).length,
      ).toBeGreaterThanOrEqual(1),
    );
    const callsBeforeMutation = vi.mocked(api.get).mock.calls.filter(
      ([url]) => typeof url === 'string' && url === `/api/v1/tasks/${TASK_ID}`,
    ).length;

    await act(async () => {
      await result.current.update.mutateAsync({ subtaskId: SUBTASK_ID, isDone: true });
    });

    // Wait long enough for any background refetch to have fired.
    await new Promise((r) => setTimeout(r, 50));

    // The cache should reflect the server's post-click subtask.
    const cached = qc.getQueryData<TaskDetail>(['task', TASK_ID]);
    expect(cached?.subtasks?.[0]?.isDone).toBe(true);

    // The PATCH already returned the authoritative state. A refetch via
    // api.get('/api/v1/tasks/task-1') after the mutation settles would
    // race with subsequent clicks and cause the "jumping tick" Sam
    // reported. Assert no NEW api.get fires post-mutation.
    const callsAfterMutation = vi.mocked(api.get).mock.calls.filter(
      ([url]) => typeof url === 'string' && url === `/api/v1/tasks/${TASK_ID}`,
    ).length;
    expect(callsAfterMutation).toBe(callsBeforeMutation);
  });
});
