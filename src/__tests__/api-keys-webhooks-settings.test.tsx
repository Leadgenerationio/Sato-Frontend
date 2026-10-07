/**
 * Settings → API keys + Webhooks (Sam round 1, section 5 — plan phases 2 and
 * 4). The key / secret is shown exactly once; revoke asks first; webhook
 * URLs must be https; scopes and events are required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
import type { ApiKey, WebhookEndpoint } from '@/lib/hooks/use-integrations-api';

const createKey = vi.fn();
const revokeKey = vi.fn();
const updateKey = vi.fn();
const createHook = vi.fn();
const updateHook = vi.fn();
const testHook = vi.fn();
let keys: ApiKey[] = [];
let hooks: WebhookEndpoint[] = [];

vi.mock('@/lib/hooks/use-integrations-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-integrations-api')>('@/lib/hooks/use-integrations-api');
  return {
    ...actual,
    useApiKeys: () => ({ data: keys, isLoading: false, error: null }),
    useCreateApiKey: () => ({ mutateAsync: createKey, isPending: false }),
    useRevokeApiKey: () => ({ mutateAsync: revokeKey, isPending: false }),
    useUpdateApiKeyLimits: () => ({ mutateAsync: updateKey, isPending: false }),
    useWebhooks: () => ({ data: hooks, isLoading: false, error: null }),
    useCreateWebhook: () => ({ mutateAsync: createHook, isPending: false }),
    useUpdateWebhook: () => ({ mutateAsync: updateHook, isPending: false }),
    useDeleteWebhook: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useTestWebhook: () => ({ mutateAsync: testHook, isPending: false }),
    useWebhookDeliveries: (id: string | null) => ({ data: id ? [{ id: 'd1', event: 'test', status: 'succeeded', responseCode: 200, attempts: 1, deliveredAt: '2026-09-29T10:00:00Z', nextAttemptAt: null, createdAt: '2026-09-29T10:00:00Z' }] : undefined, isLoading: false }),
  };
});
// The client picker searches the business's clients (1h: keys limited to some clients).
const CLIENTS = [
  { id: 'c-acme', companyName: 'Acme Ltd' },
  { id: 'c-beta', companyName: 'Beta Media' },
];
vi.mock('@/lib/hooks/use-clients', () => ({
  useClients: (f?: { search?: string }) => ({
    data: { clients: CLIENTS.filter((c) => !f?.search || c.companyName.toLowerCase().includes(f.search.toLowerCase())), total: 2, page: 1, pageSize: 100 },
    isLoading: false,
  }),
}));
// The Activity card has its own tests (api-activity-settings.test.tsx).
vi.mock('@/lib/hooks/use-api-activity', () => ({
  useApiActivity: () => ({ data: { pages: [{ items: [], nextCursor: null }] }, isLoading: false, error: null, hasNextPage: false }),
  downloadApiActivityCsv: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { WebhooksSettings, webhookUrlError } from '@/components/settings/webhooks-settings';
import { API_KEY_SCOPES, listOf } from '@/lib/hooks/use-integrations-api';

beforeEach(() => {
  keys = [{ id: 'k1', name: 'Meta uploader', prefix: 'sk_live_ab12', scopes: ['creatives:write'], lastUsedAt: null, revokedAt: null, createdAt: '2026-09-29T09:00:00Z', usage30d: 42 }];
  hooks = [{ id: 'w1', url: 'https://example.com/hook', events: ['creative.added'], active: true, createdAt: '2026-09-29T09:00:00Z' }];
  createKey.mockReset().mockResolvedValue({ key: 'sk_live_ab12_SECRET_ONCE', apiKey: { name: 'Taboola sync' } });
  revokeKey.mockReset().mockResolvedValue(undefined);
  updateKey.mockReset().mockResolvedValue({});
  createHook.mockReset().mockResolvedValue({ endpoint: { url: 'https://hooks.example.com/stato' }, secret: 'whsec_ONCE' });
  updateHook.mockReset().mockResolvedValue({});
  testHook.mockReset().mockResolvedValue({ ok: true, status: 200 });
});

describe('ApiKeysSettings', () => {
  it('links to the MCP setup guide', () => {
    render(<ApiKeysSettings />);
    expect(screen.getByRole('link', { name: /Connect an AI assistant/ })).toHaveAttribute('href', '/settings/mcp');
  });

  it('lists keys with prefix, scopes and usage — never the full key', () => {
    render(<ApiKeysSettings />);
    const row = within(screen.getByTestId('api-key-row'));
    expect(row.getByText(/sk_live_ab12…/)).toBeInTheDocument();
    expect(row.getByText('Upload creatives')).toBeInTheDocument();
    expect(row.getByText(/42 calls in the last 30 days/)).toBeInTheDocument();
  });

  it('creates a key with the chosen scopes and shows it once', async () => {
    render(<ApiKeysSettings />);
    fireEvent.change(screen.getByPlaceholderText('Meta uploader'), { target: { value: 'Taboola sync' } });
    fireEvent.click(screen.getByLabelText(/Read creatives/));
    fireEvent.click(screen.getByRole('button', { name: /Create key/ }));
    await waitFor(() => expect(createKey).toHaveBeenCalledWith({ name: 'Taboola sync', scopes: ['clients:read', 'creatives:write', 'creatives:read'] }));
    expect(await screen.findByTestId('shown-once-secret')).toHaveTextContent('sk_live_ab12_SECRET_ONCE');
    expect(screen.getByText(/won't be shown again/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "I've saved it" }));
    expect(screen.queryByText('sk_live_ab12_SECRET_ONCE')).toBeNull();
  });

  it('asks for a name and at least one permission', async () => {
    render(<ApiKeysSettings />);
    fireEvent.click(screen.getByLabelText(/Read clients/));
    fireEvent.click(screen.getByLabelText(/Upload creatives/));
    fireEvent.click(screen.getByRole('button', { name: /Create key/ }));
    expect(await screen.findByText(/Give the key a name/)).toBeInTheDocument();
    expect(screen.getByText('Choose at least one permission.')).toBeInTheDocument();
    expect(createKey).not.toHaveBeenCalled();
  });

  it('a new key sees all clients unless limited, and sends the limit and assistant name', async () => {
    render(<ApiKeysSettings />);
    fireEvent.change(screen.getByPlaceholderText('Meta uploader'), { target: { value: 'Acme bot' } });
    const form = within(screen.getByRole('form', { name: 'Create an API key' }));
    fireEvent.click(form.getByLabelText(/Only these clients/));
    // An empty list is not allowed: nothing is created.
    fireEvent.click(screen.getByRole('button', { name: /Create key/ }));
    expect(await form.findByText(/Choose at least one client/)).toBeInTheDocument();
    expect(createKey).not.toHaveBeenCalled();
    fireEvent.change(form.getByLabelText('Search clients'), { target: { value: 'acme' } });
    expect(form.queryByLabelText('Beta Media')).toBeNull();
    fireEvent.click(form.getByLabelText('Acme Ltd'));
    fireEvent.change(form.getByPlaceholderText('Pipeboard bot'), { target: { value: 'Pipeboard' } });
    fireEvent.click(screen.getByRole('button', { name: /Create key/ }));
    await waitFor(() => expect(createKey).toHaveBeenCalledWith({
      name: 'Acme bot', scopes: ['clients:read', 'creatives:write'], allowedClientIds: ['c-acme'], agentLabel: 'Pipeboard',
    }));
  });

  it('shows which clients each key sees, and changes them', async () => {
    keys = [{ ...keys[0]!, allowedClientIds: ['c-beta'], agentLabel: 'Pipeboard' }];
    render(<ApiKeysSettings />);
    expect(screen.getByTestId('api-key-clients')).toHaveTextContent('Only Beta Media · assistant "Pipeboard"');
    fireEvent.click(screen.getByRole('button', { name: 'Change clients for Meta uploader' }));
    const row = within(screen.getByTestId('api-key-row'));
    fireEvent.click(row.getByLabelText(/All clients/));
    fireEvent.click(row.getByRole('button', { name: /Save clients/ }));
    await waitFor(() => expect(updateKey).toHaveBeenCalledWith({ id: 'k1', allowedClientIds: null }));
  });

  it('names a chosen client from the API even when it is not in the first page of clients', () => {
    keys = [{ ...keys[0]!, allowedClientIds: ['c-far'], allowedClients: [{ id: 'c-far', name: 'Zeta Far Ltd' }] }];
    render(<ApiKeysSettings />);
    expect(screen.getByTestId('api-key-clients')).toHaveTextContent('Only Zeta Far Ltd');
  });

  it('a key with no limit says so', () => {
    render(<ApiKeysSettings />);
    expect(screen.getByTestId('api-key-clients')).toHaveTextContent('All clients');
  });

  it('revoke asks first and only revokes on yes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<ApiKeysSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Meta uploader' }));
    expect(revokeKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Meta uploader' }));
    await waitFor(() => expect(revokeKey).toHaveBeenCalledWith('k1'));
    confirm.mockRestore();
  });
});

describe('WebhooksSettings', () => {
  it('only accepts https endpoints', () => {
    expect(webhookUrlError('http://example.com/h')).toMatch(/https/);
    expect(webhookUrlError('nope')).toMatch(/isn't a web address/);
    expect(webhookUrlError('https://example.com/h')).toBeNull();
  });

  it('adds an endpoint with its events and shows the signing secret once', async () => {
    render(<WebhooksSettings />);
    fireEvent.change(screen.getByPlaceholderText('https://example.com/stato-webhook'), { target: { value: 'https://hooks.example.com/stato' } });
    fireEvent.click(screen.getByLabelText(/Client added/));
    fireEvent.click(screen.getByRole('button', { name: /Add webhook/ }));
    await waitFor(() => expect(createHook).toHaveBeenCalledWith({ url: 'https://hooks.example.com/stato', events: ['creative.added', 'creative.changed', 'client.added'] }));
    expect(await screen.findByTestId('shown-once-secret')).toHaveTextContent('whsec_ONCE');
  });

  it('send test shows the delivery list', async () => {
    render(<WebhooksSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Send test/ }));
    await waitFor(() => expect(testHook).toHaveBeenCalledWith('w1'));
    expect(await screen.findByTestId('webhook-deliveries')).toHaveTextContent('HTTP 200');
  });

  it('the on/off switch is labelled and saves', async () => {
    render(<WebhooksSettings />);
    fireEvent.click(screen.getByRole('switch', { name: 'Webhook to https://example.com/hook active' }));
    await waitFor(() => expect(updateHook).toHaveBeenCalledWith({ id: 'w1', active: false }));
  });
});

describe('API_KEY_SCOPES', () => {
  it('offers the MCP connector scopes', () => {
    const values = API_KEY_SCOPES.map((s) => s.value);
    expect(values).toEqual(expect.arrayContaining(['campaigns:read', 'ad_accounts:read', 'uploads:write', 'ad_links:write', 'creatives:archive']));
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps read/write pairs for the same resource next to each other', () => {
    const values: string[] = API_KEY_SCOPES.map((s) => s.value);
    expect(values.indexOf('ad_accounts:write') - values.indexOf('ad_accounts:read')).toBe(1);
    expect(values.indexOf('creatives:write') - values.indexOf('creatives:read')).toBe(1);
  });
});

describe('listOf', () => {
  it('accepts a bare array or a wrapped list', () => {
    expect(listOf([1, 2], 'x')).toEqual([1, 2]);
    expect(listOf({ apiKeys: [1] }, 'apiKeys')).toEqual([1]);
    expect(listOf(null, 'apiKeys')).toEqual([]);
  });
});
