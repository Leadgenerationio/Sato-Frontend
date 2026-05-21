import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toMoney, type InvoiceSummary } from '@/lib/hooks/use-invoices';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';

type Bucket = 'all' | 'due' | 'overdue';

interface OutstandingResponse {
  bucket: Bucket;
  invoices: InvoiceSummary[];
  count: number;
  totalOutstanding: string;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function severityColor(days: number) {
  if (days > 7) return 'bg-red-500/10 text-red-600 border-red-200';
  if (days > 0) return 'bg-amber-500/10 text-amber-600 border-amber-200';
  return 'bg-blue-500/10 text-blue-600 border-blue-200';
}

const BUCKETS: { id: Bucket; label: string; viewAllPath: string }[] = [
  { id: 'all', label: 'All', viewAllPath: '/finance/invoices' },
  { id: 'due', label: 'Due', viewAllPath: '/finance/invoices?status=sent' },
  { id: 'overdue', label: 'Overdue', viewAllPath: '/finance/invoices?status=overdue' },
];

export function InvoicesOwedWidget() {
  const [bucket, setBucket] = useState<Bucket>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', 'outstanding', bucket],
    queryFn: async () => {
      const res = await api.get<OutstandingResponse>(`/api/v1/invoices/outstanding?bucket=${bucket}`);
      return res.data ?? { bucket, invoices: [], count: 0, totalOutstanding: '0' };
    },
    refetchInterval: 5 * 60_000,
  });

  const invoices = data?.invoices ?? [];
  const count = data?.count ?? 0;
  const total = toMoney(data?.totalOutstanding ?? '0');
  const top = invoices.slice(0, 4);
  const currentBucket = BUCKETS.find((b) => b.id === bucket)!;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Invoices Owed In</CardTitle>
            <CardDescription>
              {isLoading ? 'Loading…' : `${count} invoice${count !== 1 ? 's' : ''} awaiting payment`}
            </CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Wallet className="size-5 text-blue-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucket(b.id)}
              className={cn(
                'flex-1 rounded px-2 py-1 transition-colors',
                bucket === b.id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="text-center py-2">
          {isLoading ? (
            <Skeleton className="h-8 w-32 mx-auto" />
          ) : (
            <p className="text-3xl font-bold tabular-nums">{formatCurrency(total)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Total outstanding</p>
        </div>

        {!isLoading && invoices.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing outstanding"
            description={bucket === 'overdue' ? 'No overdue invoices — all caught up.' : 'No invoices are awaiting payment.'}
            size="compact"
          />
        )}

        {!isLoading && invoices.length > 0 && (
          <div className="space-y-2">
            {top.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{inv.invoiceNumber || 'No number'}</p>
                  <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge className={`text-xs ${severityColor(inv.daysOverdue)}`}>
                    {inv.daysOverdue > 0 ? `${inv.daysOverdue}d late` : inv.status === 'sent' ? 'Due' : inv.status}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(toMoney(inv.total), inv.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link to={currentBucket.viewAllPath}>
          <Button variant="outline" size="sm" className="w-full mt-2">
            <ExternalLink className="size-4 mr-1.5" />
            View all {currentBucket.label.toLowerCase()}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
