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

import { logError } from '../../lib/log';

// Map invoice status → Statto pill colour suffix.
const statusPill: Record<string, string> = {
  draft: 'gray',
  sent: 'warn',
  authorised: 'infosoft',
  paid: 'pos',
  overdue: 'neg',
};

// Escape any user-provided string before interpolating into the print-window HTML.
// Without this, a malicious clientName / lineItem.description could inject script.
const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function handleDownloadPdf(invoice: InvoiceDetail) {
  const lineItemsHtml = invoice.lineItems.map((item) => `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td class="text-right">${escapeHtml(item.quantity)}</td>
      <td class="text-right">${escapeHtml(new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(item.unitPrice))}</td>
      <td class="text-right">${escapeHtml(new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(item.amount))}</td>
    </tr>
  `).join('');

  const fmt = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency }).format(v);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(invoice.invoiceNumber)}</title>
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
    <body id="invoice-print-root">
      <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
      <div class="subtitle">
        ${escapeHtml(invoice.clientName)} &middot;
        <span class="status status-${escapeHtml(invoice.status)}">${escapeHtml(invoice.status)}${invoice.daysOverdue > 0 ? ` (${escapeHtml(invoice.daysOverdue)} days overdue)` : ''}</span>
      </div>

      <dl class="info-grid">
        <dt>Client</dt><dd>${escapeHtml(invoice.clientName)}</dd>
        <dt>Email</dt><dd>${escapeHtml(invoice.clientEmail)}</dd>
        <dt>Currency</dt><dd>${escapeHtml(invoice.currency)}</dd>
        <dt>VAT</dt><dd>${invoice.vatRegistered ? 'Yes (20%)' : 'No'}</dd>
        <dt>Due Date</dt><dd>${escapeHtml(fmtDate(invoice.dueDate))}</dd>
        ${invoice.paidDate ? `<dt>Paid Date</dt><dd>${escapeHtml(fmtDate(invoice.paidDate))}</dd>` : ''}
        <dt>Created</dt><dd>${escapeHtml(fmtDate(invoice.createdAt))}</dd>
      </dl>

      <table>
        <thead>
          <tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Amount</th></tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>

      <table class="total-section">
        <tr><td class="text-right" colspan="3">Subtotal</td><td class="text-right">${escapeHtml(fmt(toMoney(invoice.subtotal)))}</td></tr>
        ${toMoney(invoice.vatAmount) > 0 ? `<tr><td class="text-right" colspan="3">VAT (20%)</td><td class="text-right">${escapeHtml(fmt(toMoney(invoice.vatAmount)))}</td></tr>` : ''}
        <tr class="grand-total"><td class="text-right" colspan="3">Total</td><td class="text-right">${escapeHtml(fmt(toMoney(invoice.total)))}</td></tr>
      </table>
    </body>
    </html>
  `;

  // Render into a hidden same-origin iframe and print from it. This avoids
  // popup blockers (which silently killed the old window.open approach) and
  // reliably opens the browser's print / "Save as PDF" dialog.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // Off-screen but with real A4-ish dimensions. A 0×0 / display:none iframe
  // never gets a layout box and prints blank in several browsers.
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';

  let printed = false;
  let cleaned = false;
  function onFocus() { cleanup(); }
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener('focus', onFocus);
    iframe.remove();
  }

  iframe.onload = () => {
    const win = iframe.contentWindow;
    const doc = win?.document;
    // Guard against the iframe's initial about:blank load (which fires on
    // insertion before srcdoc applies in some browsers): only print once the
    // real invoice document is in place, and only once.
    if (printed || !win || !doc || !doc.getElementById('invoice-print-root')) return;
    printed = true;
    try {
      // Clean up only AFTER the print dialog is dismissed — print() isn't
      // reliably blocking, so a fixed short timer can tear the document out
      // mid-print and produce a blank PDF. afterprint covers most browsers;
      // the window 'focus' handler covers the rest (focus returns to the page
      // when the dialog closes); a long timeout is just a leak-safety net.
      // We intentionally do NOT call win.focus() — focusing a hidden iframe can
      // bounce focus straight back to the page and tear it out mid-print.
      win.onafterprint = cleanup;
      window.addEventListener('focus', onFocus);
      win.print();
    } catch (err) {
      logError('Invoice PDF print failed', err);
      toast.error('Could not open the print dialog.');
      cleanup();
      return;
    }
    setTimeout(cleanup, 60000);
  };

  // Set srcdoc before inserting so the iframe's first (and only) load is the
  // real document, not about:blank.
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
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
