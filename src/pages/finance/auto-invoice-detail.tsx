import { Link, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ExternalLink, AlertCircle } from 'lucide-react';
import { useAutoInvoiceRun, type AutoInvoiceClientDetail } from '@/lib/hooks/use-auto-invoice';

function formatMoney(value: string | number, currency = 'GBP') {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number.isFinite(n) ? n : 0);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Map per-client run status → Statto pill colour suffix.
function clientStatusPill(status: AutoInvoiceClientDetail['status']): string {
  switch (status) {
    case 'invoiced': return 'pos';
    case 'failed': return 'neg';
    case 'no_lead_price': return 'warn';
    case 'no_deliveries': return 'gray';
    default: return 'gray';
  }
}

export function AutoInvoiceRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useAutoInvoiceRun(id);

  if (isLoading) {
    return (
      <div className="screen-page">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <h3>Run not found</h3>
          <Link to="/finance/auto-invoice">
            <button className="btn b-ghost b-sm"><ArrowLeft className="size-4" /> Back to auto-invoice</button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'INVOICED', value: String(run.invoicesCreated) },
    { label: 'SKIPPED', value: String(run.clientsSkipped) },
    { label: 'FAILED', value: String(run.clientsFailed) },
    { label: 'TOTAL', value: formatMoney(run.totalAmount, run.currency) },
  ];

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/finance/auto-invoice" className="nc-back" title="Back to auto-invoice">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="ahead-title">Auto-invoice run — {formatDate(run.periodFrom)} → {formatDate(run.periodTo)}</h1>
            <p className="ahead-sub">{run.triggeredBy} · started {new Date(run.startedAt).toLocaleString('en-GB')}</p>
          </div>
        </div>
      </div>

      {run.error && (
        <div className="ai-banner warn">
          <span className="lic"><AlertCircle className="size-4" /></span>
          <span><strong>Run error.</strong> {run.error}</span>
        </div>
      )}

      <div className="airun-stats">
        {stats.map((s) => (
          <div key={s.label} className="airun-stat">
            <div className="airun-stat-l">{s.label}</div>
            <div className="airun-stat-v mono">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card pad acard">
        <h3 className="statto-title" style={{ marginBottom: 18 }}>Per-client breakdown</h3>
        {run.details.length === 0 ? (
          <p className="ac-sub">No clients had deliveries in this window.</p>
        ) : (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="r">Leads</th>
                  <th className="r">Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {run.details.map((d) => (
                  <tr key={d.clientId}>
                    <td className="inv-client">{d.clientName}</td>
                    <td className="r mono">{d.leads}</td>
                    <td className="r mono inv-total">{formatMoney(d.amount, d.currency)}</td>
                    <td>
                      <span className={'pill p-' + clientStatusPill(d.status)} style={{ textTransform: 'capitalize' }}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="inv-date">{d.reason ?? ''}</td>
                    <td className="r">
                      {d.invoiceId && (
                        <Link to={`/finance/invoices/${d.invoiceId}`} className="inv-open" title={`View ${d.invoiceNumber}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      )}
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
