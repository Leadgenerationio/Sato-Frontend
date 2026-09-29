import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { InvoiceSummary } from './use-invoices';
import type { VatTreatment } from '@/lib/vat-treatment';

export interface ClientSummary {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  currency: string;
  creditScore: number | null;
  activeCampaigns: number;
  /** Paid revenue in the client's own `currency` only (BE ≥ feedback-M3). */
  totalRevenue: number;
  /** Paid revenue per invoice currency. Absent on older backends. */
  revenueByCurrency?: Record<string, number>;
  createdAt: string;
  // Drive the "No signed agreement" / "No documents" warning badges shown
  // next to an active client's (stored, never relabelled) status.
  agreementSigned: boolean;
  documentsCount: number;
}

export type ContactType = 'primary' | 'billing' | 'compliance' | 'other';

export interface ClientContact {
  id: string;
  contactType: ContactType;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface ClientContactInput {
  contactType: ContactType;
  name: string;
  email: string;
  phone: string;
  role: string;
}

// Managed clients see ad spend in their portal; pay-per-lead clients have it
// hidden. Editable from the client detail page (Sam ask 2026-06-15). The
// actual spend-hiding is enforced server-side in getLeadsBySource.
export type ClientType = 'managed' | 'ppl';

export interface ClientDetail extends ClientSummary {
  clientType: ClientType;
  companyNumber: string;
  contactPhone: string;
  address: string;
  addressLine: string;
  addressTown: string;
  addressCounty: string;
  addressCountry: string;
  addressPostcode: string;
  paymentTermsDays: number;
  vatRegistered: boolean;
  addVatToInvoices: boolean;
  vatNumber: string;
  vatRate: number;
  // Sam feedback 2026-09-29 (M5/S4). Optional so an API that predates
  // clients.vat_treatment still type-checks — read it via resolveVatTreatment().
  vatTreatment?: VatTreatment;
  leadPrice: number;
  billingWorkflow: string;
  onboardingStatus: string;
  agreementSigned: boolean;
  creditLastChecked: string | null;
  creditRiskRating: string | null;
  leadbyteClientId: string | null;
  endoleCompanyId: string | null;
  xeroContactId: string | null;
  notes: string;
  contacts: ClientContact[];
}

export interface CreditCheckEntry {
  id: string;
  creditScore: number;
  riskRating: string;
  ccjCount: number;
  ccjTotal: number;
  checkedAt: string;
  scoreChange: number | null;
}

export interface PaginatedClients {
  clients: ClientSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// Feedback S14 (29 Sep 2026): server-side sort + currency/country filters,
// and a CSV export of exactly the filtered, sorted list.
export type ClientSortKey = 'company' | 'status' | 'revenue' | 'campaigns' | 'credit' | 'created';
export type SortDir = 'asc' | 'desc';

export interface ClientListFilters {
  status?: string;
  search?: string;
  currency?: string;
  country?: string;
  sort?: ClientSortKey;
  dir?: SortDir;
  page?: number;
  limit?: number;
}

export function clientListParams(filters?: ClientListFilters, withPaging = true): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.currency) params.set('currency', filters.currency);
  if (filters?.country?.trim()) params.set('country', filters.country.trim());
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.dir) params.set('dir', filters.dir);
  if (withPaging && filters?.page) params.set('page', String(filters.page));
  if (withPaging && filters?.limit) params.set('limit', String(filters.limit));
  return params;
}

/** Download the filtered + sorted list (all pages) as CSV. */
export async function downloadClientsCsv(filters: ClientListFilters): Promise<Blob> {
  const qs = clientListParams(filters, false).toString();
  return api.getBlob(`/api/v1/clients/export.csv${qs ? `?${qs}` : ''}`);
}

/**
 * Whether Attio import is set up on the backend (feedback S16: the Import
 * button used to show even when it could only fail). `undefined` while
 * loading or on an older backend without the endpoint — callers keep the
 * button visible then, as before.
 */
export function useAttioConfigured(): boolean | undefined {
  const { data } = useQuery({
    queryKey: ['attio', 'status'],
    queryFn: async () => unwrap(await api.get<{ configured: boolean }>('/api/v1/clients/import/attio/status')).configured,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return data;
}

export function useClients(filters?: ClientListFilters) {
  const qs = clientListParams(filters).toString();

  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedClients>(`/api/v1/clients${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await api.get<{ client: ClientDetail }>(`/api/v1/clients/${id}`);
      return unwrap(res).client;
    },
    enabled: !!id,
  });
}

export type ClientWriteInput = Omit<Partial<ClientDetail>, 'contacts'> & {
  contacts?: ClientContactInput[];
};

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ClientWriteInput) => {
      const res = await api.post<{ client: ClientDetail }>('/api/v1/clients', data);
      return unwrap(res).client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: ClientWriteInput & { id: string }) => {
      const res = await api.put<{ client: ClientDetail }>(`/api/v1/clients/${id}`, data);
      return unwrap(res).client;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', vars.id] });
    },
  });
}

// Owner-only hard delete. Removes the client and everything tied to it on
// the backend (invoices, credit checks, documents, contacts, activity, …);
// campaigns/workflows are unlinked rather than destroyed. Irreversible.
export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ deleted: boolean }>(`/api/v1/clients/${id}`);
      return unwrap(res).deleted;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.removeQueries({ queryKey: ['client', id] });
    },
  });
}

export function useCreditHistory(clientId: string) {
  return useQuery({
    queryKey: ['credit-history', clientId],
    queryFn: async () => {
      const res = await api.get<{ history: CreditCheckEntry[] }>(`/api/v1/clients/${clientId}/credit-history`);
      return unwrap(res).history;
    },
    enabled: !!clientId,
  });
}

export function useRunCreditCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const res = await api.post<{ creditCheck: CreditCheckEntry }>(`/api/v1/clients/${clientId}/credit-check`);
      return unwrap(res).creditCheck;
    },
    onSuccess: (_, clientId) => {
      qc.invalidateQueries({ queryKey: ['credit-history', clientId] });
      qc.invalidateQueries({ queryKey: ['client', clientId] });
    },
  });
}

// ─── Client documents (Sam Loom #36) ───
// Persisted in Postgres + R2. Replaces the localStorage-backed prototype.

export interface ClientDocument {
  id: string;
  clientId: string;
  r2Key: string;
  folder: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface AddDocumentInput {
  r2Key: string;
  folder?: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
}

export function useClientDocuments(clientId: string) {
  return useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async () => {
      const res = await api.get<{ documents: ClientDocument[] }>(`/api/v1/clients/${clientId}/documents`);
      return unwrap(res).documents;
    },
    enabled: !!clientId,
  });
}

export function useAddClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddDocumentInput) => {
      const res = await api.post<{ document: ClientDocument }>(`/api/v1/clients/${clientId}/documents`, input);
      return unwrap(res).document;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-documents', clientId] }),
  });
}

export function useRemoveClientDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/api/v1/clients/${clientId}/documents/${docId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-documents', clientId] }),
  });
}

// ─── Client invoices (Sam Loom #30) ───
// "I don't get why there is no invoices for this client" — the Invoices tab
// on the client detail page now lists this client's Stato-DB invoices
// instead of just linking off to the main invoices page.

export interface ClientInvoicesResponse {
  invoices: InvoiceSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function useClientInvoices(clientId: string) {
  return useQuery({
    queryKey: ['client-invoices', clientId],
    queryFn: async () => {
      const res = await api.get<ClientInvoicesResponse>(`/api/v1/clients/${clientId}/invoices`);
      return unwrap(res);
    },
    enabled: !!clientId,
  });
}

export interface SyncInvoicesResult {
  synced: number;
  skipped: number;
  totalRemote: number;
  linkedContact: boolean;
  message?: string;
}

export function useSyncClientInvoices(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<SyncInvoicesResult>(`/api/v1/clients/${clientId}/sync-invoices`);
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-invoices', clientId] });
      qc.invalidateQueries({ queryKey: ['client', clientId] });
    },
  });
}

export interface CreditAlert {
  clientId: string;
  clientName: string;
  scoreChange: number;
  currentScore: number;
}

export function useCreditAlerts() {
  return useQuery({
    queryKey: ['credit-alerts'],
    queryFn: async () => {
      const res = await api.get<{ alerts: CreditAlert[] }>('/api/v1/clients/credit-alerts');
      return unwrap(res).alerts;
    },
  });
}
