import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { usePortalDashboard } from '@/lib/hooks/use-portal';
import { toast } from 'sonner';
import {
  BarChart3, FileText, Shield, ScrollText, LogOut, UserCog, Megaphone, LayoutGrid, Menu,
} from 'lucide-react';
import type { User, PortalTabSlug } from '@/types';
import { brand } from '@/config/brand';

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

// On mobile the left rail becomes a bottom tab bar. These hrefs get a slot in
// the bar (in this order); every other visible item falls into the "More" sheet
// alongside Sign out. Keeps the bar to ≤4 tabs + More regardless of allowedTabs.
const BOTTOM_NAV_HREFS = ['/portal', '/portal/leads', '/portal/invoices', '/portal/account'];

export function PortalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  // Shares the cached react-query result with PortalDashboardPage, so this
  // doesn't fire an extra request. companyName powers the header title; while
  // it loads we fall back to the signed-in user's name.
  const { data: dashboard } = usePortalDashboard();

  const visibleItems = navItems.filter((item) => isVisibleToUser(item, user));
  const active = visibleItems.find((i) => isActiveHref(i.href, location.pathname)) ?? visibleItems[0];

  // Mobile bottom-nav split: primary tabs in the bar, the rest in the More sheet.
  const bottomItems = BOTTOM_NAV_HREFS
    .map((href) => visibleItems.find((i) => i.href === href))
    .filter((i): i is (typeof navItems)[number] => Boolean(i));
  const moreItems = visibleItems.filter((i) => !BOTTOM_NAV_HREFS.includes(i.href));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((i) => isActiveHref(i.href, location.pathname));

  // Close the More sheet whenever the route changes (covers browser back/forward
  // and any programmatic navigation, not just in-sheet link taps).
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  // While the sheet is open: lock background scroll and allow Escape to close.
  useEffect(() => {
    if (!moreOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const title = dashboard?.companyName ?? user?.name ?? 'Client Portal';
  const isManaged = dashboard?.clientType === 'managed';
  const handleLogout = () => { logout(); toast.info('Signed out'); };

  return (
    <div className="statto-portal app">
      {/* Left ink-green icon rail */}
      <nav className="sidebar">
        {/* Sam 2026-06-15: client portal must not show "Stato" — brand the rail
            logo with the client brand (logo image if configured, else icon). */}
        {brand.logoUrl
          ? <div className="brand-dot" title={brand.name}><img src={brand.logoUrl} alt={brand.name} className="size-[22px]" /></div>
          : <div className="brand-dot" title={brand.name}><BarChart3 className="size-[22px]" strokeWidth={2.6} /></div>}
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
        {/* User avatar pinned above logout — initials in the rail, full name on
            hover (Sam 2026-06-18). Desktop/tablet only: the rail is hidden at
            ≤768px, where identity + sign-out move into the bottom-nav More sheet. */}
        <div className="nav-avatar" data-name={user?.name ?? 'Account'} title={user?.name} aria-label={user?.name}>
          {getInitials(user?.name)}
        </div>
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

      {/* Mobile bottom tab bar — replaces the left rail on small screens (CSS
          shows this and hides .sidebar at ≤768px). Primary tabs + a More button
          that opens a sheet with the overflow tabs and Sign out. */}
      <nav className="portal-bottom-nav" aria-label="Primary">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={'pbn-item' + (isActiveHref(item.href, location.pathname) ? ' active' : '')}
            onClick={() => setMoreOpen(false)}
          >
            <item.icon className="size-[22px]" />
            <span className="pbn-label">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={'pbn-item' + (moreOpen || moreActive ? ' active' : '')}
          aria-haspopup="true"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        >
          <Menu className="size-[22px]" />
          <span className="pbn-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="pbn-more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="pbn-more-sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="pbn-more-grip" aria-hidden="true" />
            {/* Identity — the rail/header user block is hidden on mobile, so the
                signed-in user surfaces here. */}
            <div className="pbn-more-user">
              <span className="hdr-avatar" aria-hidden="true">{getInitials(user?.name)}</span>
              <div className="ph-user-meta">
                <span className="ph-user-name" title={user?.name}>{user?.name}</span>
                <span className="ph-user-role">{user?.isPrimaryOwner ? 'Account Owner' : 'Portal User'}</span>
              </div>
            </div>
            {moreItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                role="menuitem"
                className={'pbn-more-item' + (isActiveHref(item.href, location.pathname) ? ' active' : '')}
                onClick={() => setMoreOpen(false)}
              >
                <item.icon className="size-[20px]" />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              className="pbn-more-item danger"
              onClick={() => { setMoreOpen(false); handleLogout(); }}
            >
              <LogOut className="size-[20px]" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
