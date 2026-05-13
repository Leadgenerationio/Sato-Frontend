import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// Mirrors the shape returned by GET /api/v1/clients/:id/campaigns.
// Fields match CampaignSummary / CampaignDetail in use-campaigns.ts.
export interface ClientCampaignLink {
  id: string;
  name: string;
  vertical: string;
  status: string;
  costPerLead: number | null;
  leadPrice: number | null;
}

export function useClientCampaigns(clientId: string) {
  return useQuery({
    queryKey: ['client-campaigns', clientId],
    queryFn: async () => {
      const res = await api.get<{ campaigns: ClientCampaignLink[] }>(
        `/api/v1/clients/${clientId}/campaigns`,
      );
      return unwrap(res).campaigns;
    },
    enabled: !!clientId,
  });
}

export interface LinkClientCampaignInput {
  campaignId: string;
  clientId: string;
  costPerLead?: number;
}

export function useLinkClientCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, clientId, costPerLead }: LinkClientCampaignInput) => {
      const body: { clientId: string; costPerLead?: number } = { clientId };
      if (costPerLead !== undefined) body.costPerLead = costPerLead;
      await api.post(`/api/v1/campaigns/${campaignId}/clients`, body);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['client-campaigns', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['client', vars.clientId] });
    },
  });
}

export interface UnlinkClientCampaignInput {
  campaignId: string;
  clientId: string;
}

export function useUnlinkClientCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, clientId }: UnlinkClientCampaignInput) => {
      await api.delete(`/api/v1/campaigns/${campaignId}/clients/${clientId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['client-campaigns', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['client', vars.clientId] });
    },
  });
}
