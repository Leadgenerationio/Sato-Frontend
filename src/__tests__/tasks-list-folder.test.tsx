/**
 * Sam (27 May 2026): "Task and subtasks in folders" — option (a):
 * each task in the list view shows a chevron; clicking it expands the
 * row to reveal that task's subtasks as indented child rows.
 *
 * Pins:
 *  1. A toggle button is rendered per task row (aria-label "Show subtasks").
 *  2. Before clicking, no subtask titles are in the DOM.
 *  3. After clicking, the subtask titles appear as new rows below the parent.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TasksPage } from '../pages/tasks/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-tasks', () => ({
  useTasks: () => ({
    data: {
      tasks: [
        {
          id: 'task-1',
          title: 'Review monthly invoices',
          description: '',
          status: 'in_progress',
          priority: 'high',
          assignee: 'Sam',
          category: 'Finance',
          dueDate: '2026-05-30',
          createdBy: 'owner@stato.app',
          createdAt: '2026-05-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
    error: null,
  }),
  useTaskStats: () => ({ data: { total: 1, inProgress: 1, onHold: 0, completedToday: 0, overdue: 0 }, isLoading: false, error: null }),
  useDeleteTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // The folder expand uses useTask to lazy-load subtasks for the expanded
  // row. Mock it to return a task with two subtasks.
  useTask: (id: string) => ({
    data:
      id === 'task-1'
        ? {
            id: 'task-1',
            title: 'Review monthly invoices',
            description: '',
            status: 'in_progress',
            priority: 'high',
            assignee: 'Sam',
            category: 'Finance',
            dueDate: '2026-05-30',
            createdBy: 'owner@stato.app',
            createdAt: '2026-05-01T00:00:00Z',
            comments: [],
            auditLog: [],
            subtasks: [
              { id: 's1', taskId: 'task-1', title: 'Pull April CSV from Xero', isDone: false, position: 0, createdAt: '', updatedAt: '' },
              { id: 's2', taskId: 'task-1', title: 'Cross-check with bank feed', isDone: true, position: 1, createdAt: '', updatedAt: '' },
            ],
            attachments: [],
            activity: [],
          }
        : undefined,
    isLoading: false,
    error: null,
  }),
  useUpdateSubtask: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TasksPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TasksPage — folder view', () => {
  it('renders a "Show subtasks" toggle per task row', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /show subtasks for review monthly invoices/i })).toBeInTheDocument();
  });

  it('does not render the subtask titles until the toggle is clicked', () => {
    renderPage();
    expect(screen.queryByText('Pull April CSV from Xero')).not.toBeInTheDocument();
    expect(screen.queryByText('Cross-check with bank feed')).not.toBeInTheDocument();
  });

  it('renders the subtask titles as new rows after the toggle is clicked', () => {
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /show subtasks for review monthly invoices/i }),
    );
    expect(screen.getByText('Pull April CSV from Xero')).toBeInTheDocument();
    expect(screen.getByText('Cross-check with bank feed')).toBeInTheDocument();
  });
});
