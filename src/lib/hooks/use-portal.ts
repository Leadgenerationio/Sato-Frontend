import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface PortalDashboard {
  companyName: string;
  activeCampaigns: number;
  totalLeadsThisMonth: number;
  totalLeadsAllTime: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalOutstanding: number;
  agreementSigned: boolean;
  recentLeads: { date: string; leads: number }[];
}

export interface PortalCampaign {
  id: string;
  name: string;
  vertical: string;
  status: string;
  leadsThisWeek: number;
  leadsThisMonth: number;
  totalLeads: number;
  startDate: string;
}

export interface PortalLeadDay {
  date: string;
  campaignName: string;
  leadCount: number;
  validLeads: number;
  invalidLeads: number;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  // Money on the wire is a decimal string; parse with toMoney() before arithmetic.
  total: string;
  currency: string;
  dueDate: string;
  paidDate: string | null;
  daysOverdue: number;
}

export interface PortalCompliance {
  campaignName: string;
  creatives: { id: string; name: string; type: string; uploadedAt: string }[];
  landingPages: { id: string; url: string; screenshotUrl: string | null; lastChecked: string }[];
}

export interface PortalAgreement {
  id: string;
  status: string;
  signedAt: string | null;
  documentUrl: string | null;
  clientName: string;
  terms: string;
}

export function usePortalDashboard() {
  return useQuery({
    queryKey: ['portal-dashboard'],
    queryFn: async () => {
      const res = await api.get<PortalDashboard>('/api/v1/portal/dashboard');
      return unwrap(res);
    },
  });
}

export function usePortalCampaigns() {
  return useQuery({
    queryKey: ['portal-campaigns'],
    queryFn: async () => {
      const res = await api.get<{ campaigns: PortalCampaign[] }>('/api/v1/portal/campaigns');
      return unwrap(res).campaigns;
    },
  });
}

export interface PortalLeadsRange {
  from: string;
  to: string;
}

export interface PortalLeadsResponse {
  leads: PortalLeadDay[];
  range: PortalLeadsRange;
}

export function usePortalLeads(filter?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (filter?.from) params.set('from', filter.from);
  if (filter?.to) params.set('to', filter.to);
  const qs = params.toString();

  return useQuery({
    queryKey: ['portal-leads', filter?.from, filter?.to],
    queryFn: async () => {
      const res = await api.get<PortalLeadsResponse>(`/api/v1/portal/leads${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function usePortalInvoices() {
  return useQuery({
    queryKey: ['portal-invoices'],
    queryFn: async () => {
      const res = await api.get<{ invoices: PortalInvoice[] }>('/api/v1/portal/invoices');
      return unwrap(res).invoices;
    },
  });
}

export function usePortalCompliance() {
  return useQuery({
    queryKey: ['portal-compliance'],
    queryFn: async () => {
      const res = await api.get<{ compliance: PortalCompliance[] }>('/api/v1/portal/compliance');
      return unwrap(res).compliance;
    },
  });
}

export function usePortalAgreement() {
  return useQuery({
    queryKey: ['portal-agreement'],
    queryFn: async () => {
      const res = await api.get<{ agreement: PortalAgreement }>('/api/v1/portal/agreement');
      return unwrap(res).agreement;
    },
  });
}
