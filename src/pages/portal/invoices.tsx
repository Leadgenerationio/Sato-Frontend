import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText } from 'lucide-react';
import { usePortalInvoices, type PortalInvoice } from '@/lib/hooks/use-portal';
import { toMoney } from '@/lib/hooks/use-invoices';
import { EmptyState } from '@/components/shared/empty-state';

const statusColors: Record<string, string> = {
  draft: 'bg-neutral-500/10 text-neutral-500',
  sent: 'bg-blue-500/10 text-blue-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  overdue: 'bg-red-500/10 text-red-600',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function handleDownloadInvoice(inv: PortalInvoice) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${inv.invoiceNumber}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #111; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
        th { font-weight: 600; background: #f5f5f5; }
        .text-right { text-align: right; }
        .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #111; }
        .status { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-sent { background: #dbeafe; color: #2563eb; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>Invoice ${inv.invoiceNumber}</h1>
      <div class="meta">
        <span class="status status-${inv.status}">${inv.status}${inv.daysOverdue > 0 ? ` (${inv.daysOverdue} days overdue)` : ''}</span>
      </div>
      <table>
        <tr><th>Detail</th><th class="text-right">Value</th></tr>
        <tr><td>Currency</td><td class="text-right">${inv.currency}</td></tr>
        <tr><td>Due Date</td><td class="text-right">${new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td></tr>
        ${inv.paidDate ? `<tr><td>Paid Date</td><td class="text-right">${new Date(inv.paidDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td></tr>` : ''}
      </table>
      <table>
        <tr class="total-row"><td>Total</td><td class="text-right">${new Intl.NumberFormat('en-GB', { style: 'currency', currency: inv.currency }).format(toMoney(inv.total))}</td></tr>
      </table>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export function PortalInvoicesPage() {
  const { data: invoices, isLoading } = usePortalInvoices();

  const totalOutstanding = invoices?.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + toMoney(i.total), 0) ?? 0;
  const totalPaid = invoices?.filter((i) => i.status === 'paid').reduce((sum, i) => sum + toMoney(i.total), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">Your invoices and payment status</p>
      </div>

      {!isLoading && invoices && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="gap-3 py-5"><CardContent className="text-center"><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p><p className="text-sm text-muted-foreground">Total Paid</p></CardContent></Card>
          <Card className="gap-3 py-5"><CardContent className="text-center"><p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-600' : ''}`}>{formatCurrency(totalOutstanding)}</p><p className="text-sm text-muted-foreground">Outstanding</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !invoices?.length ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="When an invoice is issued, it will appear here for download."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices?.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${statusColors[inv.status] || ''}`}>
                          {inv.status}{inv.daysOverdue > 0 ? ` (${inv.daysOverdue}d)` : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(toMoney(inv.total), inv.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.paidDate ? formatDate(inv.paidDate) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => handleDownloadInvoice(inv)}
                        >
                          <Download className="size-3.5 mr-1" />
                          Download
                        </Button>
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
