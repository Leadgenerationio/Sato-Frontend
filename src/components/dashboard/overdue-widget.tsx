import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import type { InvoiceSummary } from '@/lib/hooks/use-invoices';

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function severityColor(days: number) {
  if (days > 7) return 'bg-red-500/10 text-red-600 border-red-200';
  return 'bg-amber-500/10 text-amber-600 border-amber-200';
}

export function OverdueWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', 'overdue'],
    queryFn: async () => {
      const res = await api.get<{ invoices: InvoiceSummary[] }>('/api/v1/invoices/overdue');
      return res.data?.invoices ?? [];
    },
    refetchInterval: 5 * 60_000, // refresh every 5 min
  });

  const overdue = data ?? [];
  const totalOverdue = overdue.reduce((sum, inv) => sum + inv.total, 0);
  const top = overdue.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Overdue Invoices</CardTitle>
            <CardDescription>
              {isLoading ? 'Loading…' : `${overdue.length} invoice${overdue.length !== 1 ? 's' : ''} overdue`}
            </CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
            <AlertTriangle className="size-5 text-red-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center py-2">
          {isLoading ? (
            <Skeleton className="h-8 w-32 mx-auto" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-red-600">{formatCurrency(totalOverdue)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Total outstanding</p>
        </div>

        {!isLoading && overdue.length === 0 && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            No overdue invoices.
          </div>
        )}

        {!isLoading && overdue.length > 0 && (
          <div className="space-y-2">
            {top.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{inv.invoiceNumber || 'No number'}</p>
                  <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge className={`text-xs ${severityColor(inv.daysOverdue)}`}>
                    {inv.daysOverdue}d
                  </Badge>
                  <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(inv.total, inv.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link to="/finance/invoices?status=overdue">
          <Button variant="outline" size="sm" className="w-full mt-2">
            <ExternalLink className="size-4 mr-1.5" />
            View All Overdue
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
