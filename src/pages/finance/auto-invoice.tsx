import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Calendar, ExternalLink, Loader2, PlayCircle, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAutoInvoiceRuns,
  useNextAutoInvoiceWindow,
  useRunAutoInvoiceNow,
  type AutoInvoiceRun,
} from '@/lib/hooks/use-auto-invoice';
import { EmptyState } from '@/components/shared/empty-state';

function formatMoney(value: string | number, currency = 'GBP') {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number.isFinite(n) ? n : 0);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: AutoInvoiceRun['status'] }) {
  if (status === 'completed') {
    return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle2 className="size-3 mr-1" />Completed</Badge>;
  }
  if (status === 'failed') {
    return <Badge className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="size-3 mr-1" />Failed</Badge>;
  }
  if (status === 'skipped') {
    return <Badge className="bg-neutral-500/10 text-neutral-500 border-neutral-200"><SkipForward className="size-3 mr-1" />Skipped</Badge>;
  }
  if (status === 'running') {
    return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200"><Loader2 className="size-3 mr-1 animate-spin" />Running</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export function AutoInvoicePage() {
  const { data: runs, isLoading } = useAutoInvoiceRuns(20);
  const { data: nextWindow } = useNextAutoInvoiceWindow();
  const runNow = useRunAutoInvoiceNow();

  async function handleRunNow() {
    try {
      const result = await runNow.mutateAsync();
      if (result.status === 'skipped') {
        toast.info("This week's invoices were already generated. No duplicate run created.");
      } else if (result.status === 'completed') {
        toast.success(`Generated ${result.clientsBilled} invoice${result.clientsBilled === 1 ? '' : 's'} totalling ${formatMoney(result.totalAmount)}`);
      } else {
        toast.error('Auto-invoice run finished with errors. Check the run detail below.');
      }
    } catch (err) {
      console.error('Auto-invoice manual run failed', err);
      toast.error(err instanceof Error ? err.message : 'Run failed');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auto-invoice"
        description="Weekly cron — bills each client for the previous Mon-Sun's lead deliveries"
      >
        <Button size="sm" onClick={handleRunNow} disabled={runNow.isPending}>
          {runNow.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <PlayCircle className="size-4 mr-1.5" />}
          Run now
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="size-4" /> Next run
              </CardTitle>
              <CardDescription>
                {nextWindow?.schedule ?? 'Mondays 09:00 UTC'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {nextWindow ? (
            <p className="text-sm">
              Will bill the week <strong>{formatDate(nextWindow.fromDate)}</strong> through <strong>{formatDate(nextWindow.toDate)}</strong>.
              Each client with deliveries in that window receives one invoice priced from their per-campaign lead rate.
            </p>
          ) : (
            <Skeleton className="h-5 w-72" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
          <CardDescription>The 20 most recent auto-invoice runs (scheduled + manual)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-2 p-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!isLoading && runs && runs.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No runs yet"
              description="The first auto-invoice run fires Monday 09:00 UTC, or you can trigger one now from the Run-now button."
            />
          )}

          {!isLoading && runs && runs.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium tabular-nums">
                        {formatDate(r.periodFrom)} → {formatDate(r.periodTo)}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        <Badge variant={r.triggeredBy === 'manual' ? 'outline' : 'secondary'}>
                          {r.triggeredBy}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.invoicesCreated}
                        {(r.clientsFailed > 0 || r.clientsSkipped > 0) && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (+{r.clientsSkipped}↷ {r.clientsFailed}✗)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(r.totalAmount, r.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(r.startedAt)}
                      </TableCell>
                      <TableCell>
                        <Link to={`/finance/auto-invoice/${r.id}`}>
                          <Button variant="ghost" size="icon" className="size-8">
                            <ExternalLink className="size-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
