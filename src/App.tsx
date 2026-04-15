import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ProtectedRoute } from '@/components/shared/protected-route';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { Toaster } from '@/components/ui/sonner';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { SettingsPage } from '@/pages/settings';
import { NotFoundPage } from '@/pages/not-found';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — dashboard layout */}
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

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
