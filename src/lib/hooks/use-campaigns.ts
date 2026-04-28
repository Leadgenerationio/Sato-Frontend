import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export type CampaignType = 'pay_per_lead' | 'managed' | 'internal';

export interface CampaignSummary {
  id: string;
  name: string;
  clientName: string;
  vertical: string;
  status: string;
  campaignType: CampaignType;
  leadPrice: number;
  currency: string;
  totalLeads: number;
  leadsToday: number;
  leadsThisWeek: number;
  leadsThisMonth: number;
  totalRevenue: number;
  totalCost: number;
  cpl: number;
  margin: number;
  startDate: string;
}

export interface CampaignDetail extends CampaignSummary {
  leadDeliveries: {
    date: string;
    leadCount: number;
    validLeads: number;
    invalidLeads: number;
    revenue: number;
    cost: number;
  }[];
  suppliers: {
    id: string;
    name: string;
    platform: string;
    totalSpend: number;
    totalLeads: number;
    cpl: number;
  }[];
}

export interface PaginatedCampaigns {
  campaigns: CampaignSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function useCampaigns(filters?: { status?: string; vertical?: string; search?: string; type?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters?.vertical) params.set('vertical', filters.vertical);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedCampaigns>(`/api/v1/campaigns${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const res = await api.get<{ campaign: CampaignDetail }>(`/api/v1/campaigns/${id}`);
      return unwrap(res).campaign;
    },
    enabled: !!id,
  });
}

export interface TrafficSource {
  id: string;
  campaignId: string;
  name: string;
  platform: string;
  catchrUrl: string | null;
  isActive: boolean;
  totalSpend: number;
  totalLeads: number;
  cpl: number;
  createdAt: string;
}

export function useTrafficSources(campaignId: string) {
  return useQuery({
    queryKey: ['campaign', campaignId, 'sources'],
    queryFn: async () => {
      const res = await api.get<{ sources: TrafficSource[] }>(
        `/api/v1/campaigns/${campaignId}/sources`,
      );
      return unwrap(res).sources;
    },
    enabled: !!campaignId,
  });
}
