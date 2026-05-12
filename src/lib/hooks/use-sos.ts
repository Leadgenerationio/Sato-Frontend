import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// Slice 5 Day 6 (Sam Loom #100). The SOS button hits POST /sos which
// records the request server-side AND returns a `wa.me/<number>?text=...`
// deep-link the FE opens in a new tab. If the backend hasn't been
// configured with a recipient number, `whatsappLink` is empty and
// `recipientNumber` is null — UI falls back to "logged but no number set".

export interface SosCreateResponse {
  request: {
    id: string;
    userId: string | null;
    pagePath: string | null;
    message: string | null;
    createdAt: string;
  };
  whatsappLink: string;
  recipientNumber: string | null;
}

export function useSendSos() {
  return useMutation({
    mutationFn: async (input: { pagePath?: string; message?: string }) => {
      const res = await api.post<SosCreateResponse>('/api/v1/sos', input);
      return unwrap(res);
    },
  });
}

// Slice 5 Day 7 — admin queue view. Backend gates list+resolve to
// owner / ops_manager / finance_admin only.
export interface SosHelpRequest {
  id: string;
  userId: string | null;
  pagePath: string | null;
  message: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  userName?: string | null;
  userEmail?: string | null;
}

export function useListSos(opts: { unresolvedOnly?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.unresolvedOnly) params.set('unresolved', 'true');
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['sos-list', opts],
    queryFn: async () => {
      const res = await api.get<{ requests: SosHelpRequest[] }>(`/api/v1/sos${qs ? `?${qs}` : ''}`);
      return unwrap(res).requests;
    },
  });
}

export function useResolveSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ request: SosHelpRequest }>(`/api/v1/sos/${id}/resolve`);
      return unwrap(res).request;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sos-list'] });
    },
  });
}
