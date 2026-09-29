import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// Vite's ?raw import keeps this test free of Node types (tsc checks tests too).
import app from '../App.tsx?raw';
import { Sidebar, navItems, settingsItem, navForRole, isGroup } from '../components/layouts/sidebar';
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
    expect(screen.getByText('Operations')).toBeInTheDocument();
  });

  it('no longer repeats the role badge in the sidebar (N4 — it is in the top bar)', () => {
    const { container } = renderSidebar();
    expect(within(container.querySelector('.asb') as HTMLElement).queryByText(/^owner$/i)).not.toBeInTheDocument();
  });

  it('nothing is hidden any more', () => {
    const all = navItems.flatMap((i) => (isGroup(i) ? [i, ...i.children] : [i]));
    expect(all.filter((i) => i.hidden).map((i) => i.label)).toEqual([]);
  });
});

// Every role that sees a menu entry must be able to open it. Parse the
// <ProtectedRoute allowedRoles> guards out of App.tsx so a future change to
// either side fails here instead of shipping a dead link.
describe('Sidebar roles match the App.tsx route guards', () => {
  const LAYOUT_ROLES: UserRole[] = ['owner', 'finance_admin', 'ops_manager', 'readonly'];

  function routeRoles(href: string): UserRole[] {
    const esc = href.replace(/[/-]/g, (c) => `\\${c}`);
    const m = new RegExp(`path="${esc}"[\\s\\S]{0,200}?allowedRoles=\\{\\[([^\\]]*)\\]`).exec(app);
    const guardedWithin = m && !/<Route\b/.test(m[0].slice(0, m[0].indexOf('allowedRoles')));
    if (!m || !guardedWithin) {
      expect(app, `no route for ${href}`).toContain(`path="${href}"`);
      return LAYOUT_ROLES;
    }
    return m[1].split(',').map((r) => r.trim().replace(/'/g, '') as UserRole).filter((r) => LAYOUT_ROLES.includes(r));
  }

  const leaves = [...navItems.flatMap((i) => (isGroup(i) ? i.children : [i])), settingsItem];
  it.each(leaves.map((l) => [l.href, l] as const))('%s', (_href, leaf) => {
    const allowed = routeRoles(leaf.href);
    const visibleTo = LAYOUT_ROLES.filter((r) => navForRole(r).some((e) => (isGroup(e) ? e.children : [e]).some((c) => c.href === leaf.href)) || (leaf === settingsItem && settingsItem.roles.includes(r)));
    expect(visibleTo.sort()).toEqual([...allowed].sort());
  });
});
