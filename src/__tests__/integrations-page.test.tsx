import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntegrationsPage } from '../pages/integrations';

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'owner@stato.app', name: 'Owner', role: 'owner', isActive: true, businessId: null, clientId: null }, token: 'test', loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const { overviewFixture } = vi.hoisted(() => ({
  overviewFixture: {
    xero: { configured: true, connected: true, tenantName: 'Clinical Marketing Solutions Ltd', lastError: null as string | null },
    leadbyte: { configured: true, lastSyncAt: '2026-05-07T08:00:00Z', leadsThisMonth: 3210 },
    catchr: { configured: true, connected: true, platformsConnected: 5, lastError: null as string | null, lastSyncAt: '2026-05-07T08:05:00Z', adSpendLast30Days: 103450, currency: 'GBP' },
    signnow: { configured: true, sandbox: false, agreementCount: 4 },
    r2: { configured: true, bucket: 'stato-production', fileCount: 27 },
    resend: { configured: true, fromEmail: 'onboarding@resend.dev' },
    creditCheck: { configured: true, provider: 'endole' as const, checksRun: 6 },
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ status: 'success', data: overviewFixture }),
    post: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
  },
  unwrap: <T,>(res: { data: T }) => res.data,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><IntegrationsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('IntegrationsPage', () => {
  it('renders all 7 integration cards', async () => {
    renderPage();
    expect(await screen.findByText('Xero')).toBeInTheDocument();
    expect(screen.getByText('LeadByte')).toBeInTheDocument();
    expect(screen.getByText('Catchr')).toBeInTheDocument();
    expect(screen.getByText('SignNow')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare R2')).toBeInTheDocument();
    expect(screen.getByText('Credit checks')).toBeInTheDocument();
    expect(screen.getByText('Resend')).toBeInTheDocument();
  });

  it('shows live key metrics per card', async () => {
    renderPage();
    expect(await screen.findByText('Clinical Marketing Solutions Ltd')).toBeInTheDocument();
    expect(screen.getByText('3,210')).toBeInTheDocument();
    expect(screen.getByText(/£103,450/)).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
  });

  it('flags Resend as pending when sender is on resend.dev domain', async () => {
    renderPage();
    expect(await screen.findByText(/Pending GoDaddy DNS/)).toBeInTheDocument();
  });

  it('renders status summary cards (Live / Degraded / Not configured)', async () => {
    renderPage();
    // Wait for cards to render. The "Live" label appears multiple times — once
    // per live integration pill plus the summary card — so getAllByText.
    // The old "Mock / partial" copy was renamed to "Degraded / probe failed"
    // (2026-05-20) because Sam read "Mock" as "we faked the data" when the
    // probe transiently failed against a healthy integration.
    await screen.findByText('Xero');
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0);
    expect(screen.getByText(/Degraded \/ probe failed/)).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });
});

// Xero card behaviour in the "Auth pending" state — credentials are present
// but the Xero token exchange hasn't succeeded (usually a missing scope on
// the Custom Connection app, most often finance.statements.read). The card
// must route the user to developer.xero.com (where they fix scopes), not to
// go.xero.com (the org dashboard, useless for this state).
//
// The top-of-file `vi.mock('@/lib/api', ...)` is hoisted and singleton, so
// to test a different fixture we mutate the shared `overviewFixture` object
// in beforeEach (the mock reads it via reference) and restore it after.
describe('IntegrationsPage — Xero auth pending', () => {
  const liveXero = { ...overviewFixture.xero };

  beforeEach(() => {
    // Cast to bypass the literal-inferred type on overviewFixture (which had
    // tenantName: string — non-nullable — based on the live fixture).
    overviewFixture.xero = { configured: true, connected: false, tenantName: null as unknown as string, lastError: null };
  });
  afterEach(() => {
    overviewFixture.xero = liveXero;
  });

  it('shows "Auth pending" + scope hint + Configure-in-Xero link when configured but not connected', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><IntegrationsPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Auth pending')).toBeInTheDocument();
    expect(screen.getByText(/Enable scopes/)).toBeInTheDocument();
    expect(screen.getByText(/accounting\.\* \+ finance\.statements\.read/)).toBeInTheDocument();
    const cfg = screen.getByRole('link', { name: /Configure in Xero/i });
    // Deep-links to the specific app so the operator lands on the exact
    // scope-config screen, not the generic apps list.
    expect(cfg).toHaveAttribute(
      'href',
      'https://developer.xero.com/app/manage/app/843a4b14-559d-45ee-a193-f13b9ff35667',
    );
  });

  it('translates invalid_scope into a human-actionable hint', async () => {
    overviewFixture.xero = {
      configured: true,
      connected: false,
      tenantName: null as unknown as string,
      lastError: 'invalid_scope: Client credentials scope validation failed',
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><IntegrationsPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Scope rejected by Xero/)).toBeInTheDocument();
  });

  it('translates invalid_client into an env-var hint', async () => {
    overviewFixture.xero = {
      configured: true,
      connected: false,
      tenantName: null as unknown as string,
      lastError: 'invalid_client',
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><IntegrationsPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Client ID\/Secret rejected/)).toBeInTheDocument();
  });
});
