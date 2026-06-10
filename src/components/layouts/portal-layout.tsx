import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { usePortalDashboard } from '@/lib/hooks/use-portal';
import { toast } from 'sonner';
import {
  BarChart3, FileText, Shield, ScrollText, LogOut, UserCog, Megaphone, LayoutGrid,
} from 'lucide-react';
import type { User, PortalTabSlug } from '@/types';

// Statto Client Portal chrome — ink-green icon rail + portal header.
// Ported from the Claude Design handoff (Stato Portal.html → portal/chrome.jsx).
// Routing + per-user tab visibility (Sam 27-May) are preserved from the
// previous top-nav layout; only the visual shell changed.

const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle: string;
  tabSlug?: PortalTabSlug;
}> = [
  { href: '/portal', label: 'Dashboard', icon: LayoutGrid, subtitle: 'Client Portal' },
  { href: '/portal/leads', label: 'Leads', icon: BarChart3, subtitle: 'Lead delivery', tabSlug: 'leads' },
  { href: '/portal/invoices', label: 'Invoices', icon: FileText, subtitle: 'Billing', tabSlug: 'invoices' },
  { href: '/portal/compliance', label: 'Compliance', icon: Shield, subtitle: 'Compliance', tabSlug: 'compliance' },
  { href: '/portal/creatives', label: 'Creatives', icon: Megaphone, subtitle: 'Ad creatives', tabSlug: 'creatives' },
  { href: '/portal/agreement', label: 'Agreement', icon: ScrollText, subtitle: 'Your contract', tabSlug: 'agreement' },
  { href: '/portal/account', label: 'Account', icon: UserCog, subtitle: 'Account' },
];

function isVisibleToUser(item: { tabSlug?: PortalTabSlug }, user: User | null): boolean {
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

function isActiveHref(href: string, pathname: string): boolean {
  return href === '/portal' ? pathname === '/portal' : pathname.startsWith(href);
}

export function PortalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  // Shares the cached react-query result with PortalDashboardPage, so this
  // doesn't fire an extra request. companyName powers the header title; while
  // it loads we fall back to the signed-in user's name.
  const { data: dashboard } = usePortalDashboard();

  const visibleItems = navItems.filter((item) => isVisibleToUser(item, user));
  const active = visibleItems.find((i) => isActiveHref(i.href, location.pathname)) ?? visibleItems[0];

  const title = dashboard?.companyName ?? user?.name ?? 'Client Portal';
  const isManaged = dashboard?.clientType === 'managed';
  const handleLogout = () => { logout(); toast.info('Signed out'); };

  return (
    <div className="statto-portal app">
      {/* Left ink-green icon rail */}
      <nav className="sidebar">
        <div className="brand-dot" title="Stato"><BarChart3 className="size-[22px]" strokeWidth={2.6} /></div>
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            title={item.label}
            aria-label={item.label}
            className={'nav-btn' + (isActiveHref(item.href, location.pathname) ? ' active' : '')}
          >
            <item.icon className="size-[22px]" />
          </Link>
        ))}
        <div className="nav-spacer" />
        <button className="nav-btn" title="Sign out" aria-label="Sign out" onClick={handleLogout}>
          <LogOut className="size-[22px]" />
        </button>
      </nav>

      <div className="main">
        <div className="viewport">
          {/* Portal header — client name + status + user */}
          <header className="portal-header">
            <div className="ph-left">
              <div className="ph-title-row">
                <h1 className="ph-title" title={title}>{title}</h1>
                {isManaged && <span className="ph-tag">Managed</span>}
              </div>
              <p className="ph-sub">{active?.subtitle ?? 'Client Portal'}</p>
            </div>
            <div className="ph-user">
              <span className="hdr-avatar" aria-hidden="true">{getInitials(user?.name)}</span>
              <div className="ph-user-meta">
                <span className="ph-user-name" title={user?.name}>{user?.name}</span>
                <span className="ph-user-role">{user?.isPrimaryOwner ? 'Account Owner' : 'Portal User'}</span>
              </div>
              <button className="ph-logout" title="Sign out" aria-label="Sign out" onClick={handleLogout}>
                <LogOut className="size-[19px]" />
              </button>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
