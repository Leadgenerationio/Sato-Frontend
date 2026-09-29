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

interface NavLeaf { href: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; pinned?: boolean; }
interface NavGroup { key: string; label: string; icon: typeof LayoutGrid; children: NavLeaf[]; }
export type NavEntry = NavLeaf | NavGroup;
export const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry;

// Every role list below mirrors the <ProtectedRoute allowedRoles> guard on the
// same path in App.tsx (the admin shell itself admits owner / finance_admin /
// ops_manager / readonly — client + client_admin use /portal). A menu entry a
// role can see but not open is a dead link; src/__tests__/sidebar-nav.test.tsx
// parses the guards out of App.tsx and fails when the two disagree. A group
// has no role list of its own: it shows while at least one child survives.
//
// Entries are also limited to what the API lets the role load: Bank Feed and
// Auto-invoice are owner-only until the backend stops shadowing them behind
// the creative router's owner/ops_manager guard (routes/index.ts).
//
// History: on 2026-06-15 Sam asked for a five-item menu and everything else
// was hidden. Feedback round 1 (29 Sep, M6) reversed that — the hidden
// sections are built and in use — so they are back, grouped so the menu
// stays short. Settings is `pinned`: it renders in the sidebar footer so it
// can't scroll out of reach.
export const STAFF: UserRole[] = ['owner', 'finance_admin', 'ops_manager', 'readonly'];
export const INTERNAL: UserRole[] = ['owner', 'finance_admin', 'ops_manager'];
export const FINANCE: UserRole[] = ['owner', 'finance_admin'];
export const OPS: UserRole[] = ['owner', 'ops_manager'];
export const OWNER: UserRole[] = ['owner'];

export const navItems: NavEntry[] = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid, roles: STAFF },
  {
    key: 'finance', label: 'Finance', icon: Banknote,
    children: [
      { href: '/finance/invoices', label: 'Invoices', icon: FileSignature, roles: FINANCE },
      { href: '/finance/bank-feed', label: 'Bank Feed', icon: Banknote, roles: OWNER },
      { href: '/finance/auto-invoice', label: 'Auto-invoice', icon: Banknote, roles: OWNER },
      { href: '/reports/unified', label: 'Reports', icon: BarChart3, roles: FINANCE },
    ],
  },
  { href: '/clients', label: 'Clients', icon: Users, roles: INTERNAL },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: OPS },
  { href: '/agreements', label: 'Agreements', icon: FileSignature, roles: OPS },
  {
    key: 'leadbyte', label: 'LeadByte', icon: Database,
    children: [
      { href: '/leadbyte/buyers', label: 'Buyers', icon: Database, roles: OPS },
      { href: '/leadbyte/deliveries', label: 'Deliveries', icon: Database, roles: OPS },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: CheckSquare,
    children: [
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: INTERNAL },
      { href: '/sops', label: 'SOPs', icon: BookOpen, roles: INTERNAL },
      { href: '/workflows', label: 'Workflows', icon: Workflow, roles: OPS },
      { href: '/staff', label: 'Staff', icon: UsersRound, roles: OPS },
      { href: '/sos', label: 'SOS Queue', icon: LifeBuoy, roles: INTERNAL },
    ],
  },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: STAFF },
  { href: '/integrations', label: 'Integrations', icon: Plug, roles: OWNER },
  // Pinned to the footer. User Management lives inside Settings and is
  // owner-only there, so other roles reach Settings without it.
  { href: '/settings', label: 'Settings', icon: Settings, roles: INTERNAL, pinned: true },
];

/** The menu a given role actually sees — entries it may not open and empty groups dropped. */
export function navForRole(role: UserRole | undefined): NavEntry[] {
  if (!role) return [];
  return navItems
    .map((item) => (isGroup(item) ? { ...item, children: item.children.filter((c) => c.roles.includes(role)) } : item))
    .filter((item) => (isGroup(item) ? item.children.length > 0 : item.roles.includes(role)));
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
  const menu = filteredNav.filter((e) => isGroup(e) || !e.pinned);
  const pinned = filteredNav.filter((e): e is NavLeaf => !isGroup(e) && !!e.pinned);

  const closeMobile = () => setMobileSidebarOpen(false);
  // `displayed` is what the group currently shows (state, else "open because
  // the route is inside it"); toggle that, not the raw state, so the first
  // click on a route-active group closes it.
  const toggleGroup = (key: string, displayed: boolean) => {
    // Collapsed desktop rail → expand the sidebar first (matches the design),
    // with the tapped group open.
    if (collapsed) { toggleSidebar(); setExpandedGroups((prev) => ({ ...prev, [key]: true })); return; }
    setExpandedGroups((prev) => ({ ...prev, [key]: !displayed }));
  };

  const renderLeaf = (item: NavLeaf) => (
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
          {menu.map((item) => {
            if (isGroup(item)) {
              const groupActive = isGroupActive(location.pathname, item);
              const expanded = expandedGroups[item.key] ?? groupActive;
              // The rail hides .asb-sub in CSS; the phone drawer forces it visible, so
              // don't tie the DOM to the desktop-rail flag.
              const showSub = expanded;
              return (
                <div key={item.key}>
                  <button
                    className={'asb-item' + (groupActive ? ' parent-active' : '')}
                    title={item.label}
                    onClick={() => toggleGroup(item.key, expanded)}
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
            return renderLeaf(item);
          })}
        </div>

        {/* The role badge used to sit here too; it's already in the top bar (N4). */}
        {pinned.length > 0 && <div className="asb-foot">{pinned.map(renderLeaf)}</div>}
      </nav>
      <div className="asb-overlay" onClick={closeMobile} />
    </>
  );
}
