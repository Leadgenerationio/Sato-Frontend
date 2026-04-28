import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  status: string;
  currency: string;
  // Money fields are sent as decimal strings on the wire; parse with toMoney().
  subtotal: string;
  vatAmount: string;
  total: string;
  dueDate: string;
  paidDate: string | null;
  daysOverdue: number;
  createdAt: string;
  xeroInvoiceId: string | null;
}

export function toMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export interface InvoiceAttachment {
  key: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  lineItems: LineItem[];
  chaseCount: number;
  lastChasedAt: string | null;
  clientEmail: string;
  vatRegistered: boolean;
  attachments: InvoiceAttachment[];
}

export interface InvoiceClient {
  id: string;
  name: string;
  email: string;
  vatRegistered: boolean;
  currency: string;
}

export interface PaginatedInvoices {
  invoices: InvoiceSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function useInvoices(filters?: { status?: string; client?: string; search?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.client) params.set('client', filters.client);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedInvoices>(`/api/v1/invoices${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await api.get<{ invoice: InvoiceDetail }>(`/api/v1/invoices/${id}`);
      return unwrap(res).invoice;
    },
    enabled: !!id,
  });
}

export function useInvoiceClients() {
  return useQuery({
    queryKey: ['invoice-clients'],
    queryFn: async () => {
      const res = await api.get<{ clients: InvoiceClient[] }>('/api/v1/invoices/clients');
      return unwrap(res).clients;
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { clientId: string; currency: string; lineItems: LineItem[]; addVat: boolean }) => {
      const res = await api.post<{ invoice: InvoiceDetail }>('/api/v1/invoices', data);
      return unwrap(res).invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function usePushInvoiceToXero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await api.post<{ invoice: InvoiceDetail }>(`/api/v1/invoices/${invoiceId}/push-to-xero`);
      return unwrap(res).invoice;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });
}

export function useAddInvoiceAttachment(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: { key: string; name: string; size: number; contentType: string }) => {
      const res = await api.post<{ invoice: InvoiceDetail }>(
        `/api/v1/invoices/${invoiceId}/attachments`,
        attachment,
      );
      return unwrap(res).invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });
}

export function useRemoveInvoiceAttachment(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const res = await api.delete<{ invoice: InvoiceDetail }>(
        `/api/v1/invoices/${invoiceId}/attachments/${encodeURIComponent(key)}`,
      );
      return unwrap(res).invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });
}
