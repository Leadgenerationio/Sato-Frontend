import { useParams, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
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
import { api } from '@/lib/api';

import { logError } from '../../lib/log';

// Map invoice status → Statto pill colour suffix.
const statusPill: Record<string, string> = {
  draft: 'gray',
  sent: 'warn',
  authorised: 'infosoft',
  paid: 'pos',
  overdue: 'neg',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Download the real Xero-rendered invoice PDF (not a print dialog). The backend
// streams the branded document straight from Xero; we save it as a .pdf file.
async function handleDownloadPdf(invoice: InvoiceDetail) {
  try {
    const blob = await api.getBlob(`/api/v1/invoices/${invoice.id}/pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    logError('Invoice PDF download failed', err);
    toast.error(err instanceof Error ? err.message : 'Could not download the invoice.');
  }
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
      <div className="screen-page">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <h3>Invoice not found</h3>
          <Link to="/finance/invoices">
            <button className="btn b-ghost b-sm"><ArrowLeft className="size-4" /> Back to invoices</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-page nc-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/finance/invoices" className="nc-back" title="Back to invoices">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="ahead-title">{invoice.invoiceNumber}</h1>
            <p className="ahead-sub">{invoice.clientName}</p>
          </div>
        </div>
        <div className="page-actions">
          <span className={'pill p-' + (statusPill[invoice.status] ?? 'gray')} style={{ textTransform: 'capitalize' }}>
            {invoice.status}
            {invoice.daysOverdue > 0 && ` (${invoice.daysOverdue} days overdue)`}
          </span>
          <button className="btn b-ghost b-sm" onClick={() => handleDownloadPdf(invoice)}>
            <Download className="size-[15px]" /> Download PDF
          </button>
          {invoice.xeroInvoiceId ? (
            <span className="pill p-xero"><Check className="size-3" /> In Xero</span>
          ) : (
            <button className="btn b-dark b-sm" onClick={handlePushToXero} disabled={pushToXero.isPending}>
              {pushToXero.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Send className="size-[15px]" />}
              Push to Xero
            </button>
          )}
        </div>
      </div>

      <div className="ci-layout">
        {/* Line Items */}
        <div className="card acard inv-card">
          <div className="ai-runs-head"><h3 className="statto-title">Line Items</h3></div>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="r">Qty</th>
                <th className="r">Unit Price</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, i) => (
                <tr key={i}>
                  <td className="inv-client">{item.description}</td>
                  <td className="r mono">{item.quantity}</td>
                  <td className="r mono inv-num">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                  <td className="r mono inv-total">{formatCurrency(item.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '16px 16px 8px' }}>
            <div className="ci-total-row"><span>Subtotal</span><span className="mono">{formatCurrency(toMoney(invoice.subtotal), invoice.currency)}</span></div>
            {toMoney(invoice.vatAmount) > 0 && (
              <div className="ci-total-row"><span>VAT (20%)</span><span className="mono">{formatCurrency(toMoney(invoice.vatAmount), invoice.currency)}</span></div>
            )}
            <div className="ci-total-row grand"><span>Total</span><span className="mono">{formatCurrency(toMoney(invoice.total), invoice.currency)}</span></div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="ci-side">
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Details</h3>
            <DetailRow label="Client" value={invoice.clientName} />
            <DetailRow label="Email" value={invoice.clientEmail} />
            <DetailRow label="Currency" value={invoice.currency} />
            <DetailRow label="VAT" value={invoice.vatRegistered ? 'Yes (20%)' : 'No'} />
            <DetailRow label="Due Date" value={formatDate(invoice.dueDate)} />
            {invoice.paidDate && <DetailRow label="Paid Date" value={formatDate(invoice.paidDate)} valueClass="pos" />}
            <DetailRow label="Created" value={formatDate(invoice.createdAt)} last={invoice.chaseCount === 0} />
            {invoice.chaseCount > 0 && <DetailRow label="Chase Count" value={String(invoice.chaseCount)} valueClass="neg" last />}
          </div>
        </div>
      </div>

      <InvoiceAttachments invoice={invoice} />
    </div>
  );
}

function DetailRow({ label, value, valueClass, last }: { label: string; value: string; valueClass?: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 0',
        borderBottom: last ? 'none' : '1px solid var(--gray-100)',
        fontSize: 13.5,
      }}
    >
      <span className="inv-date">{label}</span>
      <span className={valueClass ?? 'inv-id'} style={{ fontWeight: 600 }}>{value}</span>
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
      logError('Operation failed', err);
      toast.error('Failed to attach');
    }
  };

  const handleDownload = async (key: string) => {
    try {
      const url = await fetchFreshDownloadUrl('misc', key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to generate download link');
    }
  };

  const handleRemove = async (key: string) => {
    try {
      await remove.mutateAsync(key);
      toast.info('Attachment removed');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to remove');
    }
  };

  return (
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title">Attachments</h3>
          <p className="ac-sub">Receipts, proof of payment, supporting documents. Stored in Cloudflare R2.</p>
        </div>
        <FileUpload folder="misc" maxSizeMB={50} label="Attach file" onUploaded={handleUploaded} />
      </div>
      {invoice.attachments.length === 0 ? (
        <div className="inv-empty">
          <Paperclip className="size-5" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
          No attachments — attach receipts, proof of payment, or supporting documents using the button above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {invoice.attachments.map((a) => (
            <div
              key={a.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                <span style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--gray-50)', color: 'var(--statto-ink)' }}>
                  <FileText className="size-4" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="inv-id" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>{a.name}</p>
                  <p className="bf-desc">{formatBytes(a.size)} · {new Date(a.uploadedAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
                <button className="inv-open" onClick={() => handleDownload(a.key)} aria-label="Download">
                  <Download className="size-4" />
                </button>
                <button className="inv-open" onClick={() => handleRemove(a.key)} aria-label="Remove">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
