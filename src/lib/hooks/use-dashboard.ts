import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { InvoiceSummary } from './use-invoices';

export interface FinancialOverviewRow {
  month: string;
  revenue: number;
  /**
   * Sum of ad_spend.spend for the month, or `null` for months that predate
   * the Catchr connection. Chart should render gaps (not flat zero) on
   * null months. Older BE snapshots emitted 0; tolerate either.
   */
  expenses: number | null;
  profit: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  /** Optional — older BE snapshots without this field treat it as 0 client-side. */
  invoicesPending?: number;
  vatCollected: number;
  /**
   * True for the current calendar month (partial — month-to-date totals only).
   * Optional for back-compat. Chart should visually de-emphasize partial
   * rows so users don't read them as completed-month figures.
   */
  isPartial?: boolean;
}

export function useFinancialOverview(opts: { window?: DashboardWindow } = {}) {
  const { window } = opts;
  return useQuery({
    queryKey: ['reports-financial-overview', window ?? 'default'],
    queryFn: async () => {
      const url = window
        ? `/api/v1/reports/financial-overview?window=${encodeURIComponent(window)}`
        : '/api/v1/reports/financial-overview';
      const res = await api.get<{ report: FinancialOverviewRow[] }>(url);
      return unwrap(res).report;
    },
    retry: (failureCount, error) => {
      const status = (error as { status?: number } | null)?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });
}

export interface LeadsByDayPoint {
  day: string;
  date: string;
  leads: number;
}

export function useLeadsByDay(days = 7) {
  return useQuery({
    queryKey: ['dashboard-leads-by-day', days],
    queryFn: async () => {
      const res = await api.get<{ points: LeadsByDayPoint[] }>(`/api/v1/dashboard/leads-by-day?days=${days}`);
      return unwrap(res).points;
    },
  });
}

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  category: 'invoice' | 'agreement' | 'credit' | 'system';
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard-recent-activity', limit],
    queryFn: async () => {
      const res = await api.get<{ items: ActivityItem[] }>(`/api/v1/dashboard/recent-activity?limit=${limit}`);
      return unwrap(res).items;
    },
  });
}

export interface DashboardStats {
  totalRevenue: number;
  // Change/trend deltas are null until the backend reports historical
  // comparisons. Consumers MUST hide the trend chip when null.
  revenueChange: number | null;
  activeClients: number;
  clientChange: number | null;
  activeCampaigns: number;
  /** Subset of activeCampaigns that are linked to at least one client. */
  linkedCampaigns: number | null;
  campaignChange: number | null;
  totalLeadsThisMonth: number;
  /** Echo from BE — used by the FE to label the Leads tile + tooltip. */
  leadsWindowLabel: string;
  leadsChange: number | null;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  /**
   * Period-coherent inputs for Profit / Margin — always rolling-365d
   * revenue and rolling-90d cost regardless of the selected window. Used
   * by the FE tooltip on the Profit/Margin tiles so the user sees what
   * the calc was based on.
   */
  rollingRevenue365d?: number;
  rollingCost90d?: number;
  recentInvoices: InvoiceSummary[];
}

/**
 * Time-window keys accepted by the dashboard stats endpoint. Mirrors the
 * BE DashboardWindow type. Default is 'this_month' on the BE side, so
 * omitting the param falls back to the existing behaviour exactly.
 */
export type DashboardWindow =
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_90d'
  | 'last_6m'
  | 'last_year';

export const DASHBOARD_WINDOW_OPTIONS: Array<{ value: DashboardWindow; label: string }> = [
  { value: 'this_week', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'last_6m', label: 'Last 6 months' },
  { value: 'last_year', label: 'Last 12 months' },
];

interface BackendStats {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  rollingRevenue365d?: number;
  rollingCost90d?: number;
  activeClients: number;
  activeCampaigns: number;
  /**
   * Campaigns with status='active' AND >=1 client_campaigns link.
   * `activeCampaigns` includes orphan LeadByte imports; `linkedCampaigns`
   * is the subset whose leads actually flow into Stato per-client P&L.
   * Optional for back-compat with older BE deployments.
   */
  linkedCampaigns?: number;
  leadsThisMonth: number;
  /** Echo of the window the BE used to compute leadsThisMonth + leadsChange. */
  leadsWindow?: DashboardWindow;
  /** Human-readable label for the lead window (e.g. "Last 90 days"). */
  leadsWindowLabel?: string;
  /** Period-over-period revenue change as a percentage. Null when last month had zero baseline. */
  revenueChange?: number | null;
  /** Period-over-period leads change as a percentage. Null when last month had zero baseline. */
  leadsChange?: number | null;
  asOf: string;
}

export function useDashboardStats(opts: { window?: DashboardWindow } = {}) {
  const { window } = opts;
  return useQuery({
    // Include the window in the cache key so each filter selection has its
    // own cached response — switching back to a previous window is instant.
    queryKey: ['dashboard-stats', window ?? 'default'],
    queryFn: async () => {
      // The new /api/v1/dashboard/stats aggregate endpoint computes
      // revenue / cost / profit / leadsThisMonth / activeClients / activeCampaigns
      // server-side as 5 small SQL queries — replaces the previous 3-list
      // round-trip pattern that capped at limit=100 and double-counted some
      // numbers.
      //
      // Recent invoices still come from /invoices?limit=20 — they need full
      // row data for the dashboard table, not just an aggregate. The 100→20
      // limit drop here also makes the request faster.
      const statsUrl = window
        ? `/api/v1/dashboard/stats?window=${encodeURIComponent(window)}`
        : '/api/v1/dashboard/stats';
      const [statsRes, invoiceRes] = await Promise.all([
        api.get<BackendStats>(statsUrl),
        api.get<{ invoices: InvoiceSummary[]; total: number }>('/api/v1/invoices?limit=20'),
      ]);

      const stats = statsRes.data!;
      const invoices = invoiceRes.data?.invoices ?? [];

      const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      return {
        totalRevenue: stats.totalRevenue,
        // Trend deltas now come from the BE — month-over-month comparison.
        // Null when there's no prior-period baseline to compare against;
        // the dashboard chip is hidden in that case.
        revenueChange: stats.revenueChange ?? null,
        activeClients: stats.activeClients,
        // Client/campaign deltas not yet surfaced — the BE doesn't track
        // historical headcount snapshots. Null hides the chip.
        clientChange: null,
        activeCampaigns: stats.activeCampaigns,
        linkedCampaigns: stats.linkedCampaigns ?? null,
        campaignChange: null,
        totalLeadsThisMonth: stats.leadsThisMonth,
        // Falls back to "This month" so older BE snapshots without the
        // leadsWindowLabel field still produce a sensible label.
        leadsWindowLabel: stats.leadsWindowLabel ?? 'This month',
        leadsChange: stats.leadsChange ?? null,
        totalCost: stats.totalCost,
        netProfit: stats.netProfit,
        profitMargin: stats.profitMargin,
        rollingRevenue365d: stats.rollingRevenue365d,
        rollingCost90d: stats.rollingCost90d,
        recentInvoices,
      } as DashboardStats;
    },
  });
}
