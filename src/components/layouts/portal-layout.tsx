import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  LayoutDashboard, FileBarChart, FileText, Shield, ScrollText, LogOut, UserCog, Megaphone,
} from 'lucide-react';
import type { User, PortalTabSlug } from '@/types';

// Sam (2026-05-27 jam-video #2): the portal is *display-only* for clients.
// Users management + ad-spend dedicated tab + agreement self-upload all
// belong to the admin side, not the client portal. The remaining nav
// items are read-only views the client sees. allowedTabs (admin-set) can
// still hide individual tabs per portal user.
const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabSlug?: PortalTabSlug;
}> = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/leads', label: 'Leads', icon: FileBarChart, tabSlug: 'leads' },
  { href: '/portal/invoices', label: 'Invoices', icon: FileText, tabSlug: 'invoices' },
  { href: '/portal/compliance', label: 'Compliance', icon: Shield, tabSlug: 'compliance' },
  { href: '/portal/creatives', label: 'Creatives', icon: Megaphone, tabSlug: 'creatives' },
  { href: '/portal/agreement', label: 'Agreement', icon: ScrollText, tabSlug: 'agreement' },
  { href: '/portal/account', label: 'Account', icon: UserCog },
];

function isVisibleToUser(
  item: { tabSlug?: PortalTabSlug },
  user: User | null,
): boolean {
  // Admin (Sam-side) can pick per-portal-user tab visibility via allowedTabs.
  // null = full access (backward compat). Dashboard + Account have no slug,
  // so they're always visible.
  if (item.tabSlug && user?.allowedTabs) {
    return user.allowedTabs.includes(item.tabSlug);
  }
  return true;
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function PortalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav bar */}
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo size="sm" />
            <nav className="hidden md:flex items-center gap-1">
              {navItems.filter((item) => isVisibleToUser(item, user)).map((item) => {
                const isActive = item.href === '/portal'
                  ? location.pathname === '/portal'
                  : location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                      isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 sm:border-l sm:pl-4">
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-statto-ink text-xs font-semibold text-statto-lime"
                aria-hidden="true"
              >
                {getInitials(user?.name)}
              </div>
              <span
                className="max-w-[10rem] truncate text-sm font-medium text-foreground"
                title={user?.name}
              >
                {user?.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { logout(); toast.info('Signed out'); }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex md:hidden overflow-x-auto border-t px-4 gap-1 py-1">
          {navItems.filter((item) => isVisibleToUser(item, user)).map((item) => {
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
    </div>
  );
}
