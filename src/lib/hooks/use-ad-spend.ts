import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface AdSpendRow {
  id: string;
  date: string;
  platform: string;
  accountId: string;
  accountName: string | null;
  campaignId: string;
  campaignName: string | null;
  spend: string;
  currency: string;
  clientId: string | null;
}

export interface AdSpendSummaryRow {
  platform: string;
  accountName: string | null;
  totalSpend: number;
  currency: string;
  campaigns: number;
}

export interface AdSpendTotal {
  total: number;
  currency: string;
  rowCount: number;
}

export interface AdSpendFilters {
  from?: string;
  to?: string;
  platform?: string;
  accountId?: string;
}

export interface AdSpendStatus {
  configured: boolean;
  lastSyncAt: string | null;
}

function toQs(filters: AdSpendFilters): string {
  const qs = new URLSearchParams();
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.platform && filters.platform !== 'all') qs.set('platform', filters.platform);
  if (filters.accountId) qs.set('accountId', filters.accountId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function useAdSpendStatus() {
  return useQuery({
    queryKey: ['ad-spend', 'status'],
    queryFn: async () => {
      const res = await api.get<AdSpendStatus>('/api/v1/ad-spend/status');
      return unwrap(res);
    },
  });
}

export function useAdSpendList(filters: AdSpendFilters) {
  return useQuery({
    queryKey: ['ad-spend', 'list', filters],
    queryFn: async () => {
      const res = await api.get<AdSpendRow[]>(`/api/v1/ad-spend${toQs(filters)}`);
      return unwrap(res);
    },
  });
}

export function useAdSpendSummary(filters: AdSpendFilters) {
  return useQuery({
    queryKey: ['ad-spend', 'summary', filters],
    queryFn: async () => {
      const res = await api.get<{ rows: AdSpendSummaryRow[]; total: AdSpendTotal }>(
        `/api/v1/ad-spend/summary${toQs(filters)}`,
      );
      return unwrap(res);
    },
  });
}

export function useAdSpendSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ jobId: string; enqueuedAt: string }>('/api/v1/ad-spend/sync');
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ad-spend'] });
    },
  });
}

export const AD_SPEND_PLATFORMS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'google-ads', label: 'Google Ads' },
  { value: 'facebook-ads', label: 'Facebook Ads' },
  { value: 'bing-ads', label: 'Microsoft Ads' },
  { value: 'tik-tok', label: 'TikTok Ads' },
  { value: 'taboola', label: 'Taboola' },
];

export function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return { from: ymd(from), to: ymd(to) };
}

export function formatMoney(v: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}
