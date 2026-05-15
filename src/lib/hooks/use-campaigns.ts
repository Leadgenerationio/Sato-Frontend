import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export interface CampaignWindowTotals {
  leads: number;
  revenue: number;
  cost: number;
}

export type CampaignWindowKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'ytd';

export interface CampaignLinkedClient {
  clientId: string;
  clientName: string;
  leadPrice: number | null;
  currency: string;
  status: string;
}

export interface CampaignDetail extends CampaignSummary {
  /** Sato DB UUID — distinct from `id` (LeadByte). Used as the PATCH target
   * when editing Stato-side fields like cost_per_lead. */
  satoId: string | null;
  /** Manual supplier cost-per-lead (Sam #41). Distinct from the computed
   * `cpl` field which is totalCost/totalLeads from LeadByte. */
  costPerLead: number | null;
  /** Slice 2 Day 1: buyers linked to this campaign via the join table. */
  linkedClients: CampaignLinkedClient[];
  leadDeliveries: {
    date: string;
    leadCount: number;
    validLeads: number;
    invalidLeads: number;
    revenue: number;
    cost: number;
  }[];
  windowReports?: Record<CampaignWindowKey, CampaignWindowTotals>;
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

export interface UpdateCampaignInput {
  costPerLead?: number | null;
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCampaignInput) => {
      const res = await api.patch<{ campaign: { id: string; costPerLead: number | null } }>(
        `/api/v1/campaigns/${id}`,
        input,
      );
      return unwrap(res).campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export interface TrafficSource {
  id: string;
  campaignId: string;
  name: string;
  platform: string;
  accountId: string;
  catchrUrl: string | null;
  isActive: boolean;
  totalSpend: number;
  totalLeads: number;
  cpl: number;
  // Slice 2 Day 3 — leadreports.io-style row: revenue + net profit live on
  // the same response so the table is one round-trip.
  revenue: number;
  netProfit: number;
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

export interface CatchrAccountOption {
  id: string;
  name: string;
  platform: string;
  sourceName: string;
}

/**
 * Picker data for the traffic-source dialog. Sam wants Facebook / Google /
 * Taboola etc. to surface their connected ad accounts as a dropdown, not
 * a free-form URL paste. Backend caches this for 5 min so the dialog is
 * snappy after the first open.
 */
export function useCatchrAccounts(platform?: string) {
  return useQuery({
    queryKey: ['catchr', 'accounts', platform ?? 'all'],
    queryFn: async () => {
      const qs = platform ? `?platform=${encodeURIComponent(platform)}` : '';
      const res = await api.get<{ configured: boolean; accounts: CatchrAccountOption[]; error?: string }>(
        `/api/v1/integrations/catchr/accounts${qs}`,
      );
      return unwrap(res);
    },
    // Cache aggressively client-side too — the dropdown shouldn't refetch
    // every time the user opens the dialog mid-session.
    staleTime: 5 * 60_000,
  });
}

export interface CreateTrafficSourceInput {
  name: string;
  platform?: string;
  accountId?: string;
  catchrUrl?: string;
  isActive?: boolean;
}

export interface UpdateTrafficSourceInput {
  name?: string;
  platform?: string;
  accountId?: string;
  catchrUrl?: string | null;
  isActive?: boolean;
  totalSpend?: number;
  totalLeads?: number;
}

export function useCreateTrafficSource(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTrafficSourceInput) => {
      const res = await api.post<{ source: TrafficSource }>(
        `/api/v1/campaigns/${campaignId}/sources`,
        input,
      );
      return unwrap(res).source;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId, 'sources'] }),
  });
}

export function useUpdateTrafficSource(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceId, ...input }: UpdateTrafficSourceInput & { sourceId: string }) => {
      const res = await api.patch<{ source: TrafficSource }>(
        `/api/v1/campaigns/${campaignId}/sources/${sourceId}`,
        input,
      );
      return unwrap(res).source;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId, 'sources'] }),
  });
}

export function useDeleteTrafficSource(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string) => {
      await api.delete(`/api/v1/campaigns/${campaignId}/sources/${sourceId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId, 'sources'] }),
  });
}
