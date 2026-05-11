import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export type DeliveryWindow =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'ytd';

export const WINDOW_OPTIONS: { value: DeliveryWindow; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
];

export interface CampaignReportRow {
  campaignId: string;
  campaignName: string;
  clientName: string;
  vertical: string;
  leads: number;
  validLeads: number;
  cost: number;
  revenue: number;
  cpl: number;
  profit: number;
  margin: number;
}

export interface ClientPnlRow {
  clientId: string;
  clientName: string;
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  leadsDelivered: number;
}

export interface SupplierReportRow {
  supplierId: string;
  supplierName: string;
  platform: string;
  totalSpend: number;
  totalLeads: number;
  cpl: number;
  campaigns: number;
}

export interface FinancialOverviewRow {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  vatCollected: number;
}

export function useCampaignReport(window: DeliveryWindow = 'this_month') {
  return useQuery({
    queryKey: ['report-campaign', window],
    queryFn: async () => {
      const res = await api.get<{ report: CampaignReportRow[]; window: DeliveryWindow }>(
        `/api/v1/reports/campaign-performance?window=${window}`,
      );
      return unwrap(res).report;
    },
  });
}

export function useClientPnlReport() {
  return useQuery({
    queryKey: ['report-client-pnl'],
    queryFn: async () => {
      const res = await api.get<{ report: ClientPnlRow[] }>('/api/v1/reports/client-pnl');
      return unwrap(res).report;
    },
  });
}

export function useSupplierReport(window: DeliveryWindow = 'this_month') {
  return useQuery({
    queryKey: ['report-supplier', window],
    queryFn: async () => {
      const res = await api.get<{ report: SupplierReportRow[]; window: DeliveryWindow }>(
        `/api/v1/reports/supplier-performance?window=${window}`,
      );
      return unwrap(res).report;
    },
  });
}

export function useFinancialReport() {
  return useQuery({
    queryKey: ['report-financial'],
    queryFn: async () => {
      const res = await api.get<{ report: FinancialOverviewRow[] }>('/api/v1/reports/financial-overview');
      return unwrap(res).report;
    },
  });
}

// ─── Slice 4 — unified leadreports.io-style report (Sam Loom #72-85) ────────
// One row per (campaign × supplier), with revenue + profit + margin
// computed server-side. Replaces the 5 separate report pages.

export interface UnifiedReportRow {
  campaignId: string;
  campaignName: string;
  clientName: string;
  vertical: string;
  supplier: string;
  supplierPlatform: string;
  catchrUrl: string | null;
  leads: number;
  spend: number;
  revenue: number;
  profit: number;
  cpl: number;
  margin: number;
}

export interface UnifiedReportTotals {
  leads: number;
  spend: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface UnifiedReportResponse {
  window: DeliveryWindow;
  supplier: string | null;
  campaign: string | null;
  rows: UnifiedReportRow[];
  totals: UnifiedReportTotals;
}

export interface UnifiedReportFilters {
  window?: DeliveryWindow;
  supplier?: string;
  campaign?: string;
}

export function useUnifiedReport(filters: UnifiedReportFilters = {}) {
  const window = filters.window ?? 'this_month';
  const supplier = filters.supplier ?? '';
  const campaign = filters.campaign ?? '';
  return useQuery({
    queryKey: ['report-unified', window, supplier, campaign],
    queryFn: async () => {
      const params = new URLSearchParams({ window });
      if (supplier) params.set('supplier', supplier);
      if (campaign) params.set('campaign', campaign);
      const res = await api.get<UnifiedReportResponse>(`/api/v1/reports/unified?${params}`);
      return unwrap(res);
    },
  });
}
