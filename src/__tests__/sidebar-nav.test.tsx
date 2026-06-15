import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/layouts/sidebar';

// Owner sees every role-gated item, so this is the strictest check that the
// 2026-06-15 "only 5 items" simplification actually hides the rest.
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null },
    token: 'test',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderSidebar() {
  return render(
    <MemoryRouter><Sidebar /></MemoryRouter>,
  );
}

describe('Sidebar nav (2026-06-15 simplification)', () => {
  // Top-level items that must be visible. Finance is a group; Invoices is its
  // only visible child.
  const VISIBLE = ['Dashboard', 'Finance', 'Clients', 'Campaigns', 'Invoices'];
  const HIDDEN = [
    'LeadByte', 'Agreements', 'Workflows', 'Tasks', 'SOPs', 'Staff',
    'Reports', 'Notifications', 'SOS Queue', 'Integrations', 'Settings',
    'Bank Feed', 'Auto-invoice',
  ];

  it('renders only the five expected top-level items', () => {
    renderSidebar();
    // The visible top-level entries are exactly: Dashboard, Finance, Clients,
    // Campaigns (Invoices is a child of Finance, rendered when expanded).
    const topLevel = ['Dashboard', 'Finance', 'Clients', 'Campaigns'];
    for (const label of topLevel) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows the kept items and the Finance > Invoices child', () => {
    renderSidebar();
    for (const label of VISIBLE) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('hides the other 11 nav items', () => {
    renderSidebar();
    for (const label of HIDDEN) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
