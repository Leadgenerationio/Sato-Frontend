import { useState } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 border-b last:border-b-0 ${
        !notification.read ? 'bg-primary/[0.02]' : ''
      }`}
    >
      {/* Type icon */}
      <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${config.bg}`}>
        <Icon className={`size-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${!notification.read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
            {notification.title}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimestamp(notification.createdAt)}
            </span>
            {!notification.read && (
              <span className="size-2 rounded-full bg-blue-500 flex-shrink-0" />
            )}
          </div>
        </div>
        <p className={`text-sm mt-0.5 leading-relaxed ${!notification.read ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
          {notification.message}
        </p>
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Notifications" description="Stay on top of alerts, updates, and system events">
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllAsRead.mutate()}
          disabled={markAllAsRead.isPending || unreadCount === 0}
        >
          <CheckCheck className="size-4 mr-1.5" />
          Mark all read
        </Button>
      </PageHeader>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
              filter === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold size-4">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
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
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Bell className="size-8" />
              <p className="text-sm">Failed to load notifications</p>
            </div>
          ) : !notifications.length ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Bell className="size-8" />
              <p className="text-sm">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={(id) => markAsRead.mutate(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
