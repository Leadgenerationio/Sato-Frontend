import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { InvoiceSummary } from './use-invoices';

export interface FinancialOverviewRow {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  /** Optional — older BE snapshots without this field treat it as 0 client-side. */
  invoicesPending?: number;
  vatCollected: number;
}

export function useFinancialOverview() {
  return useQuery({
    queryKey: ['reports-financial-overview'],
    queryFn: async () => {
      const res = await api.get<{ report: FinancialOverviewRow[] }>('/api/v1/reports/financial-overview');
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
  campaignChange: number | null;
  totalLeadsThisMonth: number;
  leadsChange: number | null;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  recentInvoices: InvoiceSummary[];
}

interface BackendStats {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  activeClients: number;
  activeCampaigns: number;
  leadsThisMonth: number;
  /** Period-over-period revenue change as a percentage. Null when last month had zero baseline. */
  revenueChange?: number | null;
  /** Period-over-period leads change as a percentage. Null when last month had zero baseline. */
  leadsChange?: number | null;
  asOf: string;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
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
      const [statsRes, invoiceRes] = await Promise.all([
        api.get<BackendStats>('/api/v1/dashboard/stats'),
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
        campaignChange: null,
        totalLeadsThisMonth: stats.leadsThisMonth,
        leadsChange: stats.leadsChange ?? null,
        totalCost: stats.totalCost,
        netProfit: stats.netProfit,
        profitMargin: stats.profitMargin,
        recentInvoices,
      } as DashboardStats;
    },
  });
}
