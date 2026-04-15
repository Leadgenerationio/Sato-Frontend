import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

export function DashboardLayout() {
  const { sidebarOpen } = useUiStore();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />
      <main className={cn(
        'mt-16 p-4 sm:p-6 transition-all duration-300',
        sidebarOpen ? 'md:ml-64' : 'md:ml-16',
        'max-md:ml-0',
      )}>
        <Outlet />
      </main>
    </div>
  );
}
