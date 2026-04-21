import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffPage } from '../pages/staff/index';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-staff', () => ({
  useStaffList: () => ({
    data: [
      { id: 's-1', name: 'Sam Carter', email: 'sam@leadgeneration.io', role: 'Managing Director', department: 'Operations', startDate: '2020-01-15', status: 'active', holidaysRemaining: 18, holidaysTaken: 7 },
      { id: 's-2', name: 'Rachel Green', email: 'rachel@leadgeneration.io', role: 'Content Lead', department: 'Content Team', startDate: '2021-03-01', status: 'active', holidaysRemaining: 12, holidaysTaken: 13 },
    ],
    isLoading: false,
    error: null,
  }),
  useStaffStats: () => ({
    data: { totalStaff: 6, activeStaff: 4, openPositions: 3, pendingHolidays: 2 },
    isLoading: false,
    error: null,
  }),
  useJobPostings: () => ({
    data: [
      { id: 'j-1', title: 'Senior Content Strategist', department: 'Content Team', status: 'open', applicantCount: 3, postedDate: '2026-03-20' },
    ],
    isLoading: false,
    error: null,
  }),
  useApplicants: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useHolidayRequests: () => ({
    data: [
      { id: 'h-3', staffId: 's-5', staffName: 'David Patel', type: 'annual', startDate: '2026-04-21', endDate: '2026-04-25', status: 'pending', approvedBy: null },
    ],
    isLoading: false,
    error: null,
  }),
  useApproveHolidayRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectHolidayRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStaff: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateStaff: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateJobPosting: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateHolidayRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><StaffPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StaffPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /staff/i })).toBeInTheDocument();
  });

  it('renders tab triggers', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /team/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recruitment/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /holidays/i })).toBeInTheDocument();
  });

  it('renders staff members in the team table', () => {
    renderPage();
    expect(screen.getByText('Sam Carter')).toBeInTheDocument();
    expect(screen.getByText('sam@leadgeneration.io')).toBeInTheDocument();
    expect(screen.getByText('Rachel Green')).toBeInTheDocument();
  });

  it('renders stats cards', () => {
    renderPage();
    expect(screen.getByText('Total Staff')).toBeInTheDocument();
    expect(screen.getByText('Active Staff')).toBeInTheDocument();
    expect(screen.getByText('Open Positions')).toBeInTheDocument();
    expect(screen.getByText('Pending Holidays')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders department badges', () => {
    renderPage();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Content Team')).toBeInTheDocument();
  });
});
