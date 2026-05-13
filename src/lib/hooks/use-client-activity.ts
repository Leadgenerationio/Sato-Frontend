import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// L #38 — per-client activity feed. Append-only event stream pulled from
// client_activity_log on the backend, sorted newest-first. The detail
// page Activity tab renders this directly.

export interface ClientActivityEvent {
  id: string;
  clientId: string;
  actorUserId: string | null;
  actorName: string | null;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

export function useClientActivity(clientId: string, opts: { limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return useQuery({
    queryKey: ['client-activity', clientId, opts],
    queryFn: async () => {
      const res = await api.get<{ activity: ClientActivityEvent[] }>(
        `/api/v1/clients/${clientId}/activity${qs ? `?${qs}` : ''}`,
      );
      return unwrap(res).activity;
    },
    enabled: !!clientId,
  });
}

// L #33 — per-client email thread (inbound + outbound).
export interface ClientEmail {
  id: string;
  clientId: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  messageId: string | null;
  resendEvent: string | null;
  occurredAt: string;
  loggedBy: string | null;
  createdAt: string;
}

export function useClientEmails(clientId: string, opts: { direction?: 'inbound' | 'outbound' } = {}) {
  const params = new URLSearchParams();
  if (opts.direction) params.set('direction', opts.direction);
  const qs = params.toString();
  return useQuery({
    queryKey: ['client-emails', clientId, opts],
    queryFn: async () => {
      const res = await api.get<{ emails: ClientEmail[] }>(
        `/api/v1/clients/${clientId}/emails${qs ? `?${qs}` : ''}`,
      );
      return unwrap(res).emails;
    },
    enabled: !!clientId,
  });
}

export interface LogEmailInput {
  direction: 'inbound' | 'outbound';
  subject?: string;
  body?: string;
  fromAddress?: string;
  toAddress?: string;
  occurredAt?: string;
}

export function useLogClientEmail(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogEmailInput) => {
      const res = await api.post<{ email: ClientEmail }>(`/api/v1/clients/${clientId}/emails`, input);
      return unwrap(res).email;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-emails', clientId] });
      qc.invalidateQueries({ queryKey: ['client-activity', clientId] });
    },
  });
}

export function useDeleteClientEmail(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emailId: string) => {
      await api.delete(`/api/v1/clients/${clientId}/emails/${emailId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-emails', clientId] });
      qc.invalidateQueries({ queryKey: ['client-activity', clientId] });
    },
  });
}
