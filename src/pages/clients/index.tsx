import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Plus, Users, AlertTriangle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClients, type ClientSummary } from '@/lib/hooks/use-clients';
import { resolveDisplayedStatus } from './detail';
import { useDebounce } from '@/lib/hooks/use-debounce';

// Sam Loom #31 (13 May response) — only 3 statuses: Onboarding, Active
// Client, Client Churned. 'prospect' and 'paused' were dropped; existing
// rows migrated via 0022. UI labels diverge from DB values (we render
// the longer label) so the underlying enum stays clean.
// Sam request 2026-06-15: drop the 'active' status tab so there's no active
// subsection — leave the rest as a plain list. ('active' rows still render in
// the All view with their badge; only the filter tab is removed.)
const STATUS_TABS = ['all', 'onboarding', 'churned'] as const;

// Statto pill variant per displayed status. Legacy 'prospect'/'paused' are kept
// as fallbacks (mirrors clients/detail.tsx) so a row that slipped through
// migration 0022 renders a styled pill here too instead of raw enum text.
const statusPill: Record<string, string> = {
  onboarding: 'infosoft',
  active: 'pos',
  churned: 'gray',
  prospect: 'infosoft',
  paused: 'warn',
};

const statusLabels: Record<string, string> = {
  all: 'All',
  onboarding: 'Onboarding',
  active: 'Active Client',
  churned: 'Client Churned',
  prospect: 'Onboarding',
  paused: 'Client Churned',
};

function CreditCell({ score }: { score: number | null }) {
  if (score === null) return <span className="cl-credit-none">—</span>;
  return <span className="cl-credit-low">{score}</span>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
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
        <div className="inv-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              className={'inv-tab' + (statusFilter === tab ? ' on' : '')}
              onClick={() => handleStatusChange(tab)}
            >
              {statusLabels[tab] ?? tab}
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
                    // Apply the same reality-check the detail-page badge does:
                    // "Active Client" only renders when docs + signed agreement
                    // are both real — otherwise downgrade to "Onboarding".
                    const displayed = resolveDisplayedStatus(c.status, c.agreementSigned, c.documentsCount);
                    return (
                      <tr key={c.id}>
                        <td className="cl-company">{c.companyName}</td>
                        <td>
                          <div className="cl-contact">{c.contactName}</div>
                          <div className="cl-email">{c.contactEmail}</div>
                        </td>
                        <td><span className={'pill p-' + (statusPill[displayed] ?? 'gray')}>{statusLabels[displayed] ?? displayed}</span></td>
                        <td className="r mono"><CreditCell score={c.creditScore} /></td>
                        <td className="r mono inv-num">{c.activeCampaigns}</td>
                        <td className="r mono inv-total">{formatCurrency(c.totalRevenue)}</td>
                        <td className="r">
                          <Link to={`/clients/${c.id}`}>
                            <button className="inv-open" title="Open client"><ExternalLink className="size-4" /></button>
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
