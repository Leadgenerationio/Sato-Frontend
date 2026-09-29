import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// Sam S13 (feedback round 1, 2026-09-29): link ad accounts to clients (and
// optionally a campaign) in bulk. Accounts are matched on platform +
// account id only — never on the account name.

export interface AdAccountLink {
  clientId: string;
  clientName: string;
  campaignId: string | null;
  campaignName: string | null;
  updatedAt: string | null;
}

export interface AdAccountRow {
  platform: string;
  platformLabel: string;
  accountId: string;
  accountName: string | null;
  currency: string | null;
  spend: number;
  lastSpendDate: string | null;
  link: AdAccountLink | null;
  campaigns: Array<{ campaignId: string; campaignName: string }>;
}

export interface AdAccountList {
  windowDays: number;
  accounts: AdAccountRow[];
  options: {
    clients: Array<{ id: string; companyName: string; status: string | null; currency: string | null }>;
    campaigns: Array<{ id: string; name: string; status: string | null }>;
  };
  summary: { total: number; linked: number; unlinked: number; totalSpend: number; unlinkedSpend: number };
}

export interface AdAccountLinkInput {
  platform: string;
  accountId: string;
  /** null removes the link. */
  clientId: string | null;
  campaignId?: string | null;
  accountName?: string | null;
  currency?: string | null;
}

export interface BulkLinkResult {
  created: number;
  updated: number;
  removed: number;
  unchanged: number;
  results: Array<{
    platform: string;
    accountId: string;
    action: 'created' | 'updated' | 'removed' | 'unchanged';
    clientName: string | null;
    campaignName: string | null;
  }>;
}

export function useAdAccounts(days = 30) {
  return useQuery({
    queryKey: ['ad-accounts', days],
    queryFn: async () => unwrap(await api.get<AdAccountList>(`/api/v1/ad-accounts?days=${days}`)),
  });
}

export function useBulkLinkAdAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (links: AdAccountLinkInput[]) =>
      unwrap(await api.put<BulkLinkResult>('/api/v1/ad-accounts/links', { links })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ad-accounts'] });
      // Campaign pages show linked buyers / unlinked-spend diagnostics.
      qc.invalidateQueries({ queryKey: ['campaigns', 'unlinked-spend'] });
    },
  });
}
