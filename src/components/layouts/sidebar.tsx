import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronDown,
  X,
  ShieldCheck,
  Banknote,
  Users,
  UsersRound,
  Megaphone,
  Workflow,
  CheckSquare,
  BookOpen,
  BarChart3,
  Bell,
  Building2,
  Truck,
  Send,
  Database,
  Activity,
  FileSignature,
  FileText,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useState, useMemo } from 'react';
import type { UserRole } from '@/types';

interface NavLeaf {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

interface NavGroup {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry;

const navItems: NavEntry[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'] },
  {
    key: 'finance',
    label: 'Finance',
    icon: Banknote,
    roles: ['owner', 'finance_admin'],
    children: [
      { href: '/finance/invoices', label: 'Invoices', icon: FileText, roles: ['owner', 'finance_admin'] },
      { href: '/finance/bank-feed', label: 'Bank Feed', icon: Receipt, roles: ['owner', 'finance_admin'] },
    ],
  },
  { href: '/clients', label: 'Clients', icon: Users, roles: ['owner', 'finance_admin', 'ops_manager'] },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['owner', 'ops_manager'] },
  {
    key: 'leadbyte',
    label: 'LeadByte',
    icon: Database,
    roles: ['owner', 'ops_manager', 'finance_admin'],
    children: [
      { href: '/leadbyte', label: 'Dashboard', icon: Activity, roles: ['owner', 'ops_manager', 'finance_admin'] },
      { href: '/leadbyte/buyers', label: 'Buyers', icon: Building2, roles: ['owner', 'ops_manager'] },
      { href: '/leadbyte/deliveries', label: 'Deliveries', icon: Truck, roles: ['owner', 'ops_manager'] },
      { href: '/leadbyte/responders', label: 'Responders', icon: Send, roles: ['owner', 'ops_manager'] },
    ],
  },
  { href: '/agreements', label: 'Agreements', icon: FileSignature, roles: ['owner', 'ops_manager'] },
  { href: '/workflows', label: 'Workflows', icon: Workflow, roles: ['owner', 'ops_manager'] },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'] },
  { href: '/sops', label: 'SOPs', icon: BookOpen, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'] },
  { href: '/staff', label: 'Staff', icon: UsersRound, roles: ['owner', 'ops_manager'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'finance_admin'] },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: ['owner', 'finance_admin', 'ops_manager', 'client', 'readonly'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'finance_admin', 'ops_manager'] },
];

function isLeafActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/leadbyte') return pathname === '/leadbyte';
  return pathname.startsWith(href);
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.children.some((c) => isLeafActive(pathname, c.href));
}

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUiStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const filteredNav = useMemo(() =>
    navItems.filter((item) => user && item.roles.includes(user.role)).map((item) => {
      if (isGroup(item)) {
        return { ...item, children: item.children.filter((c) => user && c.roles.includes(user.role)) };
      }
      return item;
    }).filter((item) => !isGroup(item) || item.children.length > 0)
  , [user]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderNav = (onClick?: () => void, compact = false) =>
    filteredNav.map((item) => {
      if (isGroup(item)) {
        const groupActive = isGroupActive(location.pathname, item);
        const expanded = expandedGroups[item.key] ?? groupActive;

        if (compact) {
          // Collapsed desktop sidebar — show icon only, clicking expands the sidebar
          return (
            <button
              key={item.key}
              onClick={toggleSidebar}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                groupActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              title={item.label}
            >
              <item.icon className="h-5 w-5 shrink-0" />
            </button>
          );
        }

        return (
          <div key={item.key} className="flex flex-col">
            <button
              onClick={() => toggleGroup(item.key)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                groupActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
            </button>
            {expanded && (
              <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-border pl-3">
                {item.children.map((child) => {
                  const active = isLeafActive(location.pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      to={child.href}
                      onClick={onClick}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
                        active ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <child.icon className="h-4 w-4 shrink-0" />
                      <span>{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      const active = isLeafActive(location.pathname, item.href);
      return (
        <Link
          key={item.href}
          to={item.href}
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            active ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
          title={compact ? item.label : undefined}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {!compact && <span>{item.label}</span>}
        </Link>
      );
    });

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r bg-sidebar-background transition-transform md:hidden',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <Logo size="sm" />
          <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {renderNav(() => setMobileSidebarOpen(false))}
        </nav>
        {user && (
          <div className="shrink-0 border-t px-3 py-3">
            <div className="flex items-center gap-2 px-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs capitalize text-muted-foreground">{user.role.replace('_', ' ')}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r bg-sidebar-background transition-all duration-300 md:flex',
        sidebarOpen ? 'w-64' : 'w-16',
      )}>
        <div className={cn(
          'flex h-16 shrink-0 items-center border-b',
          sidebarOpen ? 'justify-between px-3' : 'justify-center px-0',
        )}>
          {sidebarOpen && <Logo size="sm" />}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', !sidebarOpen && 'rotate-180')} />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {renderNav(undefined, !sidebarOpen)}
        </nav>
        {user && (
          <div className={cn(
            'shrink-0 border-t py-3',
            sidebarOpen ? 'px-3' : 'px-0',
          )}>
            {sidebarOpen ? (
              <div className="flex items-center gap-2 px-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs capitalize text-muted-foreground">{user.role.replace('_', ' ')}</span>
              </div>
            ) : (
              <div
                className="flex items-center justify-center"
                title={user.role.replace('_', ' ')}
              >
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
