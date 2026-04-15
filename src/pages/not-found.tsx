import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neutral-200/40 dark:bg-neutral-800/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neutral-100/60 dark:bg-neutral-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-md mx-auto">
        {/* 404 number */}
        <div className="relative mb-6">
          <span className="text-[10rem] font-extrabold leading-none tracking-tighter text-neutral-100 dark:text-neutral-800 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center">
              <Search className="w-8 h-8 text-white dark:text-neutral-900" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="w-full sm:w-auto gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Button>
          <Button
            onClick={() => navigate(user ? '/' : '/login')}
            className="w-full sm:w-auto gap-2"
          >
            <Home className="w-4 h-4" />
            {user ? 'Dashboard' : 'Login'}
          </Button>
        </div>
      </div>
    </div>
  );
}
