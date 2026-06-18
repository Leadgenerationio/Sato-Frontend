import { useState } from 'react';
import { ReceiptText, CircleCheckBig, Download, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { usePortalInvoices, useDownloadPortalInvoicePdf, type PortalInvoice } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { toMoney } from '@/lib/hooks/use-invoices';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, totalsByCurrency } from '@/lib/currency';

// Sam T8 (2026-05-20): client-facing label map — Xero's "authorised" reads as
// legalese to a buyer, surface as "Pending Payment". "submitted" is the Xero
// pre-authorised state; same buyer-facing meaning — payment is coming.
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Pending Payment', sent: 'Pending Payment', authorised: 'Pending Payment', paid: 'Paid', overdue: 'Overdue',
};
const statusLabel = (s: string) => STATUS_LABEL[s.toLowerCase()] ?? s;
const statusPill = (s: string) => {
  const k = s.toLowerCase();
  if (k === 'paid') return 'p-soft';
  if (k === 'overdue') return 'p-neg';
  return 'p-warn';
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PORTAL_HIDDEN_INVOICE_STATUSES = new Set(['draft', 'voided', 'deleted']);

export function PortalInvoicesPage() {
  usePageTitle('Stato — Invoices');
  const { data: rawInvoices, isLoading } = usePortalInvoices();
  const downloadPdf = useDownloadPortalInvoicePdf();

  function handleDownloadInvoice(inv: PortalInvoice) {
    downloadPdf.mutate(
      { id: inv.id, invoiceNumber: inv.invoiceNumber },
      {
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Could not download the invoice PDF.'),
      },
    );
  }
  const invoices = rawInvoices?.filter((i) => !PORTAL_HIDDEN_INVOICE_STATUSES.has((i.status ?? '').toLowerCase()));

  const years = Array.from(new Set((invoices ?? []).map((i) => new Date(i.dueDate).getFullYear().toString()))).sort().reverse();
  const [year, setYear] = useState<string>('all');
  const [yearOpen, setYearOpen] = useState(false);
  const rows = (invoices ?? []).filter((i) => year === 'all' || new Date(i.dueDate).getFullYear().toString() === year);

  // Finding #12: never sum across differing currencies into one (£GBP) figure.
  // Group sums BY currency, preserving first-seen order, via the shared
  // totalsByCurrency helper. A single-currency client gets one clean total; a
  // mixed-currency client gets a per-currency breakdown rather than a
  // misleading conflated £ figure.
  //
  // Finding #10: round each per-currency total to 2 decimals (mirroring the
  // backend's Math.round(x*100)/100) so the portal Invoices tile can't disagree
  // with the dashboard by a float-drift penny.
  const sumByCurrency = (rows: PortalInvoice[]) =>
    totalsByCurrency(
      rows,
      (i) => toMoney(i.total),
      (i) => i.currency || 'GBP',
    ).map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }));
  const outstandingByCurrency = sumByCurrency((invoices ?? []).filter((i) => i.status !== 'paid'));
  const paidByCurrency = sumByCurrency((invoices ?? []).filter((i) => i.status === 'paid'));
  const paidCount = invoices?.filter((i) => i.status === 'paid').length ?? 0;

  // Render one money line per currency; empty → a single zero line in GBP so
  // the stat tile is never blank.
  const renderTotals = (groups: { currency: string; total: number }[]) =>
    (groups.length ? groups : [{ currency: 'GBP', total: 0 }]).map((g) => (
      <div key={g.currency} className="pstat-val mono">{formatCurrency(g.total, g.currency)}</div>
    ));

  if (isLoading) {
    return <div className="screen"><div className="stat-row two"><Skeleton className="h-[168px] rounded-3xl" /><Skeleton className="h-[168px] rounded-3xl" /></div><Skeleton className="h-72 rounded-3xl" /></div>;
  }

  return (
    <div className="screen">
      <div className="stat-row two">
        <div className="pstat">
          <div className="pstat-top"><span className="pstat-ic"><ReceiptText className="size-5" /></span></div>
          {renderTotals(outstandingByCurrency)}<div className="pstat-lab">Outstanding</div>
        </div>
        <div className="pstat">
          <div className="pstat-top"><span className="pstat-ic"><CircleCheckBig className="size-5" /></span>{paidCount > 0 && <span className="pill p-soft">{paidCount} paid</span>}</div>
          {renderTotals(paidByCurrency)}<div className="pstat-lab">Total Paid</div>
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
                      <button
                        className="link-btn"
                        title="Download the original Xero invoice"
                        disabled={downloadPdf.isPending && downloadPdf.variables?.id === inv.id}
                        onClick={() => handleDownloadInvoice(inv)}
                      >
                        {downloadPdf.isPending && downloadPdf.variables?.id === inv.id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Download className="size-4" />}
                      </button>
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
