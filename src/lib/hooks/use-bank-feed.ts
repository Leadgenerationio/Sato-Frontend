import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface BankTransaction {
  id: string;
  xeroBankTransactionId: string;
  xeroAccountId: string | null;
  date: string;
  amount: string;
  currency: string;
  description: string | null;
  vendorName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryBucket: 'fixed' | 'one_off' | null;
  isAutoCategorized: boolean;
}

export interface CostCategory {
  id: string;
  name: string;
  bucket: 'fixed' | 'one_off';
  color: string | null;
}

export interface VendorRule {
  id: string;
  vendorPattern: string;
  matchType: 'exact' | 'contains';
  categoryId: string;
  categoryName: string;
}

export interface PaginatedTransactions {
  transactions: BankTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BankSyncResult {
  fetched: number;
  inserted: number;
  autoCategorized: number;
  fromDate: string;
  toDate: string;
}

export function useBankTransactions(filters?: {
  uncategorized?: boolean;
  categoryId?: string;
  bucket?: 'fixed' | 'one_off';
  search?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.uncategorized) params.set('uncategorized', 'true');
  if (filters?.categoryId) params.set('categoryId', filters.categoryId);
  if (filters?.bucket) params.set('bucket', filters.bucket);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return useQuery({
    queryKey: ['bank-feed', 'transactions', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedTransactions>(`/api/v1/finance/bank-feed/transactions${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useCostCategories() {
  return useQuery({
    queryKey: ['bank-feed', 'categories'],
    queryFn: async () => {
      const res = await api.get<{ categories: CostCategory[] }>('/api/v1/finance/bank-feed/categories');
      return unwrap(res).categories;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; bucket: 'fixed' | 'one_off'; color?: string }) => {
      const res = await api.post<{ category: CostCategory }>('/api/v1/finance/bank-feed/categories', data);
      return unwrap(res).category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed', 'categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ ok: boolean }>(`/api/v1/finance/bank-feed/categories/${id}`);
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-feed'] });
    },
  });
}

export function useCategorizeTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      transactionId: string;
      categoryId: string | null;
      learnRule?: boolean;
      applyRetroactively?: boolean;
    }) => {
      const res = await api.patch<{ ok: boolean }>(
        `/api/v1/finance/bank-feed/transactions/${data.transactionId}/category`,
        {
          categoryId: data.categoryId,
          learnRule: data.learnRule,
          applyRetroactively: data.applyRetroactively,
        },
      );
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-feed'] });
    },
  });
}

export function useSyncBankFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data?: { fromDate?: string; toDate?: string }) => {
      const res = await api.post<BankSyncResult>('/api/v1/finance/bank-feed/sync', data ?? {});
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-feed'] });
    },
  });
}

export function useVendorRules() {
  return useQuery({
    queryKey: ['bank-feed', 'rules'],
    queryFn: async () => {
      const res = await api.get<{ rules: VendorRule[] }>('/api/v1/finance/bank-feed/rules');
      return unwrap(res).rules;
    },
  });
}

export function useDeleteVendorRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ ok: boolean }>(`/api/v1/finance/bank-feed/rules/${id}`);
      return unwrap(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export function toMoney(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
