import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from '../pages/notifications';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: () => ({
    data: {
      notifications: [
        { id: 'n-1', type: 'invoice_overdue', title: 'Invoice Overdue', message: 'INV-1042 is 7 days overdue', read: false, createdAt: '2026-04-15T10:00:00Z' },
        { id: 'n-2', type: 'payment_received', title: 'Payment Received', message: '£3,200 from Clearwater Digital', read: true, createdAt: '2026-04-14T09:00:00Z' },
        { id: 'n-3', type: 'credit_alert', title: 'Credit Alert', message: 'Delta Solutions score dropped to 42', read: false, createdAt: '2026-04-13T08:00:00Z' },
      ],
      total: 3,
      page: 1,
      pageSize: 50,
    },
    isLoading: false,
    error: null,
  }),
  useMarkAsRead: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useMarkAllAsRead: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><NotificationsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsPage', () => {
  it('renders Notifications heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /notifications/i })).toBeInTheDocument();
  });

  it('renders notification items', () => {
    renderPage();
    expect(screen.getByText('Invoice Overdue')).toBeInTheDocument();
    expect(screen.getByText('Payment Received')).toBeInTheDocument();
    expect(screen.getByText('Credit Alert')).toBeInTheDocument();
  });

  it('renders Mark all read button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
  });

  it('renders All and Unread filter tabs', () => {
    renderPage();
    expect(screen.getByText('all')).toBeInTheDocument();
    expect(screen.getByText('unread')).toBeInTheDocument();
  });
});
