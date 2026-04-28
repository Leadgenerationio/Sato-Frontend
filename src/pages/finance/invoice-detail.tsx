import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { ArrowLeft, Send, Download, Check, Loader2, FileText, Trash2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import {
  useInvoice,
  usePushInvoiceToXero,
  useAddInvoiceAttachment,
  useRemoveInvoiceAttachment,
  toMoney,
  type InvoiceDetail,
} from '@/lib/hooks/use-invoices';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type PresignedUpload } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';

const statusColors: Record<string, string> = {
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  sent: 'bg-blue-500/10 text-blue-600 border-blue-200',
  authorised: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  overdue: 'bg-red-500/10 text-red-600 border-red-200',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function handleDownloadPdf(invoice: InvoiceDetail) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const lineItemsHtml = invoice.lineItems.map((item) => `
    <tr>
      <td>${item.description}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(item.unitPrice)}</td>
      <td class="text-right">${new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(item.amount)}</td>
    </tr>
  `).join('');

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(v);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${invoice.invoiceNumber}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin-bottom: 32px; font-size: 14px; }
        .info-grid dt { color: #666; }
        .info-grid dd { font-weight: 500; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
        th { font-weight: 600; background: #f5f5f5; }
        .text-right { text-align: right; }
        .total-section { margin-top: 8px; border-top: 2px solid #111; }
        .total-section td { font-weight: 600; padding: 8px 12px; }
        .total-section .grand-total td { font-size: 16px; font-weight: 700; }
        .status { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-sent { background: #dbeafe; color: #2563eb; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        .status-authorised { background: #e0e7ff; color: #4f46e5; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>Invoice ${invoice.invoiceNumber}</h1>
      <div class="subtitle">
        ${invoice.clientName} &middot;
        <span class="status status-${invoice.status}">${invoice.status}${invoice.daysOverdue > 0 ? ` (${invoice.daysOverdue} days overdue)` : ''}</span>
      </div>

      <dl class="info-grid">
        <dt>Client</dt><dd>${invoice.clientName}</dd>
        <dt>Email</dt><dd>${invoice.clientEmail}</dd>
        <dt>Currency</dt><dd>${invoice.currency}</dd>
        <dt>VAT</dt><dd>${invoice.vatRegistered ? 'Yes (20%)' : 'No'}</dd>
        <dt>Due Date</dt><dd>${fmtDate(invoice.dueDate)}</dd>
        ${invoice.paidDate ? `<dt>Paid Date</dt><dd>${fmtDate(invoice.paidDate)}</dd>` : ''}
        <dt>Created</dt><dd>${fmtDate(invoice.createdAt)}</dd>
      </dl>

      <table>
        <thead>
          <tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Amount</th></tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>

      <table class="total-section">
        <tr><td class="text-right" colspan="3">Subtotal</td><td class="text-right">${fmt(toMoney(invoice.subtotal))}</td></tr>
        ${toMoney(invoice.vatAmount) > 0 ? `<tr><td class="text-right" colspan="3">VAT (20%)</td><td class="text-right">${fmt(toMoney(invoice.vatAmount))}</td></tr>` : ''}
        <tr class="grand-total"><td class="text-right" colspan="3">Total</td><td class="text-right">${fmt(toMoney(invoice.total))}</td></tr>
      </table>

      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id!);
  const pushToXero = usePushInvoiceToXero();

  async function handlePushToXero() {
    if (!id) return;
    try {
      await pushToXero.mutateAsync(id);
      toast.success('Invoice pushed to Xero as draft.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to push to Xero';
      toast.error(msg);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Invoice not found</p>
        <Link to="/finance/invoices"><Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back to invoices</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/finance/invoices">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1">
          <PageHeader title={invoice.invoiceNumber} description={`${invoice.clientName}`}>
            <div className="flex items-center gap-2">
              <Badge className={`capitalize ${statusColors[invoice.status] || ''}`}>
                {invoice.status}
                {invoice.daysOverdue > 0 && ` (${invoice.daysOverdue} days overdue)`}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(invoice)}>
                <Download className="size-4 mr-1.5" />
                Download PDF
              </Button>
              {invoice.xeroInvoiceId ? (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
                  <Check className="size-3 mr-1" />
                  In Xero
                </Badge>
              ) : (
                <Button size="sm" onClick={handlePushToXero} disabled={pushToXero.isPending}>
                  {pushToXero.isPending ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="size-4 mr-1.5" />
                  )}
                  Push to Xero
                </Button>
              )}
            </div>
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Invoice Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice, invoice.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.amount, invoice.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(toMoney(invoice.subtotal), invoice.currency)}</TableCell>
                  </TableRow>
                  {toMoney(invoice.vatAmount) > 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">VAT (20%)</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(toMoney(invoice.vatAmount), invoice.currency)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-base font-bold">Total</TableCell>
                    <TableCell className="text-right text-base font-bold tabular-nums">{formatCurrency(toMoney(invoice.total), invoice.currency)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{invoice.clientName}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{invoice.clientEmail}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">{invoice.currency}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span className="font-medium">{invoice.vatRegistered ? 'Yes (20%)' : 'No'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              {invoice.paidDate && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid Date</span>
                    <span className="font-medium text-emerald-600">{formatDate(invoice.paidDate)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDate(invoice.createdAt)}</span>
              </div>
              {invoice.chaseCount > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chase Count</span>
                    <span className="font-medium text-red-600">{invoice.chaseCount}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceAttachments invoice={invoice} />
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function InvoiceAttachments({ invoice }: { invoice: InvoiceDetail }) {
  const add = useAddInvoiceAttachment(invoice.id);
  const remove = useRemoveInvoiceAttachment(invoice.id);

  const handleUploaded = async (result: PresignedUpload, file: File) => {
    try {
      await add.mutateAsync({
        key: result.key,
        name: file.name,
        size: result.sizeBytes,
        contentType: result.contentType,
      });
      toast.success(`Attached ${file.name}`);
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to attach');
    }
  };

  const handleDownload = async (key: string) => {
    try {
      const url = await fetchFreshDownloadUrl('misc', key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to generate download link');
    }
  };

  const handleRemove = async (key: string) => {
    try {
      await remove.mutateAsync(key);
      toast.info('Attachment removed');
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to remove');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Attachments</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receipts, proof of payment, supporting documents. Stored in Cloudflare R2.
          </p>
        </div>
        <FileUpload folder="misc" maxSizeMB={50} label="Attach file" onUploaded={handleUploaded} />
      </CardHeader>
      <CardContent>
        {invoice.attachments.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="No attachments"
            description="Attach receipts, proof of payment, or supporting documents using the button above."
            size="compact"
          />
        ) : (
          <div className="space-y-2">
            {invoice.attachments.map((a) => (
              <div key={a.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={a.name}>{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(a.size)} · {new Date(a.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(a.key)} aria-label="Download">
                    <Download className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(a.key)} aria-label="Remove">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
