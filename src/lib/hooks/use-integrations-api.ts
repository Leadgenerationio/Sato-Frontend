import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// Public API keys + webhooks (Sam feedback round 1, section 5 — plan phases 2
// and 4). Owner-only on the backend. A key and a webhook secret are shown
// exactly once, in the create response; only their hashes are stored.

export const API_KEY_SCOPES = [
  { value: 'clients:read', label: 'Read clients', hint: 'Look up a client, e.g. by ad account' },
  { value: 'ad_accounts:write', label: 'Link ad accounts', hint: 'Add an ad account → client link' },
  { value: 'creatives:read', label: 'Read creatives', hint: 'List and search creatives' },
  { value: 'creatives:write', label: 'Upload creatives', hint: 'Create and update creatives' },
  { value: 'landing_pages:write', label: 'Manage landing pages', hint: 'Create landing pages and attach them to creatives' },
  // MCP connector (spec v1.0 §3). Added, never renamed, so existing keys keep working.
  { value: 'campaigns:read', label: 'Read campaigns', hint: 'List campaigns and their buyers' },
  { value: 'ad_accounts:read', label: 'Read ad accounts', hint: 'List ad accounts and what they are linked to' },
  { value: 'uploads:write', label: 'Upload large files', hint: 'Direct and multipart uploads for big videos' },
  { value: 'ad_links:write', label: 'Record platform ads', hint: 'Record which Meta, Google or TikTok ads a creative runs in' },
  { value: 'creatives:archive', label: 'Archive creatives', hint: 'Hide and restore creatives (files are never deleted)' },
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]['value'];

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  usage30d: number;
}

export const WEBHOOK_EVENTS = [
  { value: 'creative.added', label: 'Creative added' },
  { value: 'creative.changed', label: 'Creative changed' },
  { value: 'client.added', label: 'Client added' },
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]['value'];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

// Matches the backend row (webhook_deliveries): `status` is the delivery
// state, `responseCode` the endpoint's HTTP answer.
export interface WebhookDelivery {
  id: string;
  event: WebhookEvent | 'test';
  status: 'pending' | 'succeeded' | 'failed' | string;
  responseCode: number | null;
  lastError?: string | null;
  attempts: number;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

/** List endpoints may answer a bare array or `{ <key>: [...] }` — accept both. */
export function listOf<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  const v = data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined;
  return Array.isArray(v) ? (v as T[]) : [];
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => listOf<ApiKey>(unwrap(await api.get<unknown>('/api/v1/api-keys')), 'apiKeys'),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; scopes: ApiKeyScope[] }) =>
      unwrap(await api.post<{ key: string; apiKey: ApiKey }>('/api/v1/api-keys', input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/v1/api-keys/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => listOf<WebhookEndpoint>(unwrap(await api.get<unknown>('/api/v1/webhook-endpoints')), 'endpoints'),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; events: WebhookEvent[] }) =>
      unwrap(await api.post<{ endpoint: WebhookEndpoint; secret: string }>('/api/v1/webhook-endpoints', input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; active?: boolean; events?: WebhookEvent[]; url?: string }) =>
      unwrap(await api.patch<{ endpoint: WebhookEndpoint }>(`/api/v1/webhook-endpoints/${id}`, patch)).endpoint,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/v1/webhook-endpoints/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useWebhookDeliveries(id: string | null) {
  return useQuery({
    queryKey: ['webhook-deliveries', id],
    queryFn: async () => listOf<WebhookDelivery>(unwrap(await api.get<unknown>(`/api/v1/webhook-endpoints/${id}/deliveries`)), 'deliveries'),
    enabled: !!id,
  });
}

export function useTestWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.post<{ ok: boolean; status?: number; error?: string; delivery?: WebhookDelivery }>(`/api/v1/webhook-endpoints/${id}/test`)),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: ['webhook-deliveries', id] }),
  });
}

/** Where the published API docs live (served by the backend; OpenAPI JSON at /api/v1/openapi.json). */
export function apiDocsUrl(apiBase: string) {
  return `${apiBase.replace(/\/$/, '')}/docs`;
}
