import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
  total: number;
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
      return res.data!;
    },
  });
}

export function usePortalCampaigns() {
  return useQuery({
    queryKey: ['portal-campaigns'],
    queryFn: async () => {
      const res = await api.get<{ campaigns: PortalCampaign[] }>('/api/v1/portal/campaigns');
      return res.data!.campaigns;
    },
  });
}

export function usePortalLeads() {
  return useQuery({
    queryKey: ['portal-leads'],
    queryFn: async () => {
      const res = await api.get<{ leads: PortalLeadDay[] }>('/api/v1/portal/leads');
      return res.data!.leads;
    },
  });
}

export function usePortalInvoices() {
  return useQuery({
    queryKey: ['portal-invoices'],
    queryFn: async () => {
      const res = await api.get<{ invoices: PortalInvoice[] }>('/api/v1/portal/invoices');
      return res.data!.invoices;
    },
  });
}

export function usePortalCompliance() {
  return useQuery({
    queryKey: ['portal-compliance'],
    queryFn: async () => {
      const res = await api.get<{ compliance: PortalCompliance[] }>('/api/v1/portal/compliance');
      return res.data!.compliance;
    },
  });
}

export function usePortalAgreement() {
  return useQuery({
    queryKey: ['portal-agreement'],
    queryFn: async () => {
      const res = await api.get<{ agreement: PortalAgreement }>('/api/v1/portal/agreement');
      return res.data!.agreement;
    },
  });
}
