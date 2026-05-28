import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export type PortalClientType = 'managed' | 'ppl';

export interface PortalAdSpendPlatform {
  platform: string;
  spend: number;
  currency: string;
}

export interface PortalDashboard {
  companyName: string;
  clientType: PortalClientType;
  activeCampaigns: number;
  totalLeadsThisMonth: number;
  totalLeadsAllTime: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalOutstanding: number;
  agreementSigned: boolean;
  recentLeads: { date: string; leads: number }[];
  // Per-platform ad spend (MTD), populated only for managed clients; empty
  // array for PPL. Optional on the wire so a Vercel-first deploy (FE new, BE
  // not yet redeployed) doesn't TypeError on the old response shape.
  adSpendByPlatform?: PortalAdSpendPlatform[];
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
  campaignId: string;
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

export type CreativeApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface CreativeApprovalState {
  status: CreativeApprovalStatus;
  decidedAt: string | null;
  decidedByName: string | null;
  feedback: string | null;
}

export interface PortalCreative {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  fileUrl: string;
  // Optional so a Vercel-first deploy (FE new, BE not yet redeployed) doesn't
  // TypeError on the old API response shape. Treat missing as "pending".
  approval?: CreativeApprovalState;
}

export interface PortalCompliance {
  campaignName: string;
  creatives: PortalCreative[];
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

export interface PortalLeadsBySource {
  platform: string;
  leads: number;
  spend: number;
  currency: string;
  /** True when the lead count was pro-rated by spend share across multiple
   *  sources on the same campaign — show a footnote so the client knows the
   *  number is an attribution estimate, not a LeadByte hard total. */
  leadsAreEstimated: boolean;
}

export interface PortalLeadsResponse {
  leads: PortalLeadDay[];
  range: PortalLeadsRange;
  // Sam (jam-video #2, 27-May-2026): per-source spend for the same date
  // range. Optional on the wire so a FE deploy ahead of BE doesn't crash.
  bySource?: PortalLeadsBySource[];
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

export function useApproveCreative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ creativeId }: { creativeId: string }) => {
      await api.post(`/api/v1/portal/creatives/${creativeId}/approve`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-compliance'] });
      qc.invalidateQueries({ queryKey: ['portal-creatives'] });
    },
  });
}

export function useRejectCreative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ creativeId, feedback }: { creativeId: string; feedback: string }) => {
      await api.post(`/api/v1/portal/creatives/${creativeId}/reject`, { feedback });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-compliance'] });
      qc.invalidateQueries({ queryKey: ['portal-creatives'] });
    },
  });
}

export function useRequestChangesCreative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ creativeId, feedback }: { creativeId: string; feedback: string }) => {
      await api.post(`/api/v1/portal/creatives/${creativeId}/request-changes`, { feedback });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-compliance'] });
      qc.invalidateQueries({ queryKey: ['portal-creatives'] });
    },
  });
}

// ─── Creative review v2 (Sam #9/#11 — 2026-05-17) ─────────────────────────
// Buyer-facing review tab at /portal/creatives. Returns assets split into
// 2 cards (media vs copy_lp). Buyer signs off each card independently.

export interface PortalReviewCreative {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  type: string;
  fileUrl: string;
  uploadedAt: string;
  section: 'media' | 'copy_lp';
  approval: CreativeApprovalState;
}

export interface PortalCreativesBySection {
  media: PortalReviewCreative[];
  copyLp: PortalReviewCreative[];
}

export function usePortalCreatives() {
  return useQuery({
    queryKey: ['portal-creatives'],
    queryFn: async () => {
      const res = await api.get<PortalCreativesBySection>('/api/v1/portal/creatives');
      return unwrap(res);
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
