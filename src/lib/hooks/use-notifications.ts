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
  severity?: 'info' | 'warning' | 'error' | null;
  actionUrl?: string | null;
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
    // Optimistic update — flip the row's `read` flag locally before the
    // server round-trip so the bell-badge and list update instantly. If the
    // mutation fails (e.g. user lost auth), onError rolls every list page
    // back to its prior snapshot.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const snapshots = qc.getQueriesData<NotificationListResponse>({ queryKey: ['notifications'] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<NotificationListResponse>(key, {
          ...data,
          notifications: data.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        });
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.snapshots) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => {
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
    // Same optimistic pattern as markAsRead, but flip every notification.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const snapshots = qc.getQueriesData<NotificationListResponse>({ queryKey: ['notifications'] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<NotificationListResponse>(key, {
          ...data,
          notifications: data.notifications.map((n) => ({ ...n, read: true })),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.snapshots) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
