import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface SopSummary {
  id: string;
  title: string;
  content: string;
  category: 'Operations' | 'Finance' | 'Onboarding' | 'Compliance' | 'Campaigns';
  version: string;
  author: string;
  lastUpdated: string;
  status: 'published' | 'draft';
}

export interface PaginatedSops {
  sops: SopSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function useSops(filters?: { category?: string; search?: string; status?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
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

export function useCreateSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; content: string; category: string; status: string }) => {
      const res = await api.post<{ sop: SopSummary }>('/api/v1/sops', data);
      return unwrap(res).sop;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sops'] });
    },
  });
}

export function useUpdateSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; content?: string; category?: string; status?: string }) => {
      const res = await api.put<{ sop: SopSummary }>(`/api/v1/sops/${id}`, data);
      return unwrap(res).sop;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      qc.invalidateQueries({ queryKey: ['sop', id] });
    },
  });
}
