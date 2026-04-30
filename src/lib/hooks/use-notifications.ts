import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export type NotificationType =
  | 'invoice_overdue'
  | 'credit_alert'
  | 'workflow_complete'
  | 'payment_received'
  | 'onboarding_update'
  | 'lead_delivery'
  | 'vat_shortfall'
  | 'agreement_signed'
  | 'system_error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export function useNotifications(filters?: { filter?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.filter && filters.filter !== 'all') params.set('filter', filters.filter);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const res = await api.get<NotificationListResponse>(`/api/v1/notifications${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put<{ notification: Notification }>(`/api/v1/notifications/${id}/read`);
      return unwrap(res).notification;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.put<{ updated: number }>('/api/v1/notifications/read-all');
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
