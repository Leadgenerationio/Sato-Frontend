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
import { useMySections } from '@/lib/hooks/use-permissions';

// `hidden` removes an item from the sidebar without deleting it or its route —
// flip the flag to re-enable (one-line change).
// `section` is the Role Access Matrix key (backend src/config/sections.ts).
interface NavLeaf { href: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; section: string; hidden?: boolean; }
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
  { href: '/', label: 'Dashboard', icon: LayoutGrid, roles: STAFF, section: 'dashboard' },
  {
    key: 'finance', label: 'Finance', icon: Banknote, roles: FINANCE,
    children: [
      { href: '/finance/invoices', label: 'Invoices', icon: FileSignature, roles: FINANCE, section: 'invoices' },
      { href: '/finance/bank-feed', label: 'Bank Feed', icon: Banknote, roles: FINANCE, section: 'bank_feed' },
      { href: '/finance/auto-invoice', label: 'Auto-invoice', icon: Banknote, roles: FINANCE, section: 'auto_invoice' },
      { href: '/reports/unified', label: 'Reports', icon: BarChart3, roles: FINANCE, section: 'reports' },
    ],
  },
  { href: '/clients', label: 'Clients', icon: Users, roles: ['owner', 'finance_admin', 'ops_manager'], section: 'clients' },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: OPS, section: 'campaigns' },
  { href: '/agreements', label: 'Agreements', icon: FileSignature, roles: OPS, section: 'agreements' },
  {
    key: 'leadbyte', label: 'LeadByte', icon: Database, roles: OPS,
    children: [
      { href: '/leadbyte/buyers', label: 'Buyers', icon: Database, roles: OPS, section: 'leadbyte' },
      { href: '/leadbyte/deliveries', label: 'Deliveries', icon: Database, roles: OPS, section: 'leadbyte' },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: CheckSquare, roles: STAFF,
    children: [
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: STAFF, section: 'tasks' },
      { href: '/sops', label: 'SOPs', icon: BookOpen, roles: STAFF, section: 'sops' },
      { href: '/workflows', label: 'Workflows', icon: Workflow, roles: OPS, section: 'workflows' },
      { href: '/staff', label: 'Staff', icon: UsersRound, roles: OPS, section: 'staff' },
      { href: '/sos', label: 'SOS Queue', icon: LifeBuoy, roles: ['owner', 'finance_admin', 'ops_manager'], section: 'sos' },
    ],
  },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: STAFF, section: 'notifications' },
  { href: '/integrations', label: 'Integrations', icon: Plug, roles: ['owner'], section: 'integrations' },
];

// Pinned to the bottom of the sidebar so it can never scroll or be filtered
// out of reach (M6: "Settings and User Management must always be reachable").
export const settingsItem: NavLeaf = { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'finance_admin', 'ops_manager'], section: 'settings' };

/**
 * The menu a given role actually sees — hidden entries and empty groups
 * dropped. `sections` is the Role Access Matrix answer from
 * /permissions/me (S7); when it's missing (loading, or the call failed) the
 * static role lists above — the route guards — decide on their own.
 */
export function navForRole(role: UserRole | undefined, sections?: readonly string[]): NavEntry[] {
  if (!role) return [];
  const allowed = (leaf: NavLeaf) => !leaf.hidden && leaf.roles.includes(role) && (!sections || sections.includes(leaf.section));
  return navItems
    .filter((item) => !item.hidden && item.roles.includes(role))
    .filter((item) => isGroup(item) || allowed(item))
    .map((item) => (isGroup(item) ? { ...item, children: item.children.filter(allowed) } : item))
    .filter((item) => !isGroup(item) || item.children.length > 0);
}

/**
 * The matrix section a URL belongs to — the nav leaf with the longest href
 * that prefixes it (sub-pages like /finance/invoices/new count as Invoices).
 * Leaves that share a section (LeadByte's two pages) resolve the same way.
 */
export function sectionForPath(pathname: string): string | undefined {
  const leaves = [...navItems.flatMap((i) => (isGroup(i) ? i.children : [i])), settingsItem];
  const hit = leaves
    .filter((l) => (l.href === '/' ? pathname === '/' : pathname === l.href || pathname.startsWith(l.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (hit) return hit.section;
  // Section roots whose menu entry points at a sub-page (/reports → /reports/unified, /leadbyte → /leadbyte/buyers).
  const root = leaves.find((l) => l.href !== '/' && pathname.startsWith('/' + l.href.split('/')[1] + '/'));
  return root?.section;
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

  const { data: sections } = useMySections(!!user);
  const filteredNav = useMemo(() => navForRole(user?.role, sections), [user, sections]);
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
