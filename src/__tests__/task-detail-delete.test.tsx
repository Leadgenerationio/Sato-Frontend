/**
 * Item 3 (2026-05-22): the Delete button on TaskDetail used to fire a native
 * window.confirm() which vitest/jsdom can't drive. Refactored to a shadcn
 * Dialog confirm-before-delete (matches LinkedClientsCard pattern). These
 * tests pin the new flow: click Delete → dialog opens → confirm fires
 * useDeleteTask().mutateAsync, then navigates back to /tasks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TaskDetail } from '@/lib/hooks/use-tasks';

const { mockNavigate, deleteMutateAsyncMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  deleteMutateAsyncMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, info: vi.fn() },
}));

// Sam-Loom (jam-video #10) — TaskDetailPage now consults useAuth to decide
// whether the requester is the creator (only-creator can delete). Mock a
// user whose email matches the fixture's createdBy so the Delete button
// renders for these tests.
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function makeTask(over: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: 'task-1',
    title: 'Review monthly invoices',
    description: 'Check April invoices',
    status: 'todo',
    priority: 'high',
    assignee: 'Sam Owner',
    category: 'Finance',
    dueDate: '2026-05-30',
    createdBy: 'owner@stato.app',
    createdAt: '2026-05-01T09:00:00Z',
    comments: [],
    auditLog: [],
    subtasks: [],
    attachments: [],
    activity: [],
    timeBlockMinutes: null,
    linkedSopId: null,
    parentTaskId: null,
    recurrenceCron: null,
    recurrenceNextRun: null,
    ...over,
  };
}

vi.mock('@/lib/hooks/use-tasks', () => ({
  useTask: () => ({ data: makeTask(), isLoading: false, error: null }),
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask: () => ({ mutateAsync: deleteMutateAsyncMock, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTaskChildren: () => ({ data: [] }),
  useTasks: () => ({ data: { tasks: [], total: 0, page: 1, pageSize: 10 } }),
  useCreateSubtask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSubtask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSubtask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddTaskAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveTaskAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-sops', () => ({
  useSops: () => ({ data: { sops: [] } }),
}));

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  fetchFreshDownloadUrl: vi.fn(),
}));

import { TaskDetailPage } from '../pages/tasks/detail';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/tasks/task-1']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TaskDetailPage — delete-with-confirm', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    deleteMutateAsyncMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('opens the confirm dialog when Delete is clicked (no immediate mutation)', () => {
    renderPage();
    // The page-header Delete button — distinguished from the dialog's own
    // "Delete task" button by its exact label.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // Dialog title + description should be visible after the click.
    expect(screen.getByText(/Delete task\?/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    // Mutation must NOT have fired yet — confirmation is required first.
    expect(deleteMutateAsyncMock).not.toHaveBeenCalled();
  });

  it('fires useDeleteTask and navigates to /tasks after Confirm', async () => {
    deleteMutateAsyncMock.mockResolvedValueOnce('task-1');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // Inside the dialog the action button is labelled "Delete task" so we can
    // unambiguously target it (the header trigger is just "Delete").
    fireEvent.click(screen.getByRole('button', { name: /Delete task/i }));
    await waitFor(() => {
      expect(deleteMutateAsyncMock).toHaveBeenCalledWith('task-1');
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tasks');
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      expect.stringContaining('Review monthly invoices'),
    );
  });

  it('cancel button closes the dialog without firing the mutation', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/Delete task\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(deleteMutateAsyncMock).not.toHaveBeenCalled();
  });
});
