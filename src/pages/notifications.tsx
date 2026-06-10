import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  CheckCheck,
  FileWarning,
  ShieldAlert,
  CheckCircle2,
  CreditCard,
  UserPlus,
  Send,
  AlertTriangle,
  ServerCrash,
  FileSignature,
} from 'lucide-react';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  type Notification,
  type NotificationType,
} from '@/lib/hooks/use-notifications';

const FILTER_TABS = ['all', 'unread'] as const;

const defaultTypeConfig = { icon: Bell, color: 'text-neutral-600', bg: 'bg-neutral-500/10' };

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  invoice_overdue: { icon: FileWarning, color: 'text-red-600', bg: 'bg-red-500/10' },
  credit_alert: { icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  workflow_complete: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  payment_received: { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-500/10' },
  onboarding_update: { icon: UserPlus, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
  lead_delivery: { icon: Send, color: 'text-violet-600', bg: 'bg-violet-500/10' },
  vat_shortfall: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-500/10' },
  agreement_signed: { icon: FileSignature, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  system_error: { icon: ServerCrash, color: 'text-neutral-600', bg: 'bg-neutral-500/10' },
};

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const config = typeConfig[notification.type] ?? defaultTypeConfig;
  const Icon = config.icon;

  return (
    <button
      onClick={() => !notification.read && onMarkRead(notification.id)}
      className="notif-row"
      style={{ width: '100%', textAlign: 'left', cursor: notification.read ? 'default' : 'pointer' }}
    >
      {/* Type icon */}
      <span className="act-ic" style={{ marginTop: 0 }}>
        <Icon className={`size-4 ${config.color}`} />
      </span>

      {/* Content */}
      <div className="notif-meta">
        <div className="flex items-start justify-between gap-2">
          <span className="notif-title" style={{ fontWeight: notification.read ? 500 : 600 }}>
            {notification.title}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="act-time">{formatTimestamp(notification.createdAt)}</span>
            {!notification.read && <span className="notif-dot" style={{ marginTop: 5 }} />}
          </div>
        </div>
        <span className="notif-msg">{notification.message}</span>
      </div>
    </button>
  );
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<string>('all');
  const { data, isLoading, error } = useNotifications({ filter, limit: 50 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Notifications</h1>
          <p className="ahead-sub">Stay on top of alerts, updates, and system events</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn b-ghost b-sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending || unreadCount === 0}
          >
            <CheckCheck className="size-[15px]" />
            Mark all read
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="seg notif-seg">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={'seg-btn' + (filter === tab ? ' on' : '')}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="inv-tab-n" style={{ marginLeft: 6 }}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="card pad acard">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="notif-empty">
            <span className="notif-bell"><Bell className="size-6" /></span>
            <strong>Failed to load notifications</strong>
          </div>
        ) : !notifications.length ? (
          <div className="notif-empty">
            <span className="notif-bell"><Bell className="size-6" /></span>
            <strong>{filter === 'unread' ? 'No unread notifications' : 'All caught up'}</strong>
            <p>
              {filter === 'unread'
                ? 'You have read everything in your queue.'
                : 'New alerts about overdue invoices, credit drops, and payments will appear here.'}
            </p>
          </div>
        ) : (
          <div className="notif-list">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={(id) => markAsRead.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
