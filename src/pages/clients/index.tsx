import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Plus, Users, AlertTriangle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClients, type ClientSummary } from '@/lib/hooks/use-clients';
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

export function ClientsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useClients({ status: statusFilter, search: debouncedSearch, page, limit: 10 });
  const clients = data?.clients;

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

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
          <Link to="/clients/import">
            <button className="btn b-ghost b-sm"><Download className="size-[15px]" /> Import from Attio</button>
          </Link>
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
          <Search className="size-4" />
          <input placeholder="Search clients…" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
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
            <strong>{search || statusFilter !== 'all' ? 'No matching clients' : 'No clients yet'}</strong>
            <p>
              {search || statusFilter !== 'all'
                ? 'Try a different search or filter.'
                : 'Add your first client to start tracking campaigns, invoices, and credit.'}
            </p>
            {!(search || statusFilter !== 'all') && (
              <Link to="/clients/create"><button className="btn b-dark b-sm"><Plus className="size-[15px]" /> Add client</button></Link>
            )}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th className="r">Credit</th>
                    <th className="r">Campaigns</th>
                    <th className="r">Revenue</th>
                    <th></th>
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
                  <button className="bf-pg-btn" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></button>
                  <button className="bf-pg-btn on">{currentPage}</button>
                  <button className="bf-pg-btn" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
