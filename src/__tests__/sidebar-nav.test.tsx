import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// Vite's ?raw import keeps this test free of Node types (tsc checks tests too).
import app from '../App.tsx?raw';
import { Sidebar, navItems, navForRole, isGroup } from '../components/layouts/sidebar';
import { useUiStore } from '@/stores/ui-store';
import type { UserRole } from '@/types';

let mockRole: UserRole = 'owner';
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'u@stato.app', name: 'User', role: mockRole, isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderSidebar(pathname = '/') {
  return render(<MemoryRouter initialEntries={[pathname]}><Sidebar /></MemoryRouter>);
}

beforeEach(() => { mockRole = 'owner'; });

describe('Sidebar nav (feedback round 1, M6)', () => {
  it('shows the previously hidden sections to an owner', () => {
    renderSidebar();
    for (const label of ['Dashboard', 'Finance', 'Clients', 'Campaigns', 'Agreements', 'LeadByte', 'Operations', 'Notifications', 'Integrations', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Finance is expanded by default, so its children render too.
    for (const label of ['Invoices', 'Bank Feed', 'Auto-invoice', 'Reports']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it.each(['owner', 'finance_admin', 'ops_manager'] as const)('always shows a Settings link to %s, pinned in the footer', (role) => {
    mockRole = role;
    const { container } = renderSidebar();
    const foot = container.querySelector('.asb-foot') as HTMLElement;
    expect(foot).not.toBeNull();
    expect(within(foot).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('does not offer Settings to readonly (the /settings route refuses them)', () => {
    mockRole = 'readonly';
    renderSidebar();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('no longer repeats the role badge in the sidebar (N4 — it is in the top bar)', () => {
    const { container } = renderSidebar();
    expect(within(container.querySelector('.asb') as HTMLElement).queryByText(/^owner$/i)).not.toBeInTheDocument();
  });

  it('a role only sees entries whose API it can load (no dead links)', () => {
    mockRole = 'readonly';
    renderSidebar();
    // Tasks / SOPs are 403 for readonly on the backend, so Operations is not offered.
    expect(screen.queryByText('Operations')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('Bank Feed and Auto-invoice are owner-only (finance_admin gets 403 from the API)', () => {
    mockRole = 'finance_admin';
    renderSidebar();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.queryByText('Bank Feed')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto-invoice')).not.toBeInTheDocument();
  });

  it('the first click on a group that is open only because of the route closes it', () => {
    mockRole = 'ops_manager';
    renderSidebar('/tasks');
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }));
    expect(screen.queryByRole('link', { name: 'Tasks' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }));
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('a group keeps its children in the DOM when the desktop rail flag is collapsed (the phone drawer shows them)', () => {
    useUiStore.setState({ sidebarOpen: false });
    try {
      renderSidebar();
      expect(screen.getByRole('link', { name: 'Invoices' })).toBeInTheDocument();
    } finally {
      useUiStore.setState({ sidebarOpen: true });
    }
  });
});

// Every role that sees a menu entry must be able to open it. Parse the
// <ProtectedRoute allowedRoles> guards out of App.tsx so a future change to
// either side fails here instead of shipping a dead link. The parser throws on
// anything it cannot read, rather than falling back to a permissive default.
describe('Sidebar roles match the App.tsx route guards', () => {
  const parseRoles = (raw: string, where: string): UserRole[] => {
    const m = /^\s*\[([^\]]*)\]\s*$/.exec(raw);
    if (!m) throw new Error(`${where}: allowedRoles must be an inline array literal, got ${raw}`);
    return m[1].split(',').map((r) => r.trim().replace(/'/g, '') as UserRole).filter(Boolean);
  };

  // Split into one chunk per <Route ...>, so attribute order doesn't matter.
  const chunks = app.split(/<Route\b/).slice(1);

  // The only pathless guards are the two layout wrappers; any other one would
  // silently guard routes this parser attributes to the layout.
  const pathless = chunks.filter((c) => !/^\s*(path|index)\b/.test(c) && /element=\{\s*<ProtectedRoute/.test(c.slice(0, 200)));
  const layoutGuard = /allowedRoles=\{([^}]*\])\}/;
  const staffLayout = parseRoles(layoutGuard.exec(pathless[0])?.[1] ?? '', 'staff layout guard');

  it('has exactly the two known layout guards (staff shell, client portal)', () => {
    expect(pathless).toHaveLength(2);
  });

  function routeRoles(href: string): UserRole[] {
    const own = chunks.filter((c) => new RegExp(`\\bpath="${href.replace(/[/:.-]/g, (ch) => `\\${ch}`)}"`).test(c.slice(0, 200)));
    if (own.length !== 1) throw new Error(`expected exactly one <Route path="${href}">, found ${own.length}`);
    const chunk = own[0].split(/\/>\s*\n/)[0];
    const guard = /allowedRoles=\{([^}]*\])\}/.exec(chunk);
    if (/allowedRoles=/.test(chunk) && !guard) throw new Error(`${href}: unreadable allowedRoles`);
    return guard ? parseRoles(guard[1], href) : staffLayout; // unguarded → the staff shell's own guard
  }

  const leaves = navItems.flatMap((i) => (isGroup(i) ? i.children : [i]));
  it.each(leaves.map((l) => [l.href, l] as const))('%s', (_href, leaf) => {
    const allowed = routeRoles(leaf.href).filter((r) => staffLayout.includes(r));
    const visibleTo = staffLayout.filter((r) => navForRole(r).some((e) => (isGroup(e) ? e.children : [e]).some((c) => c.href === leaf.href)));
    expect([...visibleTo].sort()).toEqual([...allowed].sort());
  });
});
