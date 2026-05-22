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

// Slice 4 Day 3 — the per-page report hooks (useCampaignReport,
// useClientPnlReport, useSupplierReport, useFinancialReport) and their row
// types were removed when the 5 split report pages were folded into
// /reports/unified. Backend endpoints stay live for now in case dashboards
// or external integrations still hit them; useFinancialOverview (in
// use-dashboard.ts) is the one remaining consumer.

// ─── Slice 4 — unified leadreports.io-style report (Sam Loom #72-85) ────────
// One row per (campaign × supplier), with revenue + profit + margin
// computed server-side. Replaces the 5 separate report pages.

export interface UnifiedReportRow {
  campaignId: string;
  campaignName: string;
  clientName: string;
  /**
   * OCT-42 (2026-05-21): full list of buyers linked to this campaign via
   * `client_campaigns`. Render "Multiple (N)" with tooltip when length > 1.
   * Optional for back-compat with older BE snapshots — fall back to
   * `[clientName]` when missing.
   */
  clientNames?: string[];
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

/**
 * Sam (2026-05-15 meeting #10) — per-platform roll-up. Backend aggregates the
 * per-(campaign × supplier) rows by `supplierPlatform` so Σ(byPlatform) ===
 * totals. Optional on the response for back-compat with older backend builds
 * that pre-date the 2026-05-22 ship.
 */
export interface UnifiedReportPlatformRow {
  platform: string;
  catchrUrl: string | null;
  leads: number;
  spend: number;
  revenue: number;
  profit: number;
  cpl: number;
  margin: number;
}

export interface UnifiedReportResponse {
  window: DeliveryWindow;
  supplier: string | null;
  campaign: string | null;
  rows: UnifiedReportRow[];
  totals: UnifiedReportTotals;
  byPlatform?: UnifiedReportPlatformRow[];
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
