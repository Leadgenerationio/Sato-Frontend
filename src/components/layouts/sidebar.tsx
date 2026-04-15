import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/shared/logo';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useState } from 'react';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'finance_admin', 'ops_manager'] },
];

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-50 h-screen w-64 border-r bg-sidebar-background transition-transform md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Logo size="sm" />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {filteredNav.map((item) => {
            const isActive = item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href);
            return (
              <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)} className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-sidebar-background transition-all duration-300 hidden md:block',
        sidebarOpen ? 'w-64' : 'w-16',
      )}>
        <div className="flex h-16 items-center justify-between border-b px-3">
          {sidebarOpen ? <Logo size="sm" /> : <Logo size="sm" showText={false} />}
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <ChevronLeft className={cn('h-4 w-4 transition-transform', !sidebarOpen && 'rotate-180')} />
          </Button>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {filteredNav.map((item) => {
            const isActive = item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href);
            return (
              <Link key={item.href} to={item.href} className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}>
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-3">
          <Separator className="mb-3" />
          {sidebarOpen && user && (
            <div className="flex items-center gap-2 px-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
