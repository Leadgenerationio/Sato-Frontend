import { useState } from 'react';
import { ReceiptText, CircleCheckBig, Printer, ChevronDown } from 'lucide-react';
import { usePortalInvoices, type PortalInvoice } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { toMoney } from '@/lib/hooks/use-invoices';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { printHtml } from '@/lib/print-html';

// Sam T8 (2026-05-20): client-facing label map — Xero's "authorised" reads as
// legalese to a buyer, surface as "Pending Payment".
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Pending Payment', authorised: 'Pending Payment', paid: 'Paid', overdue: 'Overdue',
};
const statusLabel = (s: string) => STATUS_LABEL[s.toLowerCase()] ?? s;
const statusPill = (s: string) => {
  const k = s.toLowerCase();
  if (k === 'paid') return 'p-soft';
  if (k === 'overdue') return 'p-neg';
  return 'p-warn';
};

const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function handleViewInvoice(inv: PortalInvoice) {
  printHtml(`
    <!DOCTYPE html><html><head><title>${escapeHtml(inv.invoiceNumber)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #111; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
      th { font-weight: 600; background: #f5f5f5; }
      .text-right { text-align: right; }
      .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #111; }
      @media print { body { padding: 20px; } }
    </style></head><body>
      <h1>Invoice ${escapeHtml(inv.invoiceNumber)}</h1>
      <div class="meta">${escapeHtml(statusLabel(inv.status))}${inv.daysOverdue > 0 ? ` (${escapeHtml(inv.daysOverdue)} days overdue)` : ''}</div>
      <table>
        <tr><th>Detail</th><th class="text-right">Value</th></tr>
        <tr><td>Currency</td><td class="text-right">${escapeHtml(inv.currency)}</td></tr>
        <tr><td>Due Date</td><td class="text-right">${escapeHtml(formatDate(inv.dueDate))}</td></tr>
        ${inv.paidDate ? `<tr><td>Paid Date</td><td class="text-right">${escapeHtml(formatDate(inv.paidDate))}</td></tr>` : ''}
      </table>
      <table><tr class="total-row"><td>Total</td><td class="text-right">${escapeHtml(formatCurrency(toMoney(inv.total), inv.currency))}</td></tr></table>
    </body></html>`);
}

const PORTAL_HIDDEN_INVOICE_STATUSES = new Set(['draft', 'voided', 'deleted']);

export function PortalInvoicesPage() {
  usePageTitle('Stato — Invoices');
  const { data: rawInvoices, isLoading } = usePortalInvoices();
  const invoices = rawInvoices?.filter((i) => !PORTAL_HIDDEN_INVOICE_STATUSES.has((i.status ?? '').toLowerCase()));

  const years = Array.from(new Set((invoices ?? []).map((i) => new Date(i.dueDate).getFullYear().toString()))).sort().reverse();
  const [year, setYear] = useState<string>('all');
  const [yearOpen, setYearOpen] = useState(false);
  const rows = (invoices ?? []).filter((i) => year === 'all' || new Date(i.dueDate).getFullYear().toString() === year);

  const totalOutstanding = invoices?.filter((i) => i.status !== 'paid').reduce((s, i) => s + toMoney(i.total), 0) ?? 0;
  const totalPaid = invoices?.filter((i) => i.status === 'paid').reduce((s, i) => s + toMoney(i.total), 0) ?? 0;
  const paidCount = invoices?.filter((i) => i.status === 'paid').length ?? 0;

  if (isLoading) {
    return <div className="screen"><div className="stat-row two"><Skeleton className="h-[168px] rounded-3xl" /><Skeleton className="h-[168px] rounded-3xl" /></div><Skeleton className="h-72 rounded-3xl" /></div>;
  }

  return (
    <div className="screen">
      <div className="stat-row two">
        <div className="pstat">
          <div className="pstat-top"><span className="pstat-ic"><ReceiptText className="size-5" /></span></div>
          <div className="pstat-val mono">{formatCurrency(totalOutstanding)}</div><div className="pstat-lab">Outstanding</div>
        </div>
        <div className="pstat">
          <div className="pstat-top"><span className="pstat-ic"><CircleCheckBig className="size-5" /></span>{paidCount > 0 && <span className="pill p-soft">{paidCount} paid</span>}</div>
          <div className="pstat-val mono">{formatCurrency(totalPaid)}</div><div className="pstat-lab">Total Paid</div>
        </div>
      </div>

      <div className="card pad">
        <div className="txn-head">
          <h3 className="statto-title">Invoices</h3>
          {years.length > 0 && (
            <span className="dd-wrap">
              <button className="dd" onClick={() => setYearOpen((o) => !o)}>{year === 'all' ? 'All years' : year} <ChevronDown className="size-[15px]" /></button>
              {yearOpen && (
                <div className="dd-menu">
                  <button className={'dd-opt' + (year === 'all' ? ' on' : '')} onClick={() => { setYear('all'); setYearOpen(false); }}>All years</button>
                  {years.map((y) => (
                    <button key={y} className={'dd-opt' + (year === y ? ' on' : '')} onClick={() => { setYear(y); setYearOpen(false); }}>{y}</button>
                  ))}
                </div>
              )}
            </span>
          )}
        </div>

        {!rows.length ? (
          <EmptyState icon={ReceiptText} title="No invoices yet" description="When an invoice is issued, it will appear here." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Invoice</th><th>Due</th><th>Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ color: 'var(--fg2)' }}>{formatDate(inv.dueDate)}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{formatCurrency(toMoney(inv.total), inv.currency)}</td>
                    <td><span className={'pill ' + statusPill(inv.status)}>{statusLabel(inv.status)}{inv.daysOverdue > 0 ? ` (${inv.daysOverdue}d)` : ''}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="link-btn" title="View / print" onClick={() => handleViewInvoice(inv)}><Printer className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
