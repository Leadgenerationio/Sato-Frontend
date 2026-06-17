import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface AutoInvoiceRun {
  id: string;
  periodFrom: string;
  periodTo: string;
  triggeredBy: 'scheduled' | 'manual' | string;
  status: 'running' | 'completed' | 'failed' | 'skipped' | string;
  // Field names mirror the DB columns but now describe the Xero reconciliation:
  //   clientsBilled   → clients reconciled against Xero
  //   invoicesCreated → new Xero invoices imported
  //   totalAmount     → always '0'; amounts live on the per-invoice rows from Xero
  clientsBilled: number;
  clientsSkipped: number;
  clientsFailed: number;
  invoicesCreated: number;
  totalAmount: string;
  currency: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface AutoInvoiceClientDetail {
  clientId: string;
  clientName: string;
  leads: number;
  amount: string;
  currency: string;
  invoiceId?: string;
  invoiceNumber?: string;
  // Xero-sync counts — the cron now pulls invoices from Xero rather than
  // fabricating them, so these describe what the reconciliation did.
  synced?: number;       // new Xero invoices imported
  updated?: number;      // existing invoices re-synced
  totalRemote?: number;  // total invoices Xero holds for the client
  status: 'synced' | 'no_deliveries' | 'no_xero_invoices' | 'failed';
  reason?: string;
}

export interface AutoInvoiceRunDetail extends AutoInvoiceRun {
  details: AutoInvoiceClientDetail[];
}

export interface NextWindow {
  fromDate: string;
  toDate: string;
  schedule: string;
}

export function useAutoInvoiceRuns(limit = 20) {
  return useQuery({
    queryKey: ['auto-invoice', 'runs', limit],
    queryFn: async () => {
      const res = await api.get<{ runs: AutoInvoiceRun[] }>(`/api/v1/finance/auto-invoice/runs?limit=${limit}`);
      return unwrap(res).runs;
    },
  });
}

export function useAutoInvoiceRun(id: string | undefined) {
  return useQuery({
    queryKey: ['auto-invoice', 'run', id],
    queryFn: async () => {
      const res = await api.get<{ run: AutoInvoiceRunDetail }>(`/api/v1/finance/auto-invoice/runs/${id}`);
      return unwrap(res).run;
    },
    enabled: !!id,
  });
}

export function useNextAutoInvoiceWindow() {
  return useQuery({
    queryKey: ['auto-invoice', 'next-window'],
    queryFn: async () => {
      const res = await api.get<NextWindow>('/api/v1/finance/auto-invoice/runs/next');
      return unwrap(res);
    },
  });
}

export function useRunAutoInvoiceNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        runId: string;
        status: string;
        clientsBilled: number;
        clientsSkipped: number;
        clientsFailed: number;
        totalAmount: string;
      }>('/api/v1/finance/auto-invoice/runs');
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-invoice'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
