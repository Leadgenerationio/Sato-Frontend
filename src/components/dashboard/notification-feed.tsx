import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, Users, Megaphone, Shield, CreditCard, Bell, CheckCircle2, AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useNotifications, useMarkAsRead, type NotificationType } from '@/lib/hooks/use-notifications';
import { EmptyState } from '@/components/shared/empty-state';

const typeIcons: Record<NotificationType, React.ElementType> = {
  invoice_overdue: FileText,
  credit_alert: Shield,
  workflow_complete: CheckCircle2,
  payment_received: CreditCard,
  onboarding_update: Users,
  lead_delivery: Megaphone,
  vat_shortfall: AlertTriangle,
  agreement_signed: CheckCircle2,
  system_error: Bell,
};

const typeColors: Record<NotificationType, string> = {
  invoice_overdue: 'bg-negative/10 text-negative',
  credit_alert: 'bg-negative/10 text-negative',
  workflow_complete: 'bg-warning/10 text-warning',
  payment_received: 'bg-positive/10 text-positive',
  onboarding_update: 'bg-info/10 text-info',
  lead_delivery: 'bg-positive/10 text-positive',
  vat_shortfall: 'bg-negative/10 text-negative',
  agreement_signed: 'bg-positive/10 text-positive',
  system_error: 'bg-neutral-500/10 text-neutral-500',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

export function NotificationFeed() {
  const { data, isLoading } = useNotifications({ limit: 7 });
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();

  const all = data?.notifications ?? [];
  const unread = all.filter((n) => !n.read).length;

  function handleRowClick(n: { id: string; read: boolean; actionUrl?: string | null }) {
    if (!n.read) markAsRead.mutate(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>{isLoading ? 'Loading…' : `${unread} unread`}</CardDescription>
          </div>
          {unread > 0 && (
            <Badge className="bg-negative text-white text-xs">{unread}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading && (
          <div className="space-y-2 py-1">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        )}
        {!isLoading && all.length === 0 && (
          <EmptyState
            icon={Bell}
            title="All caught up"
            description="New alerts about overdue invoices, credit drops, and payments will appear here."
            size="compact"
          />
        )}
        {!isLoading && all.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          const clickable = !n.read || !!n.actionUrl;
          return (
            <div
              key={n.id}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => handleRowClick(n) : undefined}
              onKeyDown={clickable ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(n);
                }
              } : undefined}
              className={`flex items-start gap-3 rounded-lg p-2 ${!n.read ? 'bg-muted/50' : ''} ${clickable ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
            >
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${typeColors[n.type] || ''}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>
                  {n.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(n.createdAt)}</p>
              </div>
              {n.actionUrl && <ExternalLink className="size-3 text-muted-foreground mt-1 shrink-0" />}
              {!n.read && <div className="size-2 rounded-full bg-info mt-2 shrink-0" />}
            </div>
          );
        })}
        {!isLoading && all.length > 0 && (
          <Link to="/notifications" className="block text-center text-xs text-primary hover:underline pt-2">
            View all →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
