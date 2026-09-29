import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, ExternalLink, Plus, Users, AlertTriangle, Download, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ChevronsUpDown, FileDown, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useClients, useAttioConfigured, downloadClientsCsv,
  type ClientSummary, type ClientSortKey, type SortDir, type ClientListFilters, useClientAddedByOptions } from '@/lib/hooks/use-clients';
import { saveBlob } from '@/lib/download';
import { logError } from '@/lib/log';
import './clients.css';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { formatCurrency } from '@/lib/currency';
import {
  CLIENT_STATUS_TABS, clientStatusLabel, clientStatusPill, clientStatusWarnings,
} from '@/lib/client-status';

// Feedback M4 (29 Sep 2026): tabs follow the stored status. The Active tab was
// removed on Sam's 15 Jun request and is back at his 29 Sep request; Paused is
// its own status again (it used to render as "Client Churned").

function CreditCell({ score }: { score: number | null }) {
  if (score === null) return <span className="cl-credit-none">—</span>;
  return <span className="cl-credit-low">{score}</span>;
}

/**
 * Revenue in the client's own currency (feedback M3 — this column was
 * hard-coded to £, so a EUR client's €399,791 read as £399,791). Paid invoices
 * in any OTHER currency are listed underneath rather than added in.
 * `revenueByCurrency` is absent on older backends — then only the main figure shows.
 */
function RevenueCell({ client }: { client: ClientSummary }) {
  const others = Object.entries(client.revenueByCurrency ?? {})
    .filter(([cur, amt]) => cur !== client.currency && amt !== 0);
  return (
    <>
      {formatCurrency(client.totalRevenue, client.currency)}
      {others.length > 0 && (
        <div className="cl-email" title="Paid invoices in another currency — not added into the figure above">
          {others.map(([cur, amt]) => `+ ${formatCurrency(amt, cur)}`).join(' · ')}
        </div>
      )}
    </>
  );
}

// Feedback S14 (29 Sep 2026): sortable columns, filters, page size, CSV.
// Default order is newest client first (sort=created); there's no "Added"
// column — at 1280px it pushed the open-client button out of the card.
// Currencies offered in the filter — the ones clients are billed in.
const CURRENCY_FILTERS = ['GBP', 'EUR', 'USD', 'CHF', 'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'AED'] as const;
const PAGE_SIZES = [10, 25, 50, 100] as const;
const SORT_KEYS: readonly ClientSortKey[] = ['company', 'status', 'revenue', 'campaigns', 'credit', 'created'];

/** Column header that sorts server-side; clicking again flips the direction. */
function SortableHead({
  id, label, align = 'left', sort, dir, onToggle,
}: {
  id: ClientSortKey; label: string; align?: 'left' | 'right';
  sort: ClientSortKey; dir: SortDir; onToggle: (id: ClientSortKey) => void;
}) {
  const active = sort === id;
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th className={align === 'right' ? 'r' : ''} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={'inv-sort' + (active ? ' on' : '')}
        onClick={() => onToggle(id)}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <span className="lic"><Icon className="size-[13px]" aria-hidden /></span>
      </button>
    </th>
  );
}

export function ClientsPage() {
  // URL-synced so a refresh or a shared link keeps the same view (like the
  // Invoices list). Search is typed into local state and debounced into the URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') ?? 'all';
  const currencyFilter = searchParams.get('currency') ?? '';
  const countryParam = searchParams.get('country') ?? '';
  const addedByFilter = searchParams.get('addedBy') ?? '';
  const { data: addedByOptions } = useClientAddedByOptions();
  const sortParam = searchParams.get('sort') as ClientSortKey | null;
  const sort: ClientSortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'created';
  const dir: SortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limitParam = Number(searchParams.get('limit'));
  const limit = (PAGE_SIZES as readonly number[]).includes(limitParam) ? limitParam : 10;

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [country, setCountry] = useState(countryParam);
  const debouncedCountry = useDebounce(country, 300);
  const [exporting, setExporting] = useState(false);
  const attioConfigured = useAttioConfigured();

  const patch = (next: Record<string, string | null>, resetPage = true) => {
    const p = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') p.delete(k); else p.set(k, v);
    }
    if (resetPage) p.delete('page');
    setSearchParams(p, { replace: true });
  };

  // Debounced text inputs flow into the URL once typing pauses. In an effect,
  // not during render — setSearchParams navigates, which is a router update.
  const urlSearch = searchParams.get('q') ?? '';
  useEffect(() => {
    const q = debouncedSearch.trim();
    const c = debouncedCountry.trim();
    if (q === urlSearch && c === countryParam) return;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (q) p.set('q', q); else p.delete('q');
      if (c) p.set('country', c); else p.delete('country');
      p.delete('page');
      return p;
    }, { replace: true });
  }, [debouncedSearch, debouncedCountry, urlSearch, countryParam, setSearchParams]);

  const filters: ClientListFilters = {
    status: statusFilter, search: urlSearch, currency: currencyFilter || undefined,
    country: countryParam, addedBy: addedByFilter || undefined, sort, dir,
  };
  const { data, isLoading, error } = useClients({ ...filters, page, limit });
  const clients = data?.clients;

  const handleStatusChange = (s: string) => patch({ status: s === 'all' ? null : s });
  const handleSearchChange = (val: string) => setSearch(val);
  const setPage = (n: number) => patch({ page: n > 1 ? String(n) : null }, false);
  const handleSort = (id: ClientSortKey) => {
    // Text columns start A→Z; numbers/dates start biggest/newest first.
    const firstDir: SortDir = id === 'company' || id === 'status' ? 'asc' : 'desc';
    patch({ sort: id, dir: sort === id ? (dir === 'asc' ? 'desc' : 'asc') : firstDir });
  };
  const filtered = !!(urlSearch || statusFilter !== 'all' || currencyFilter || countryParam || addedByFilter);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await downloadClientsCsv(filters);
      saveBlob(blob, `clients-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      logError('Clients CSV export failed', err);
      toast.error(err instanceof Error ? err.message : "Couldn't export clients. Try again.");
    } finally {
      setExporting(false);
    }
  };

  // Pagination maths for the Statto footer pager.
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const currentPage = data?.page ?? page;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Clients</h1>
          <p className="ahead-sub">Manage your client accounts</p>
        </div>
        <div className="page-actions">
          <button
            className="btn b-ghost b-sm"
            onClick={handleExport}
            disabled={exporting}
            title="Download the clients matching the current filters and sort as a CSV file"
          >
            {exporting ? <Loader2 className="size-[15px] animate-spin" aria-hidden /> : <FileDown className="size-[15px]" aria-hidden />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {/* Feedback S16: hidden when Attio isn't configured (the button
              could only lead to an error). Shown while unknown / older BE. */}
          {attioConfigured !== false && (
            <Link to="/clients/import">
              <button className="btn b-ghost b-sm"><Download className="size-[15px]" aria-hidden /> Import from Attio</button>
            </Link>
          )}
          <Link to="/clients/create">
            <button className="btn b-dark b-sm"><Plus className="size-[15px]" /> New Client</button>
          </Link>
        </div>
      </div>

      <div className="inv-toolbar">
        <div className="inv-tabs inv-tabs-wrap">
          {CLIENT_STATUS_TABS.map((tab) => (
            <button
              key={tab}
              className={'inv-tab' + (statusFilter === tab ? ' on' : '')}
              onClick={() => handleStatusChange(tab)}
            >
              {clientStatusLabel(tab)}
            </button>
          ))}
        </div>
        <div className="inv-search">
          <Search className="size-4" aria-hidden />
          <input
            placeholder="Search clients…"
            aria-label="Search clients by company, contact or email"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="cl-filters">
        <label className="cl-filter">
          <span>Currency</span>
          <select value={currencyFilter} onChange={(e) => patch({ currency: e.target.value || null })}>
            <option value="">All currencies</option>
            {CURRENCY_FILTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="cl-filter">
          <span>Country</span>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Any country"
            aria-label="Filter by country (contains)"
          />
        </label>
        {/* S14: hidden on an older backend that can't answer the options call. */}
        {addedByOptions && addedByOptions.length > 0 && (
          <label className="cl-filter">
            <span>Added by</span>
            <select value={addedByFilter} onChange={(e) => patch({ addedBy: e.target.value || null })}>
              <option value="">Anyone</option>
              {addedByOptions.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.count})</option>)}
            </select>
          </label>
        )}
        <label className="cl-filter">
          <span>Per page</span>
          <select value={limit} onChange={(e) => patch({ limit: e.target.value === '10' ? null : e.target.value })}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="btn b-ghost b-sm"
            onClick={() => { setSearch(''); setCountry(''); patch({ status: null, currency: null, country: null, addedBy: null, q: null }); }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="card acard inv-card">
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg2)' }}>Loading clients…</div>
        ) : error ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
            <strong>Couldn't load clients</strong>
            <p>Something went wrong reaching the server. Try refreshing the page.</p>
          </div>
        ) : !clients?.length ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><Users className="size-[26px]" /></span>
            <strong>{filtered ? 'No matching clients' : 'No clients yet'}</strong>
            <p>
              {filtered
                ? 'Try a different search or filter.'
                : 'Add your first client to start tracking campaigns, invoices, and credit.'}
            </p>
            {!filtered && (
              <Link to="/clients/create"><button className="btn b-dark b-sm"><Plus className="size-[15px]" /> Add client</button></Link>
            )}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="inv-table">
                <thead>
                  <tr>
                    <SortableHead id="company" label="Company" sort={sort} dir={dir} onToggle={handleSort} />
                    <th>Contact</th>
                    <SortableHead id="status" label="Status" sort={sort} dir={dir} onToggle={handleSort} />
                    <SortableHead id="credit" label="Credit" align="right" sort={sort} dir={dir} onToggle={handleSort} />
                    <SortableHead id="campaigns" label="Campaigns" align="right" sort={sort} dir={dir} onToggle={handleSort} />
                    <SortableHead id="revenue" label="Revenue" align="right" sort={sort} dir={dir} onToggle={handleSort} />
                    {/* aria-label, not a .sr-only span: that span is position:absolute
                        and escaped .table-scroll, making the page scroll sideways at 390px. */}
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: ClientSummary) => {
                    const warnings = clientStatusWarnings(c.status, c.agreementSigned, c.documentsCount);
                    return (
                      <tr key={c.id}>
                        <td className="cl-company">{c.companyName}</td>
                        <td>
                          <div className="cl-contact">{c.contactName}</div>
                          <div className="cl-email">{c.contactEmail}</div>
                        </td>
                        <td>
                          <span className="cl-status-cell">
                            <span className={'pill p-' + clientStatusPill(c.status)}>{clientStatusLabel(c.status)}</span>
                            {warnings.map((w) => (
                              <span key={w} className="pill p-warn" title={`Status is ${clientStatusLabel(c.status)}, but: ${w.toLowerCase()}`}>
                                <AlertTriangle className="size-3" aria-hidden /> {w}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="r mono"><CreditCell score={c.creditScore} /></td>
                        <td className="r mono inv-num">{c.activeCampaigns}</td>
                        <td className="r mono inv-total"><RevenueCell client={c} /></td>
                        <td className="r">
                          <Link to={`/clients/${c.id}`}>
                            <button className="inv-open" title="Open client" aria-label={`Open ${c.companyName}`}><ExternalLink className="size-4" /></button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div className="bf-pager">
                <span className="bf-count">Showing <strong>{from}–{to}</strong> of <strong>{total}</strong></span>
                <div className="bf-pages">
                  <button className="bf-pg-btn" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page" title="Previous page"><ChevronLeft className="size-4" aria-hidden /></button>
                  <button className="bf-pg-btn on" aria-current="page" aria-label={`Page ${currentPage} of ${pageCount}`}>{currentPage}</button>
                  <button className="bf-pg-btn" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page" title="Next page"><ChevronRight className="size-4" aria-hidden /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
