import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Users, Megaphone, Shield, CreditCard, Bell, CheckCircle2,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'invoice' | 'client' | 'campaign' | 'credit' | 'payment' | 'system' | 'workflow';
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n-1', type: 'invoice', message: 'Invoice INV-1050 created for Apex Media Ltd', time: '5 min ago', read: false },
  { id: 'n-2', type: 'payment', message: 'Payment received: £3,200.00 from Clearwater Digital', time: '25 min ago', read: false },
  { id: 'n-3', type: 'credit', message: 'Credit alert: Delta Solutions score dropped to 42', time: '1 hour ago', read: false },
  { id: 'n-4', type: 'campaign', message: 'Campaign "Solar Panel Leads UK" delivered 35 leads today', time: '2 hours ago', read: true },
  { id: 'n-5', type: 'workflow', message: 'Weekly Auto-Invoice completed — 3 invoices created', time: '3 hours ago', read: true },
  { id: 'n-6', type: 'client', message: 'New client "GreenTech Solar" started onboarding', time: '5 hours ago', read: true },
  { id: 'n-7', type: 'system', message: 'LeadByte sync completed — 8 campaigns updated', time: '6 hours ago', read: true },
];

const typeIcons: Record<string, React.ElementType> = {
  invoice: FileText,
  client: Users,
  campaign: Megaphone,
  credit: Shield,
  payment: CreditCard,
  system: Bell,
  workflow: CheckCircle2,
};

const typeColors: Record<string, string> = {
  invoice: 'bg-blue-500/10 text-blue-600',
  client: 'bg-indigo-500/10 text-indigo-600',
  campaign: 'bg-emerald-500/10 text-emerald-600',
  credit: 'bg-red-500/10 text-red-600',
  payment: 'bg-emerald-500/10 text-emerald-600',
  system: 'bg-neutral-500/10 text-neutral-500',
  workflow: 'bg-amber-500/10 text-amber-600',
};

export function NotificationFeed() {
  const unread = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>{unread} unread</CardDescription>
          </div>
          {unread > 0 && (
            <Badge className="bg-red-500 text-white text-xs">{unread}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {MOCK_NOTIFICATIONS.map((n) => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id} className={`flex items-start gap-3 rounded-lg p-2 ${!n.read ? 'bg-muted/50' : ''}`}>
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${typeColors[n.type] || ''}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>{n.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
              </div>
              {!n.read && <div className="size-2 rounded-full bg-blue-500 mt-2 shrink-0" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
