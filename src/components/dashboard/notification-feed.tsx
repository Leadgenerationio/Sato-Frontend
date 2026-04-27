import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, Users, Megaphone, Shield, CreditCard, Bell, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useNotifications, type NotificationType } from '@/lib/hooks/use-notifications';

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
  invoice_overdue: 'bg-red-500/10 text-red-600',
  credit_alert: 'bg-red-500/10 text-red-600',
  workflow_complete: 'bg-amber-500/10 text-amber-600',
  payment_received: 'bg-emerald-500/10 text-emerald-600',
  onboarding_update: 'bg-indigo-500/10 text-indigo-600',
  lead_delivery: 'bg-emerald-500/10 text-emerald-600',
  vat_shortfall: 'bg-red-500/10 text-red-600',
  agreement_signed: 'bg-emerald-500/10 text-emerald-600',
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

  const all = data?.notifications ?? [];
  const unread = all.filter((n) => !n.read).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>{isLoading ? 'Loading…' : `${unread} unread`}</CardDescription>
          </div>
          {unread > 0 && (
            <Badge className="bg-red-500 text-white text-xs">{unread}</Badge>
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
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        )}
        {!isLoading && all.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id} className={`flex items-start gap-3 rounded-lg p-2 ${!n.read ? 'bg-muted/50' : ''}`}>
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${typeColors[n.type] || ''}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>
                  {n.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(n.createdAt)}</p>
              </div>
              {!n.read && <div className="size-2 rounded-full bg-blue-500 mt-2 shrink-0" />}
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
