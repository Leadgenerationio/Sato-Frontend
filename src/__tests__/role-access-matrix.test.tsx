import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersManagement } from '../pages/users';

// Settings → User Management → Role Access Matrix (Sam feedback round 1, S7).

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: 'b', clientId: null },
    token: 't',
  }),
}));

const roles = ['owner', 'finance_admin', 'ops_manager', 'readonly', 'client', 'client_admin'];
const cell = (o: Record<string, string>) => Object.fromEntries(roles.map((r) => [r, o[r] ?? 'none']));
const SECTIONS = [
  { key: 'bank_feed', label: 'Bank Feed', group: 'Finance', locked: false, access: cell({ owner: 'always', finance_admin: 'on' }) },
  { key: 'settings', label: 'Settings', group: 'Admin', locked: true, access: cell({ owner: 'always', finance_admin: 'always', ops_manager: 'always' }) },
  { key: 'portal', label: 'Client portal', group: 'Client portal', locked: false, access: cell({ client: 'on', client_admin: 'off' }) },
];

let patches: unknown[] = [];
beforeEach(() => {
  patches = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/v1/users')) return new Response(JSON.stringify({ status: 'success', data: { users: [] } }));
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      patches.push(body);
      const updated = { ...SECTIONS[0], access: { ...SECTIONS[0].access, finance_admin: body.allowed ? 'on' : 'off' } };
      return new Response(JSON.stringify({ status: 'success', data: { section: updated } }));
    }
    return new Response(JSON.stringify({ status: 'success', data: { sections: SECTIONS, permissions: [] } }));
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Role Access Matrix', () => {
  it('has a column for every role, Client Admin included', async () => {
    render(<UsersManagement />);
    const table = await screen.findByRole('table', { name: /which sections each role can open/i });
    for (const label of ['Owner', 'Finance Admin', 'Ops Manager', 'Readonly', 'Client', 'Client Admin']) {
      expect(within(table).getByRole('columnheader', { name: label })).toBeInTheDocument();
    }
  });

  it('labels every switch with role and section, and locks Owner + Settings', async () => {
    render(<UsersManagement />);
    expect(await screen.findByRole('switch', { name: 'Finance Admin — Bank Feed' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Client Admin — Client portal' })).not.toBeChecked();
    expect(screen.queryByRole('switch', { name: /^Owner/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Settings/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Readonly — Bank Feed: not available')).toBeInTheDocument();
  });

  it('asks before changing, then sends the section key', async () => {
    const user = userEvent.setup();
    render(<UsersManagement />);
    await user.click(await screen.findByRole('switch', { name: 'Finance Admin — Bank Feed' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Bank Feed')).toBeInTheDocument();
    expect(patches).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(patches).toEqual([{ section: 'bank_feed', role: 'finance_admin', allowed: false }]));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Finance Admin — Bank Feed' })).not.toBeChecked());
  });
});
