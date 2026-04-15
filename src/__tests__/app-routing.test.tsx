import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock auth state
const mockUseAuth = vi.fn();

vi.mock('@/components/providers/auth-provider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

// Mock the Logo component used in ProtectedRoute loading state
vi.mock('@/components/shared/logo', () => ({
  Logo: () => <div>Logo</div>,
}));

// Import real ProtectedRoute and NotFoundPage
import { ProtectedRoute } from '@/components/shared/protected-route';
import { NotFoundPage } from '@/pages/not-found';

// Mock heavy page components
const DashboardPage = () => <div data-testid="dashboard-page">Dashboard</div>;
const LoginPage = () => <div data-testid="login-page">Login</div>;
const SettingsPage = () => <div data-testid="settings-page">Settings</div>;
const DashboardLayout = ({ children }: { children?: React.ReactNode }) => {
  const { Outlet } = require('react-router-dom');
  return <div data-testid="dashboard-layout"><Outlet /></div>;
};

function renderApp(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['owner', 'finance_admin', 'ops_manager']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('App Routing', () => {
  describe('unauthenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });
    });

    it('shows login page at /login', () => {
      renderApp('/login');
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('redirects / to /login when not authenticated', () => {
      renderApp('/');
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('shows 404 for unknown routes', () => {
      renderApp('/random-page');
      expect(screen.getByText('Page not found')).toBeInTheDocument();
    });
  });

  describe('authenticated as owner', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
        token: 'test-token',
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });
    });

    it('shows dashboard at /', () => {
      renderApp('/');
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('shows settings for owner', () => {
      renderApp('/settings');
      expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    });
  });

  describe('authenticated as readonly', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '5', email: 'readonly@stato.app', name: 'Readonly', role: 'readonly', isActive: true, businessId: null, clientId: null },
        token: 'test-token',
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });
    });

    it('shows dashboard at /', () => {
      renderApp('/');
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('redirects readonly from /settings to /', () => {
      renderApp('/settings');
      // Should redirect to / which shows dashboard
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });
});
