import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ExternalLink, AlertCircle } from 'lucide-react';
import { useAutoInvoiceRun, type AutoInvoiceClientDetail } from '@/lib/hooks/use-auto-invoice';

function formatMoney(value: string | number, currency = 'GBP') {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number.isFinite(n) ? n : 0);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function clientStatusColour(status: AutoInvoiceClientDetail['status']): string {
  switch (status) {
    case 'invoiced': return 'bg-positive/10 text-positive border-positive/30';
    case 'failed': return 'bg-negative/10 text-negative border-negative/30';
    case 'no_lead_price': return 'bg-warning/10 text-warning border-warning/30';
    case 'no_deliveries': return 'bg-neutral-500/10 text-neutral-500 border-neutral-200';
    default: return '';
  }
}

export function AutoInvoiceRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useAutoInvoiceRun(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Run not found</p>
        <Link to="/finance/auto-invoice">
          <Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back to auto-invoice</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/finance/auto-invoice"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader
          title={`Auto-invoice run — ${formatDate(run.periodFrom)} → ${formatDate(run.periodTo)}`}
          description={`${run.triggeredBy} · started ${new Date(run.startedAt).toLocaleString('en-GB')}`}
        />
      </div>

      {run.error && (
        <Card className="border-negative/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-negative">
              <AlertCircle className="size-4" /> Run error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-negative">{run.error}</pre>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Invoiced</p><p className="text-2xl font-semibold tabular-nums">{run.invoicesCreated}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Skipped</p><p className="text-2xl font-semibold tabular-nums">{run.clientsSkipped}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Failed</p><p className="text-2xl font-semibold tabular-nums">{run.clientsFailed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="text-2xl font-semibold tabular-nums">{formatMoney(run.totalAmount, run.currency)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-client breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {run.details.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No clients had deliveries in this window.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.details.map((d) => (
                  <TableRow key={d.clientId}>
                    <TableCell className="font-medium">{d.clientName}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.amount, d.currency)}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${clientStatusColour(d.status)}`}>
                        {d.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.reason ?? ''}</TableCell>
                    <TableCell>
                      {d.invoiceId && (
                        <Link to={`/finance/invoices/${d.invoiceId}`}>
                          <Button variant="ghost" size="icon" className="size-8" title={`View ${d.invoiceNumber}`}>
                            <ExternalLink className="size-4" />
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
