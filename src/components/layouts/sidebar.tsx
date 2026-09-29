import { Link, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Settings, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Banknote, Users, UsersRound, Megaphone, Workflow, CheckSquare,
  BookOpen, BarChart3, Bell, Database, FileSignature, Plug, LifeBuoy, Link2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useState, useMemo } from 'react';
import type { UserRole } from '@/types';
import { useMySections } from '@/lib/hooks/use-permissions';

// `section` is the Role Access Matrix key (backend src/config/sections.ts, S7).
interface NavLeaf { href: string; label: string; icon: typeof LayoutGrid; roles: UserRole[]; section: string; pinned?: boolean; }
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
// Entries are also limited to what the API lets the role load. Bank Feed and
// Auto-invoice are owner + finance_admin: backend #54 moved the creative
// router's owner/ops_manager guard onto its own routes, so it no longer
// shadows /finance/* for finance_admin.
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
  { href: '/', label: 'Dashboard', icon: LayoutGrid, roles: STAFF, section: 'dashboard' },
  {
    key: 'finance', label: 'Finance', icon: Banknote,
    children: [
      { href: '/finance/invoices', label: 'Invoices', icon: FileSignature, roles: FINANCE, section: 'invoices' },
      { href: '/finance/bank-feed', label: 'Bank Feed', icon: Banknote, roles: FINANCE, section: 'bank_feed' },
      { href: '/finance/auto-invoice', label: 'Auto-invoice', icon: Banknote, roles: FINANCE, section: 'auto_invoice' },
      { href: '/reports/unified', label: 'Reports', icon: BarChart3, roles: FINANCE, section: 'reports' },
    ],
  },
  { href: '/clients', label: 'Clients', icon: Users, roles: INTERNAL, section: 'clients' },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: OPS, section: 'campaigns' },
  // S13: bulk-link ad accounts to clients/campaigns. Same section as Campaigns.
  { href: '/ad-accounts', label: 'Link ad accounts', icon: Link2, roles: OPS, section: 'campaigns' },
  { href: '/agreements', label: 'Agreements', icon: FileSignature, roles: OPS, section: 'agreements' },
  {
    key: 'leadbyte', label: 'LeadByte', icon: Database,
    children: [
      { href: '/leadbyte/buyers', label: 'Buyers', icon: Database, roles: OPS, section: 'leadbyte' },
      { href: '/leadbyte/deliveries', label: 'Deliveries', icon: Database, roles: OPS, section: 'leadbyte' },
    ],
  },
  {
    key: 'operations', label: 'Operations', icon: CheckSquare,
    children: [
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: INTERNAL, section: 'tasks' },
      { href: '/sops', label: 'SOPs', icon: BookOpen, roles: INTERNAL, section: 'sops' },
      { href: '/workflows', label: 'Workflows', icon: Workflow, roles: OPS, section: 'workflows' },
      { href: '/staff', label: 'Staff', icon: UsersRound, roles: OPS, section: 'staff' },
      { href: '/sos', label: 'SOS Queue', icon: LifeBuoy, roles: INTERNAL, section: 'sos' },
    ],
  },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: STAFF, section: 'notifications' },
  { href: '/integrations', label: 'Integrations', icon: Plug, roles: OWNER, section: 'integrations' },
  // Pinned to the footer. User Management lives inside Settings and is
  // owner-only there, so other roles reach Settings without it.
  { href: '/settings', label: 'Settings', icon: Settings, roles: INTERNAL, section: 'settings', pinned: true },
];

/** The Settings entry (pinned to the footer). */
export const settingsItem = navItems.find((e): e is NavLeaf => !isGroup(e) && e.href === '/settings')!;

/**
 * The menu a given role actually sees — entries it may not open and empty
 * groups dropped. `sections` is the Role Access Matrix answer from
 * /permissions/me (S7); when it's missing (loading, or the call failed) the
 * static role lists — the route guards — decide on their own. Settings is
 * never switched off by the matrix.
 */
export function navForRole(role: UserRole | undefined, sections?: readonly string[]): NavEntry[] {
  if (!role) return [];
  const allowed = (leaf: NavLeaf) => leaf.roles.includes(role) && (!sections || leaf.pinned || sections.includes(leaf.section));
  return navItems
    .map((item) => (isGroup(item) ? { ...item, children: item.children.filter(allowed) } : item))
    .filter((item) => (isGroup(item) ? item.children.length > 0 : allowed(item)));
}

/**
 * The matrix section a URL belongs to — the nav leaf with the longest href
 * that prefixes it (sub-pages like /finance/invoices/new count as Invoices).
 */
export function sectionForPath(pathname: string): string | undefined {
  const leaves = navItems.flatMap((i) => (isGroup(i) ? i.children : [i]));
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
