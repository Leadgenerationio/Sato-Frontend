import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { SosButton } from '@/components/shared/sos-button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  LayoutDashboard, FileBarChart, FileText, Shield, ScrollText, LogOut, UserCog, Megaphone, Users as UsersIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';

// Sam (2026-05-27 portal meeting): "Users" tab is client_admin-only —
// where they spawn extra portal logins for their own staff without
// going through Sam. `requiresAdmin` lets us filter the rendered nav
// per-user without N route guards.
const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
}> = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/leads', label: 'Leads', icon: FileBarChart },
  { href: '/portal/invoices', label: 'Invoices', icon: FileText },
  { href: '/portal/compliance', label: 'Compliance', icon: Shield },
  // Creative review v2 (Sam #9/#11). Sits between Compliance and Agreement
  // so the buyer's natural left-to-right reading order is:
  // overview → compliance state → assets to approve → sign agreement.
  { href: '/portal/creatives', label: 'Creatives', icon: Megaphone },
  { href: '/portal/agreement', label: 'Agreement', icon: ScrollText },
  { href: '/portal/users', label: 'Users', icon: UsersIcon, requiresAdmin: true },
  { href: '/portal/account', label: 'Account', icon: UserCog },
];

function isClientAdmin(role: UserRole | undefined): boolean {
  return role === 'client_admin';
}

export function PortalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav bar */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo size="sm" />
            <nav className="hidden md:flex items-center gap-1">
              {navItems.filter((item) => !item.requiresAdmin || isClientAdmin(user?.role)).map((item) => {
                const isActive = item.href === '/portal'
                  ? location.pathname === '/portal'
                  : location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden sm:inline-block max-w-[12rem] truncate text-sm text-muted-foreground"
              title={user?.name}
            >
              {user?.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { logout(); toast.info('Signed out'); }}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex md:hidden overflow-x-auto border-t px-4 gap-1 py-1">
          {navItems.filter((item) => !item.requiresAdmin || isClientAdmin(user?.role)).map((item) => {
            const isActive = item.href === '/portal'
              ? location.pathname === '/portal'
              : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors',
                  isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <Outlet />
      </main>
      <SosButton />
    </div>
  );
}
