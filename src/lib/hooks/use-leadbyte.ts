import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/api/v1/leadbyte';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LbBuyer {
  id?: string | number;
  company: string;
  bid?: string;
  status?: 'Active' | 'Inactive';
  credit_amount?: number;
  credit_balance?: number;
  phone?: string;
  postcode?: string;
}

export interface LbDelivery {
  id: string | number;
  reference?: string;
  status?: 'Active' | 'Inactive' | 'Saved';
  campaign?: { id: string | number; name: string };
  deliver_to?: 'Store Lead' | 'Email' | 'SMS' | 'Direct Post';
  buyer?: { id: string | number; name: string; bid?: string };
}

export interface LbResponder {
  id: string | number;
  reference?: string;
  status?: string;
  campaign?: { id: string | number; name: string };
  pushes?: Array<{
    push_id: string | number;
    name: string;
    sent?: number;
    delivered?: number;
    clicks?: number;
    conversions?: number;
    cost?: number;
    revenue?: number;
    profit?: number;
    active?: boolean;
  }>;
}

export interface LbLeadDetail {
  id: string | number;
  received?: string;
  campaign?: { id: string | number; name: string };
  supplier?: { id: string | number; name: string };
  payout?: number;
  revenue?: number;
}

export interface LbQueueItem {
  queueRef: string;
  status: 'Pending' | 'Processed' | 'Not Found';
  processed?: string;
}

export interface LbMessagingRow {
  campaign: string;
  responder?: string;
  supplier?: string;
  push?: string;
  sent: number;
  delivered: number;
  opened?: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  currency: string;
}

export interface LbBuyerReportRow {
  campaign: string;
  buyer: string;
  posted: number;
  accepted: number;
  sold: number;
  rejected: number;
  returned: number;
  revenue: number;
  currency: string;
}

export interface LbCampaignDetail {
  id: string | number;
  name: string;
  reference?: string;
  currency?: string;
  country?: string;
  fields: Array<{ name: string; label: string; dataType: string; required: boolean; selection?: string[] }>;
}

type Wrap<T> = { data: T };

async function unwrap<T>(promise: Promise<{ data?: Wrap<T> | T }>): Promise<T> {
  const res = await promise;
  const body = res.data as Wrap<T> | T;
  if (body && typeof body === 'object' && 'data' in (body as Wrap<T>)) return (body as Wrap<T>).data;
  return body as T;
}

// ─── Buyers ─────────────────────────────────────────────────────────────────

export function useLbBuyers(status?: 'Active' | 'Inactive') {
  const qs = status ? `?status=${status}` : '';
  return useQuery<LbBuyer[]>({
    queryKey: ['lb-buyers', status],
    queryFn: () => unwrap(api.get<Wrap<LbBuyer[]>>(`${BASE}/buyers${qs}`)),
  });
}

export function useLbBuyer(id?: string | number) {
  return useQuery<LbBuyer>({
    queryKey: ['lb-buyer', id],
    queryFn: () => unwrap(api.get<Wrap<LbBuyer>>(`${BASE}/buyers/${id}`)),
    enabled: !!id,
  });
}

export function useUpdateLbBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string | number; update: { status?: 'Active' | 'Inactive'; caps?: { day?: number; week?: number; month?: number; total?: number } } }) =>
      unwrap(api.put<Wrap<unknown>>(`${BASE}/buyers/${args.id}`, { update: args.update })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lb-buyers'] }),
  });
}

export function useAddCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { BID: string; amount: number; invoice?: string }) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/credit/add`, input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lb-buyers'] }),
  });
}

// ─── Deliveries ─────────────────────────────────────────────────────────────

export function useLbDeliveries(status?: 'Active' | 'Inactive' | 'Saved') {
  const qs = status ? `?status=${status}` : '';
  return useQuery<LbDelivery[]>({
    queryKey: ['lb-deliveries', status],
    queryFn: () => unwrap(api.get<Wrap<LbDelivery[]>>(`${BASE}/deliveries${qs}`)),
  });
}

export function useLbDelivery(id?: string | number) {
  return useQuery<LbDelivery>({
    queryKey: ['lb-delivery', id],
    queryFn: () => unwrap(api.get<Wrap<LbDelivery>>(`${BASE}/deliveries/${id}`)),
    enabled: !!id,
  });
}

export function useTriggerDeliveries() {
  return useMutation({
    mutationFn: (args: { leadId?: string | number; leads?: Array<string | number>; deliveryId?: string | number; deliveries?: Array<string | number> }) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/deliveries/trigger`, args)),
  });
}

// ─── Responders ─────────────────────────────────────────────────────────────

export function useLbResponders() {
  return useQuery<LbResponder[]>({
    queryKey: ['lb-responders'],
    queryFn: () => unwrap(api.get<Wrap<LbResponder[]>>(`${BASE}/responders`)),
  });
}

export function useLbResponder(id?: string | number) {
  return useQuery<LbResponder>({
    queryKey: ['lb-responder', id],
    queryFn: () => unwrap(api.get<Wrap<LbResponder>>(`${BASE}/responders/${id}`)),
    enabled: !!id,
  });
}

// ─── Leads ──────────────────────────────────────────────────────────────────

export function useLbLead(id?: string | number) {
  return useQuery<LbLeadDetail>({
    queryKey: ['lb-lead', id],
    queryFn: () => unwrap(api.get<Wrap<LbLeadDetail>>(`${BASE}/leads/${id}`)),
    enabled: !!id,
  });
}

export function useSearchLeads() {
  return useMutation({
    mutationFn: (searches: Array<{ campaignId?: number | string; email?: string; phone?: string }>) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/leads/search`, { searches })),
  });
}

export function useReturnLead() {
  return useMutation({
    mutationFn: (args: { leadId?: string | number; leadIds?: Array<string | number>; BID: string; reason: string }) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/leads/return`, args)),
  });
}

export function useLeadFeedback() {
  return useMutation({
    mutationFn: (args: { leads: Array<number | string>; BID: string; feedback: string; notes?: string }) =>
      unwrap(api.put<Wrap<unknown>>(`${BASE}/leads/feedback`, args)),
  });
}

export function useReprocessLeads() {
  return useMutation({
    mutationFn: (args: { leadId?: string | number; leadIds?: Array<string | number> }) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/leads/reprocess`, args)),
  });
}

export function useAssignBuyer() {
  return useMutation({
    mutationFn: (args: { leadId?: string | number; leadIds?: Array<string | number>; deliveryId: string | number; triggerActions?: string }) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/leads/assignbuyer`, args)),
  });
}

// ─── API Queue ──────────────────────────────────────────────────────────────

export function useQueueItem(ref?: string) {
  return useQuery<LbQueueItem>({
    queryKey: ['lb-queue', ref],
    queryFn: () => unwrap(api.get<Wrap<LbQueueItem>>(`${BASE}/queue/${ref}`)),
    enabled: !!ref,
    refetchInterval: (query) => (query.state.data?.status === 'Pending' ? 2000 : false),
  });
}

// ─── Quarantine ─────────────────────────────────────────────────────────────

export function useProcessQuarantine() {
  return useMutation({
    mutationFn: (args: { quarantineId?: string | number; quarantineIds?: Array<string | number>; action: 'process' | 'reject' }) =>
      unwrap(api.post<Wrap<unknown>>(`${BASE}/quarantine/process`, args)),
  });
}

// ─── Lead Financials ────────────────────────────────────────────────────────

export function useUpdateLeadFinancials() {
  return useMutation({
    mutationFn: (args: { leads: Array<number | string>; newPayout?: number; newRevenue?: number; BID?: string }) =>
      unwrap(api.put<Wrap<unknown>>(`${BASE}/leadfinancials`, args)),
  });
}

// ─── Campaign Detail ────────────────────────────────────────────────────────

export function useLbCampaignDetail(id?: string | number) {
  return useQuery<LbCampaignDetail>({
    queryKey: ['lb-campaign-detail', id],
    queryFn: () => unwrap(api.get<Wrap<LbCampaignDetail>>(`${BASE}/campaigns/${id}`)),
    enabled: !!id,
  });
}

// ─── Reports ────────────────────────────────────────────────────────────────

function reportQs(p: { campaignId: string | number; window?: string; from?: string; to?: string }): string {
  const q = new URLSearchParams();
  q.set('campaignId', String(p.campaignId));
  if (p.window) q.set('window', p.window);
  if (p.from) q.set('from', p.from);
  if (p.to) q.set('to', p.to);
  return q.toString();
}

export function useEmailReport(params: { campaignId: string | number; window?: string }) {
  return useQuery<LbMessagingRow[]>({
    queryKey: ['lb-email-report', params],
    queryFn: () => unwrap(api.get<Wrap<LbMessagingRow[]>>(`${BASE}/reports/email?${reportQs(params)}`)),
  });
}

export function useSmsReport(params: { campaignId: string | number; window?: string }) {
  return useQuery<LbMessagingRow[]>({
    queryKey: ['lb-sms-report', params],
    queryFn: () => unwrap(api.get<Wrap<LbMessagingRow[]>>(`${BASE}/reports/sms?${reportQs(params)}`)),
  });
}

export function useLbBuyerReport(params: { campaignId: string | number; window?: string }) {
  return useQuery<LbBuyerReportRow[]>({
    queryKey: ['lb-buyer-report', params],
    queryFn: () => unwrap(api.get<Wrap<LbBuyerReportRow[]>>(`${BASE}/reports/buyer?${reportQs(params)}`)),
  });
}

// ─── Time-slice dashboard ───────────────────────────────────────────────────

export type LbWindow = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'ytd';

export const LB_WINDOW_LABELS: Record<LbWindow, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  ytd: 'Year to Date',
};

export interface LbSummaryTotals {
  window: LbWindow;
  campaigns: number;
  leads: number;
  valid: number;
  revenue: number;
  payout: number;
  profit: number;
  currency: string;
}

export interface LbCampaignRow {
  campaign: string;
  leads: number;
  valid: number;
  invalid?: number;
  pending?: number;
  rejections?: number;
  payable?: number;
  sold?: number;
  returns?: number;
  payout: number;
  revenue: number;
  profit: number;
  currency: string;
}

export interface LbSupplierSpendRow {
  supplierId: string;
  supplierName: string;
  platform?: string;
  campaignId?: string;
  campaignName?: string;
  window: LbWindow;
  spend: number;
  leads: number;
  cpl: number;
}

// Live dashboard polls every 30s so data stays close to the 2-min backend sync.
const LIVE_REFETCH_MS = 30_000;

export function useLbSummary(window: LbWindow) {
  return useQuery<LbSummaryTotals>({
    queryKey: ['lb-summary', window],
    queryFn: () => unwrap(api.get<Wrap<LbSummaryTotals>>(`${BASE}/reports/summary?window=${window}`)),
    refetchInterval: LIVE_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useLbCampaignReport(window: LbWindow) {
  return useQuery<LbCampaignRow[]>({
    queryKey: ['lb-campaign-report', window],
    queryFn: () => unwrap(api.get<Wrap<LbCampaignRow[]>>(`${BASE}/reports/campaign?window=${window}`)),
    refetchInterval: LIVE_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useLbSupplierSpend(window: LbWindow) {
  return useQuery<LbSupplierSpendRow[]>({
    queryKey: ['lb-supplier-spend', window],
    queryFn: () => unwrap(api.get<Wrap<LbSupplierSpendRow[]>>(`${BASE}/reports/supplier-spend?window=${window}`)),
    refetchInterval: LIVE_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Manually enqueue a LeadByte sync. The backend job usually completes in
 * ~3 seconds; caller should invalidate the lb-* queries after a short delay.
 */
export function useLbManualSync() {
  const qc = useQueryClient();
  return useMutation<{ jobId: string; enqueuedAt: string }>({
    mutationFn: () =>
      unwrap(api.post<Wrap<{ jobId: string; enqueuedAt: string }>>('/api/v1/integrations/leadbyte/sync')),
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['lb-summary'] });
        qc.invalidateQueries({ queryKey: ['lb-campaign-report'] });
        qc.invalidateQueries({ queryKey: ['lb-supplier-spend'] });
      }, 3000);
    },
  });
}
