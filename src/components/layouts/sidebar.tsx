import { Link, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Settings, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Banknote, Users, UsersRound, Megaphone, Workflow, CheckSquare,
  BookOpen, BarChart3, Bell, Database, FileSignature, Plug, LifeBuoy,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useState, useMemo } from 'react';
import type { UserRole } from '@/types';

// `hidden` removes an item from the sidebar without deleting it or its route —
// flip the flag to re-enable (one-line change).
interface NavLeaf { href: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; hidden?: boolean; }
interface NavGroup { key: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; children: NavLeaf[]; hidden?: boolean; }
export type NavEntry = NavLeaf | NavGroup;
export const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry;

// Every role list below mirrors the <ProtectedRoute allowedRoles> guard on the
// same path in App.tsx (the admin shell itself admits owner / finance_admin /
// ops_manager / readonly — client + client_admin use /portal). A menu entry a
// role can see but not open is a dead link; sidebar.test.tsx keeps the two
// in step.
//
// History: on 2026-06-15 Sam asked for a five-item menu and everything else
// was hidden. Feedback round 1 (29 Sep, M6) reversed that — the hidden
// sections are built and in use (Bank Feed / Auto-invoice show live data)
// and Settings / User Management must always be reachable — so they are back,
// grouped so the menu stays short.
const STAFF: UserRole[] = ['owner', 'finance_admin', 'ops_manager', 'readonly'];
const FINANCE: UserRole[] = ['owner', 'finance_admin'];
const OPS: UserRole[] = ['owner', 'ops_manager'];

export const navItems: NavEntry[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid, roles: STAFF },
  {
    key: 'finance', label: 'Finance', icon: Banknote, roles: FINANCE,
    children: [
      { href: '/finance/invoices', label: 'Invoices', icon: FileSignature, roles: FINANCE },
      { href: '/finance/bank-feed', label: 'Bank Feed', icon: Banknote, roles: FINANCE },
      { href: '/finance/auto-invoice', label: 'Auto-invoice', icon: Banknote, roles: FINANCE },
      { href: '/reports/unified', label: 'Reports', icon: BarChart3, roles: FINANCE },
    ],
  },
  { href: '/clients', label: 'Clients', icon: Users, roles: ['owner', 'finance_admin', 'ops_manager'] },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: OPS },
  { href: '/agreements', label: 'Agreements', icon: FileSignature, roles: OPS },
  {
    key: 'leadbyte', label: 'LeadByte', icon: Database, roles: OPS,
    children: [
      { href: '/leadbyte/buyers', label: 'Buyers', icon: Database, roles: OPS },
      { href: '/leadbyte/deliveries', label: 'Deliveries', icon: Database, roles: OPS },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: CheckSquare, roles: STAFF,
    children: [
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: STAFF },
      { href: '/sops', label: 'SOPs', icon: BookOpen, roles: STAFF },
      { href: '/workflows', label: 'Workflows', icon: Workflow, roles: OPS },
      { href: '/staff', label: 'Staff', icon: UsersRound, roles: OPS },
      { href: '/sos', label: 'SOS Queue', icon: LifeBuoy, roles: ['owner', 'finance_admin', 'ops_manager'] },
    ],
  },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: STAFF },
  { href: '/integrations', label: 'Integrations', icon: Plug, roles: ['owner'] },
];

// Pinned to the bottom of the sidebar so it can never scroll or be filtered
// out of reach (M6: "Settings and User Management must always be reachable").
export const settingsItem: NavLeaf = { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'finance_admin', 'ops_manager'] };

/** The menu a given role actually sees — hidden entries and empty groups dropped. */
export function navForRole(role: UserRole | undefined): NavEntry[] {
  if (!role) return [];
  return navItems
    .filter((item) => !item.hidden && item.roles.includes(role))
    .map((item) => (isGroup(item) ? { ...item, children: item.children.filter((c) => !c.hidden && c.roles.includes(role)) } : item))
    .filter((item) => !isGroup(item) || item.children.length > 0);
}

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

  const filteredNav = useMemo(() => navForRole(user?.role), [user]);
  const showSettings = !!user && settingsItem.roles.includes(user.role);

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

        {/* The role badge used to sit here too; it's already in the top bar (N4). */}
        {showSettings && (
          <div className="asb-foot">
            <Link
              to={settingsItem.href}
              onClick={closeMobile}
              title={settingsItem.label}
              className={'asb-item' + (isLeafActive(location.pathname, settingsItem.href) ? ' active' : '')}
            >
              <span className="lic"><settingsItem.icon className="size-5" /></span>
              <span className="asb-label">{settingsItem.label}</span>
            </Link>
          </div>
        )}
      </nav>
      <div className="asb-overlay" onClick={closeMobile} />
    </>
  );
}
