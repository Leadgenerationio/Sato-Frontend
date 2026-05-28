import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export type CreativeSection = 'media' | 'copy_lp';

// T2 (Sam, 2026-05-20) — lifecycle states.
// - draft: just uploaded, only visible to staff
// - sent_for_approval: staff hit Submit; buyer can now see + decide
// - approved / rejected / changes_requested: buyer's most recent decision
export type CreativeStatus =
  | 'draft'
  | 'sent_for_approval'
  | 'approved'
  | 'rejected'
  | 'changes_requested';

export interface Creative {
  id: string;
  campaignId: string;
  name: string;
  type: 'image' | 'video' | 'text' | string;
  fileUrl: string;
  r2Key: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  version: number;
  uploadedAt: string;
  // v2 buyer-review (Sam #9/#11). 'media' = image/video, 'copy_lp' = copy +
  // landing-page URLs. Optional only for back-compat with API responses
  // that pre-date the v2 deploy — treated as 'media' on the FE.
  section?: CreativeSection;
  // T2: optional for back-compat with API responses that pre-date T2.
  // Missing values are treated as 'sent_for_approval' (the backfill default
  // for pre-T2 rows) so the FE never shows a draft pill for legacy data.
  status?: CreativeStatus;
  submittedAt?: string | null;
}

export function useCreatives(campaignId: string) {
  return useQuery({
    queryKey: ['creatives', campaignId],
    queryFn: async () => {
      const res = await api.get<{ creatives: Creative[] }>(`/api/v1/campaigns/${campaignId}/creatives`);
      return unwrap(res).creatives;
    },
    enabled: !!campaignId,
  });
}

export function useCreateCreative(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      type: 'image' | 'video' | 'text';
      r2Key: string;
      fileUrl: string;
      sizeBytes: number;
      contentType: string;
      section?: CreativeSection;
    }) => {
      const res = await api.post<{ creative: Creative }>('/api/v1/creatives', { ...input, campaignId });
      return unwrap(res).creative;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creatives', campaignId] }),
  });
}

export function useDeleteCreative(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/creatives/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creatives', campaignId] }),
  });
}

// Staff-side per-creative signed URL. The server resolves the R2 folder
// from the stored file_url so the FE no longer has to guess between
// 'creatives' (new uploads) and 'misc' (legacy uploads) — both open from
// the same endpoint.
export async function fetchCreativeSignedUrl(creativeId: string): Promise<string> {
  const res = await api.get<{ url: string }>(`/api/v1/creatives/${creativeId}/signed-url`);
  return unwrap(res).url;
}

// T2 (Sam, 2026-05-20) — staff submit-for-approval. Mutation invalidates
// the creatives list so the status pill flips immediately on success.
// Backend returns 409 when the source state isn't draft / changes_requested
// — the caller's catch should show that as a non-error toast since it's
// usually "I clicked twice".
export function useSubmitCreative(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ event: { id: string; createdAt: string } }>(
        `/api/v1/creatives/${id}/submit-for-approval`,
        {},
      );
      return unwrap(res).event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creatives', campaignId] }),
  });
}
