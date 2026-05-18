import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { InvoiceSummary } from './use-invoices';

export interface ClientSummary {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  currency: string;
  creditScore: number | null;
  activeCampaigns: number;
  totalRevenue: number;
  createdAt: string;
  // Reality-check fields so the clients list applies the same badge logic
  // as the detail page (status='active' only displays as "Active Client"
  // when docs + signed agreement are both present).
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

export interface ClientDetail extends ClientSummary {
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

export function useClients(filters?: { status?: string; search?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

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
