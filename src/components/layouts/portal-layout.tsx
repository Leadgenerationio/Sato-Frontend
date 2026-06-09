import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  LayoutDashboard, FileBarChart, FileText, Shield, ScrollText, LogOut, UserCog, Megaphone, BarChart3,
} from 'lucide-react';
import { ThemeToggle } from '@/components/shared/theme-toggle';
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
  const visibleNav = navItems.filter((item) => isVisibleToUser(item, user));

  const signOut = () => { logout(); toast.info('Signed out'); };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Slim ink icon rail (Statto style) */}
      <nav className="fixed left-0 top-0 z-40 flex h-screen w-20 flex-col items-center gap-2 bg-statto-ink py-[22px]">
        <div className="mb-[18px] flex size-[42px] items-center justify-center rounded-[13px] bg-statto-lime text-statto-ink">
          <BarChart3 className="size-[22px]" strokeWidth={2.6} />
        </div>
        {visibleNav.map((item) => {
          const isActive = item.href === '/portal'
            ? location.pathname === '/portal'
            : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                'flex size-12 items-center justify-center rounded-[14px] transition-colors',
                isActive
                  ? 'bg-statto-lime text-statto-ink'
                  : 'text-[#7E978F] hover:bg-white/5 hover:text-[#CFE0DA]',
              )}
            >
              <item.icon className="size-[22px]" />
            </Link>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex size-12 items-center justify-center rounded-[14px] text-[#7E978F] transition-colors hover:bg-white/5 hover:text-[#CFE0DA]"
        >
          <LogOut className="size-[22px]" />
        </button>
      </nav>

      {/* Main column */}
      <div className="ml-20 min-w-0 flex-1">
        {/* Top-right user strip */}
        <div className="flex items-center justify-end gap-3 px-4 pt-6 sm:px-10">
          <ThemeToggle />
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-statto-ink text-sm font-semibold text-statto-lime"
            aria-hidden="true"
          >
            {getInitials(user?.name)}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground" title={user?.name}>
              {user?.name}
            </span>
            <span className="text-xs text-muted-foreground">Account Owner</span>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="ml-1 flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-statto-ink"
          >
            <LogOut className="size-[19px]" />
          </button>
        </div>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
