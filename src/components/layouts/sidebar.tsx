import { Link, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Settings, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ShieldCheck, Banknote, Users, UsersRound, Megaphone, Workflow, CheckSquare,
  BookOpen, BarChart3, Bell, Database, FileSignature, Plug, LifeBuoy,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useState, useMemo } from 'react';
import type { UserRole } from '@/types';

// `hidden` temporarily removes an item from the sidebar without deleting it or
// its route — flip the flag back to re-enable (one-line change). See the
// 2026-06-15 client request below.
interface NavLeaf { href: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; hidden?: boolean; }
interface NavGroup { key: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; children: NavLeaf[]; hidden?: boolean; }
type NavEntry = NavLeaf | NavGroup;
const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry;

// Stato Admin sidebar — Statto green chrome (Admin Dashboard.html → dash-ui.jsx).
// Routing, role-gating, and group structure preserved from the prior sidebar.
//
// Client request 2026-06-15: simplify the sidebar to ONLY five items —
// Dashboard, Finance (Invoices), Clients, Campaigns. Everything else is
// HIDDEN (hidden: true), NOT deleted: the routes stay in App.tsx and the pages
// remain reachable by URL. To restore an item, remove its `hidden: true` flag.
const navItems: NavEntry[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'] },
  {
    key: 'finance', label: 'Finance', icon: Banknote, roles: ['owner', 'finance_admin'],
    children: [
      { href: '/finance/invoices', label: 'Invoices', icon: FileSignature, roles: ['owner', 'finance_admin'] },
      // Hidden per 2026-06-15 request — only Invoices stays under Finance.
      { href: '/finance/bank-feed', label: 'Bank Feed', icon: Banknote, roles: ['owner', 'finance_admin'], hidden: true },
      { href: '/finance/auto-invoice', label: 'Auto-invoice', icon: Banknote, roles: ['owner', 'finance_admin'], hidden: true },
    ],
  },
  { href: '/clients', label: 'Clients', icon: Users, roles: ['owner', 'finance_admin', 'ops_manager'] },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['owner', 'ops_manager'] },
  // ── Hidden per client request 2026-06-15 (routes preserved in App.tsx) ──
  {
    key: 'leadbyte', label: 'LeadByte', icon: Database, roles: ['owner', 'ops_manager', 'finance_admin'], hidden: true,
    children: [
      { href: '/leadbyte/buyers', label: 'Buyers', icon: Database, roles: ['owner', 'ops_manager'] },
      { href: '/leadbyte/deliveries', label: 'Deliveries', icon: Database, roles: ['owner', 'ops_manager'] },
    ],
  },
  { href: '/agreements', label: 'Agreements', icon: FileSignature, roles: ['owner', 'ops_manager'], hidden: true },
  { href: '/workflows', label: 'Workflows', icon: Workflow, roles: ['owner', 'ops_manager'], hidden: true },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'], hidden: true },
  { href: '/sops', label: 'SOPs', icon: BookOpen, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'], hidden: true },
  { href: '/staff', label: 'Staff', icon: UsersRound, roles: ['owner', 'ops_manager'], hidden: true },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'finance_admin'], hidden: true },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'], hidden: true },
  { href: '/sos', label: 'SOS Queue', icon: LifeBuoy, roles: ['owner', 'ops_manager', 'finance_admin'], hidden: true },
  { href: '/integrations', label: 'Integrations', icon: Plug, roles: ['owner'], hidden: true },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'finance_admin', 'ops_manager'], hidden: true },
];

function isLeafActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}
function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.children.some((c) => isLeafActive(pathname, c.href));
}

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, setMobileSidebarOpen } = useUiStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ finance: true });
  const collapsed = !sidebarOpen;

  const filteredNav = useMemo(() =>
    navItems
      // Drop items hidden per the 2026-06-15 client request (routes preserved).
      .filter((item) => !item.hidden)
      .filter((item) => user && item.roles.includes(user.role))
      .map((item) => {
        if (isGroup(item)) return { ...item, children: item.children.filter((c) => !c.hidden && user && c.roles.includes(user.role)) };
        return item;
      })
      .filter((item) => !isGroup(item) || item.children.length > 0)
  , [user]);

  const closeMobile = () => setMobileSidebarOpen(false);
  const toggleGroup = (key: string) => {
    // Collapsed desktop rail → expand the sidebar first (matches the design).
    if (collapsed) { toggleSidebar(); return; }
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <nav className="asb">
        <div className="asb-top">
          <div className="asb-brand">
            <span className="asb-logo"><BarChart3 className="size-5" strokeWidth={2.6} /></span>
            <span className="asb-word">Stato</span>
          </div>
          <button className="asb-collapse" onClick={toggleSidebar} title="Toggle sidebar" aria-label="Toggle sidebar">
            {collapsed ? <ChevronRight className="size-[18px]" /> : <ChevronLeft className="size-[18px]" />}
          </button>
        </div>

        <div className="asb-nav">
          {filteredNav.map((item) => {
            if (isGroup(item)) {
              const groupActive = isGroupActive(location.pathname, item);
              const expanded = expandedGroups[item.key] ?? groupActive;
              const showSub = !collapsed && expanded;
              return (
                <div key={item.key}>
                  <button
                    className={'asb-item' + (groupActive ? ' parent-active' : '')}
                    title={item.label}
                    onClick={() => toggleGroup(item.key)}
                  >
                    <span className="lic"><item.icon className="size-5" /></span>
                    <span className="asb-label">{item.label}</span>
                    <span className="asb-chev lic">{showSub ? <ChevronUp className="size-[15px]" /> : <ChevronDown className="size-[15px]" />}</span>
                  </button>
                  {showSub && (
                    <div className="asb-sub">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={closeMobile}
                          className={'asb-subitem' + (isLeafActive(location.pathname, child.href) ? ' active' : '')}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeMobile}
                title={item.label}
                className={'asb-item' + (isLeafActive(location.pathname, item.href) ? ' active' : '')}
              >
                <span className="lic"><item.icon className="size-5" /></span>
                <span className="asb-label">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {user && (
          <div className="asb-foot">
            <span className="asb-foot-ic"><ShieldCheck className="size-4" /></span>
            <span>{user.role.replace('_', ' ')}</span>
          </div>
        )}
      </nav>
      <div className="asb-overlay" onClick={closeMobile} />
    </>
  );
}
