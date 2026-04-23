import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
}

export interface ClientDetail extends ClientSummary {
  companyNumber: string;
  contactPhone: string;
  address: string;
  paymentTermsDays: number;
  vatRegistered: boolean;
  addVatToInvoices: boolean;
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
      return res.data!;
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await api.get<{ client: ClientDetail }>(`/api/v1/clients/${id}`);
      return res.data!.client;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ClientDetail>) => {
      const res = await api.post<{ client: ClientDetail }>('/api/v1/clients', data);
      return res.data!.client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ClientDetail> & { id: string }) => {
      const res = await api.put<{ client: ClientDetail }>(`/api/v1/clients/${id}`, data);
      return res.data!.client;
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
      return res.data!.history;
    },
    enabled: !!clientId,
  });
}

export function useRunCreditCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const res = await api.post<{ creditCheck: CreditCheckEntry }>(`/api/v1/clients/${clientId}/credit-check`);
      return res.data!.creditCheck;
    },
    onSuccess: (_, clientId) => {
      qc.invalidateQueries({ queryKey: ['credit-history', clientId] });
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
      return res.data!.alerts;
    },
  });
}
