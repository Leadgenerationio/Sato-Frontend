import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { Logo } from '@/components/shared/logo';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
        <Logo size="lg" />
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-5 rounded-full border-2 border-neutral-200" />
            <div className="absolute inset-0 size-5 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'client' ? '/portal' : '/'} replace />;
  }

  return <>{children}</>;
}
