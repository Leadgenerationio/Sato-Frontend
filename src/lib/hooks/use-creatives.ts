import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

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
