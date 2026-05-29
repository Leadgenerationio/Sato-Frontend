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
  /** Valid lead count from LeadByte's supplier report — matches admin. */
  leads: number;
  spend: number;
  currency: string;
}

// Sam (jam-video #3, 29-May-2026): no more spend-share estimates. The BE
// only returns per-source rows when the range matches a LeadByte preset.
// `bySourceWindow` tells the FE whether the breakdown is available + which
// preset gave it.
export type PortalLeadsBySourceWindow =
  | { kind: 'preset'; preset: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'ytd' }
  | { kind: 'custom-no-preset-match' };

export interface PortalLeadsResponse {
  leads: PortalLeadDay[];
  range: PortalLeadsRange;
  bySource?: PortalLeadsBySource[];
  bySourceWindow?: PortalLeadsBySourceWindow;
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
  // R2 key for fetching a fresh signed URL on open. Optional on the wire so
  // a Vercel-first deploy doesn't TypeError on the old response shape, and
  // null for legacy rows uploaded before r2Key was recorded.
  r2Key?: string | null;
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

// Per-creative signed URL for the buyer. Replaces fetchFreshDownloadUrl on
// portal/creatives — the previous call hardcoded folder='creatives' but
// every pre-fix upload landed in misc/, which yielded R2's ExpiredRequest
// XML via the stale-fileUrl fallback. The server now picks the folder per
// row from the stored file_url, so misc/legacy and creatives/new both
// resolve through this single endpoint.
export async function fetchPortalCreativeSignedUrl(creativeId: string): Promise<string> {
  const res = await api.get<{ url: string }>(`/api/v1/portal/creatives/${creativeId}/signed-url`);
  return unwrap(res).url;
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
