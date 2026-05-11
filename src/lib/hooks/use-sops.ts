import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface SopScreenshot {
  key: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  uploadedBy?: string;
  caption?: string;
}

export interface SopSummary {
  id: string;
  title: string;
  content: string;
  category: 'Operations' | 'Finance' | 'Onboarding' | 'Compliance' | 'Campaigns';
  version: string;
  author: string;
  lastUpdated: string;
  status: 'published' | 'draft';
  loomUrl: string | null;
  screenshots: SopScreenshot[];
  tags: string[];
}

export interface PaginatedSops {
  sops: SopSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SopTag {
  tag: string;
  count: number;
}

export function useSops(filters?: { category?: string; search?: string; status?: string; tag?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['sops', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedSops>(`/api/v1/sops${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useSop(id: string) {
  return useQuery({
    queryKey: ['sop', id],
    queryFn: async () => {
      const res = await api.get<{ sop: SopSummary }>(`/api/v1/sops/${id}`);
      return unwrap(res).sop;
    },
    enabled: !!id,
  });
}

export function useSopTags() {
  return useQuery({
    queryKey: ['sop-tags'],
    queryFn: async () => {
      const res = await api.get<{ tags: SopTag[] }>('/api/v1/sops/tags');
      return unwrap(res).tags;
    },
  });
}

interface SopMutation {
  title?: string;
  content?: string;
  category?: string;
  status?: string;
  loomUrl?: string | null;
  screenshots?: SopScreenshot[];
  tags?: string[];
}

export function useCreateSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; content: string; category: string; status: string } & SopMutation) => {
      const res = await api.post<{ sop: SopSummary }>('/api/v1/sops', data);
      return unwrap(res).sop;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      qc.invalidateQueries({ queryKey: ['sop-tags'] });
    },
  });
}

export function useUpdateSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & SopMutation) => {
      const res = await api.put<{ sop: SopSummary }>(`/api/v1/sops/${id}`, data);
      return unwrap(res).sop;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      qc.invalidateQueries({ queryKey: ['sop', id] });
      qc.invalidateQueries({ queryKey: ['sop-tags'] });
    },
  });
}

// ─── AI generation ───

export interface SopDraft {
  title: string;
  category: SopSummary['category'];
  tags: string[];
  content: string;
  loomUrl: string;
}

export function useGenerateSopFromLoom() {
  return useMutation({
    mutationFn: async (input: { loomUrl: string; transcript: string }) => {
      const res = await api.post<{ draft: SopDraft }>('/api/v1/sops/generate-from-loom', input);
      return unwrap(res).draft;
    },
  });
}

// ─── Loom helpers ───

const LOOM_ID_RE = /loom\.com\/(?:share|embed|v)\/([a-f0-9]{20,})/i;

/** Extract a Loom share id from any Loom URL (share/embed/v formats). */
export function parseLoomId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = LOOM_ID_RE.exec(url);
  return m?.[1] ?? null;
}

export function loomEmbedUrl(loomUrl: string | null | undefined): string | null {
  const id = parseLoomId(loomUrl);
  return id ? `https://www.loom.com/embed/${id}` : null;
}
