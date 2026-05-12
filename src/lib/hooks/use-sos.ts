import { useMutation } from '@tanstack/react-query';
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
