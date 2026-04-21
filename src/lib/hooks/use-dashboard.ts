import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CampaignSummary } from './use-campaigns';
import type { InvoiceSummary } from './use-invoices';
import type { ClientSummary } from './use-clients';

export interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  activeClients: number;
  clientChange: number;
  activeCampaigns: number;
  campaignChange: number;
  totalLeadsThisMonth: number;
  leadsChange: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  recentInvoices: InvoiceSummary[];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
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
        revenueChange: 12.4, // mock trend — would calculate from historical data
        activeClients: activeClients.length,
        clientChange: 2,
        activeCampaigns: activeCampaigns.length,
        campaignChange: 1,
        totalLeadsThisMonth,
        leadsChange: 8.2,
        totalCost: Math.round(totalCost * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        recentInvoices,
      } as DashboardStats;
    },
  });
}
