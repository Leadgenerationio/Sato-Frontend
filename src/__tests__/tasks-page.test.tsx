import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TasksPage } from '../pages/tasks/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-tasks', () => ({
  useTasks: () => ({
    data: {
      tasks: [
        { id: 'task-1', title: 'Review monthly invoices', description: 'Check all invoices for April', status: 'in_progress', priority: 'high', assignee: 'Sam Owner', category: 'Finance', dueDate: '2026-04-20', createdBy: 'Sam Owner', createdAt: '2026-04-10T09:00:00Z' },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
    error: null,
  }),
  useTaskStats: () => ({
    data: { total: 12, inProgress: 4, completedToday: 2, overdue: 1 },
    isLoading: false,
    error: null,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TasksPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TasksPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /tasks/i })).toBeInTheDocument();
  });

  it('renders task in table', () => {
    renderPage();
    expect(screen.getByText('Review monthly invoices')).toBeInTheDocument();
    expect(screen.getByText('Sam Owner')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    renderPage();
    expect(screen.getAllByText(/^All$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/To Do/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/In Progress/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Blocked/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders New Task button', () => {
    renderPage();
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });
});
