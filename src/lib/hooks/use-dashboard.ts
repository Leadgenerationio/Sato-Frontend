import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { CampaignSummary } from './use-campaigns';
import type { InvoiceSummary } from './use-invoices';
import type { ClientSummary } from './use-clients';

export interface FinancialOverviewRow {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoicesPaid: number;
  invoicesOverdue: number;
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

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // TODO: replace with /api/v1/dashboard/stats aggregate when BE adds it — see audit 2026-05-03.
      // List endpoints are capped at limit=100, so businesses with more than 100
      // campaigns/invoices/clients will see undercounted totals here.
      const [campaignRes, invoiceRes, clientRes] = await Promise.all([
        api.get<{ campaigns: CampaignSummary[]; total: number }>('/api/v1/campaigns?limit=100'),
        api.get<{ invoices: InvoiceSummary[]; total: number }>('/api/v1/invoices?limit=100'),
        api.get<{ clients: ClientSummary[]; total: number }>('/api/v1/clients?limit=100'),
      ]);

      const campaigns = campaignRes.data?.campaigns ?? [];
      const invoices = invoiceRes.data?.invoices ?? [];
      const clients = clientRes.data?.clients ?? [];

      const activeCampaigns = campaigns.filter((c) => c.status === 'active');
      const activeClients = clients.filter((c) => c.status === 'active');
      const totalRevenue = campaigns.reduce((sum, c) => sum + c.totalRevenue, 0);
      const totalCost = campaigns.reduce((sum, c) => sum + c.totalCost, 0);
      const netProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const totalLeadsThisMonth = campaigns.reduce((sum, c) => sum + c.leadsThisMonth, 0);

      // Sort invoices by creation date descending, take latest 5
      const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        // Trend deltas require historical comparison data the BE doesn't surface
        // yet. Returning null lets the UI hide the trend chip entirely instead
        // of showing fabricated numbers.
        revenueChange: null,
        activeClients: activeClients.length,
        clientChange: null,
        activeCampaigns: activeCampaigns.length,
        campaignChange: null,
        totalLeadsThisMonth,
        leadsChange: null,
        totalCost: Math.round(totalCost * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        recentInvoices,
      } as DashboardStats;
    },
  });
}
