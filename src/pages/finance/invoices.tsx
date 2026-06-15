import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ExternalLink, Plus, Download, ArrowUp, ArrowDown, ChevronsUpDown, Calendar } from 'lucide-react';
import { useInvoices, toMoney, type InvoiceSummary, type InvoiceSortBy, type SortDir } from '@/lib/hooks/use-invoices';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';

// Sam request (repeated): no drafts. The backend now excludes drafts from the
// default/`all` list; the 'draft' tab is removed so the admin can't land on a
// drafts view. Other tabs unchanged.
const STATUS_TABS = ['all', 'sent', 'authorised', 'paid', 'overdue'] as const;

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

function exportCsv(invoices: InvoiceSummary[]) {
  // Quote + escape every field — client names routinely contain commas
  // ("Acme, Inc.") which would otherwise shift columns and corrupt the CSV.
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'Invoice,Client,Status,Currency,Subtotal,VAT,Total,Due Date,Created\n';
  const rows = invoices.map((inv) =>
    [inv.invoiceNumber, inv.clientName, inv.status, inv.currency, inv.subtotal, inv.vatAmount, inv.total, formatDate(inv.dueDate), formatDate(inv.createdAt)]
      .map(q)
      .join(','),
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortableHead({
  id, label, align = 'left', sortBy, sortDir, onToggle,
}: {
  id: InvoiceSortBy;
  label: string;
  align?: 'left' | 'right';
  sortBy: InvoiceSortBy | undefined;
  sortDir: SortDir;
  onToggle: (id: InvoiceSortBy) => void;
}) {
  const active = sortBy === id;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th className={align === 'right' ? 'r' : ''}>
      <button type="button" className={'inv-sort' + (active ? ' on' : '')} onClick={() => onToggle(id)}>
        {label}
        <span className="lic"><Icon className="size-[13px]" /></span>
      </button>
    </th>
  );
}

export function InvoiceListPage() {
  // URL-sync filter state so refresh / share-link preserves the view (Sam #7).
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') ?? 'all';
  const search = searchParams.get('search') ?? '';
  const sortBy = (searchParams.get('sortBy') as InvoiceSortBy | null) ?? 'createdAt';
  const sortDir = (searchParams.get('sortDir') as SortDir | null) ?? 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebounce(searchDraft, 300);

  // Push debounced search into the URL when it changes. setSearchParams must
  // run inside an effect (not directly in render) to avoid the React "update
  // during render" warning.
  useEffect(() => {
    if (debouncedSearch === search) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [debouncedSearch, search, setSearchParams]);

  function patchSearch(updates: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      return next;
    });
  }

  const { data, isLoading, error, refetch } = useInvoices({
    status: statusFilter,
    search: debouncedSearch,
    page,
    limit: 10,
    sortBy,
    sortDir,
  });
  const invoices = data?.invoices;

  const handleStatusChange = (s: string) => patchSearch({ status: s === 'all' ? null : s, page: null });
  const handlePageChange = (p: number) => patchSearch({ page: String(p) });
  const handleSort = (col: InvoiceSortBy) => {
    if (sortBy === col) {
      patchSearch({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      patchSearch({ sortBy: col, sortDir: 'desc' });
    }
  };

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Invoices</h1>
          <p className="ahead-sub">Manage invoices synced with Xero</p>
        </div>
        <div className="page-actions">
          <Link to="/finance/auto-invoice">
            <button className="btn b-ghost b-sm">
              <Calendar className="size-[15px]" /> Auto-invoice
            </button>
          </Link>
          <button className="btn b-ghost b-sm" onClick={() => invoices && exportCsv(invoices)} disabled={!invoices?.length}>
            <Download className="size-[15px]" /> CSV
          </button>
          <Link to="/finance/invoices/create">
            <button className="btn b-dark b-sm">
              <Plus className="size-[15px]" /> New Invoice
            </button>
          </Link>
        </div>
      </div>

      <div className="inv-toolbar">
        <div className="inv-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={'inv-tab' + (statusFilter === tab ? ' on' : '')}
              style={{ textTransform: 'capitalize' }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="inv-search">
          <span className="lic"><Search className="size-4" /></span>
          <input
            placeholder="Search invoices…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
      </div>

      <div className="card acard inv-card">
        {isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 16 }}>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load invoices"
            error={error}
            onRetry={() => refetch()}
          />
        ) : !invoices?.length ? (
          <div className="inv-empty">
            {debouncedSearch || statusFilter !== 'all'
              ? 'No invoices match your filters.'
              : 'No invoices yet — create your first invoice to bill clients and push it through to Xero.'}
          </div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <SortableHead id="invoiceNumber" label="Invoice" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                <th>Client</th>
                <SortableHead id="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                <th className="r">Subtotal</th>
                <th className="r">VAT</th>
                <SortableHead id="total" label="Total" align="right" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                <SortableHead id="dueDate" label="Due Date" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                <SortableHead id="createdAt" label="Created" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="inv-id">{inv.invoiceNumber}</td>
                  <td className="inv-client">{inv.clientName}</td>
                  <td>
                    <span className="inv-status">
                      <span className={'pill p-' + (statusPill[inv.status] ?? 'gray')} style={{ textTransform: 'capitalize' }}>
                        {inv.status}
                        {inv.daysOverdue > 0 && ` (${inv.daysOverdue}d)`}
                      </span>
                      {inv.xeroInvoiceId && <span className="pill p-xero">Xero</span>}
                    </span>
                  </td>
                  <td className="r mono inv-num">{formatCurrency(toMoney(inv.subtotal), inv.currency)}</td>
                  <td className="r mono inv-num">{formatCurrency(toMoney(inv.vatAmount), inv.currency)}</td>
                  <td className="r mono inv-total">{formatCurrency(toMoney(inv.total), inv.currency)}</td>
                  <td className="inv-date">{formatDate(inv.dueDate)}</td>
                  <td className="inv-date">{formatDate(inv.createdAt)}</td>
                  <td className="r">
                    <Link to={`/finance/invoices/${inv.id}`} className="inv-open" title="Open invoice">
                      <ExternalLink className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
