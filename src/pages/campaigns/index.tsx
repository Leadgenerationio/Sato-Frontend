import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ExternalLink, Megaphone, ChevronDown, ChevronRight, Layers, List as ListIcon, TriangleAlert,
} from 'lucide-react';
import { useCampaigns, useUnlinkedSpend, type CampaignSummary } from '@/lib/hooks/use-campaigns';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

const STATUS_TABS = ['all', 'active', 'paused', 'inactive'] as const;
const TYPE_TABS = [
  { value: 'all', label: 'All Types' },
  { value: 'pay_per_lead', label: 'Pay-Per-Lead' },
  { value: 'managed', label: 'Managed' },
  { value: 'internal', label: 'Internal' },
] as const;

const statusPill = (s: string) => (s === 'active' ? 'pos' : s === 'paused' ? 'warn' : 'gray');
const marginCls = (m: number) => (m >= 50 ? 'm-pos' : m >= 30 ? 'm-warn' : 'm-neg');

const campaignTypeLabels: Record<string, string> = {
  pay_per_lead: 'PPL',
  managed: 'Managed',
  internal: 'Internal',
};

// OCT-41: render multi-buyer rows as "Multiple (N)" with the full buyer
// list as a native tooltip. Single-buyer rows render the name directly;
// no-buyer rows render whatever clientName carries (typically the
// "Pending client mapping" string).
function BuyerCell({ names, fallback }: { names?: string[]; fallback: string }) {
  const list = names && names.length > 0 ? names : (fallback ? [fallback] : []);
  if (list.length === 0) return <span className="cmp-client">—</span>;
  if (list.length === 1) return <span>{list[0]}</span>;
  return (
    <span title={list.join('\n')} style={{ cursor: 'help' }}>
      Multiple ({list.length})
    </span>
  );
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

type GroupMode = 'flat' | 'vertical';

const GROUP_MODE_KEY = 'stato:campaigns:groupMode';

export function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  // Sam Loom #40 — campaigns grouped by vertical (Solar Panels / Hearing
  // Aids / etc) is closer to his mental model than the flat list. Default
  // to grouped; persist the choice so staff who prefer flat keep flat.
  const [groupMode, setGroupMode] = useState<GroupMode>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(GROUP_MODE_KEY) : null;
    return stored === 'flat' ? 'flat' : 'vertical';
  });
  const handleGroupModeChange = (m: GroupMode) => {
    setGroupMode(m);
    try { localStorage.setItem(GROUP_MODE_KEY, m); } catch { /* ignore */ }
  };
  // Pull a bigger slice when grouped — Sam's expecting to see ALL the
  // verticals on one page, not paginate by row count.
  const limit = groupMode === 'vertical' ? 100 : 10;
  const { data, isLoading, error, refetch } = useCampaigns({ status: statusFilter, type: typeFilter, search: debouncedSearch, page, limit });
  const campaigns = data?.campaigns;

  // Reset to page 1 when filters change
  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handleTypeChange = (t: string) => { setTypeFilter(t); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Campaigns</h1>
          <p className="ahead-sub">Lead generation campaigns synced from LeadByte</p>
        </div>
      </div>

      <UnlinkedSpendCard />

      {/* Filters */}
      <div className="cmp-toolbar">
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
        <div className="inv-tabs">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTypeChange(tab.value)}
              className={'inv-tab' + (typeFilter === tab.value ? ' on' : '')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="cmp-toggle">
          <button
            onClick={() => handleGroupModeChange('vertical')}
            className={'cmp-tg' + (groupMode === 'vertical' ? ' on' : '')}
            aria-pressed={groupMode === 'vertical'}
          >
            <Layers className="size-[15px]" /> Group by vertical
          </button>
          <button
            onClick={() => handleGroupModeChange('flat')}
            className={'cmp-tg' + (groupMode === 'flat' ? ' on' : '')}
            aria-pressed={groupMode === 'flat'}
          >
            <ListIcon className="size-[15px]" /> Flat
          </button>
        </div>
        <div className="inv-search cmp-search">
          <Search className="size-4" />
          <input
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card acard inv-card">
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 16 }}>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="card acard inv-card">
          <ErrorState
            title="Couldn't load campaigns"
            error={error}
            onRetry={() => refetch()}
          />
        </div>
      ) : !campaigns?.length ? (
        <div className="card acard inv-card">
          <EmptyState
            icon={Megaphone}
            title={search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No matching campaigns' : 'No campaigns yet'}
            description={
              search || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try a different filter or search term.'
                : 'Campaigns sync from LeadByte. Check that LeadByte is connected and has active campaigns.'
            }
          />
        </div>
      ) : groupMode === 'vertical' ? (
        <VerticalGroupedView campaigns={campaigns} />
      ) : (
        <div className="card acard inv-card">
          <div className="table-scroll">
            <table className="inv-table cmp-table cmp-flat">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Client</th>
                  <th>Vertical</th>
                  <th>Status</th>
                  <th className="r">Today</th>
                  <th className="r">Week</th>
                  <th className="r">Month</th>
                  <th className="r">Revenue</th>
                  <th className="r">CPL</th>
                  <th className="r">Margin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: CampaignSummary) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cmp-name">{c.name}</div>
                      <div className="cmp-lbid">LeadByte ID: {c.id.replace(/^lb-/, '')}</div>
                    </td>
                    <td className="cmp-client">
                      <BuyerCell names={c.clientNames} fallback={c.clientName} />
                    </td>
                    <td>
                      <span className="cmp-vpill">{c.vertical}</span>
                      <span className="cmp-type">{campaignTypeLabels[c.campaignType] ?? 'PPL'}</span>
                    </td>
                    <td>
                      <span className={'pill p-' + statusPill(c.status)} style={{ textTransform: 'capitalize' }}>{c.status}</span>
                    </td>
                    <td className="r mono inv-num">{c.leadsToday}</td>
                    <td className="r mono inv-num">{c.leadsThisWeek}</td>
                    <td className="r mono inv-num">{c.leadsThisMonth}</td>
                    <td className="r mono inv-total">{formatCurrency(c.totalRevenue)}</td>
                    <td className="r mono inv-num">{formatCurrency(c.cpl)}</td>
                    <td className={'r mono cmp-margin ' + marginCls(c.margin)}>{c.margin}%</td>
                    <td className="r">
                      <Link to={`/campaigns/${c.id}`} className="inv-open" title="Open campaign">
                        <ExternalLink className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total > 0 && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Sam Loom #40 — Solar Panels appears once at top level with its buyer
// campaigns collapsible underneath. Each vertical row shows aggregate totals
// so Sam can scan the verticals without drilling into every campaign.
function VerticalGroupedView({ campaigns }: { campaigns: CampaignSummary[] }) {
  // Group by vertical name. Empty/missing vertical → "(Uncategorised)".
  const groups = new Map<string, CampaignSummary[]>();
  for (const c of campaigns) {
    const key = c.vertical?.trim() || '(Uncategorised)';
    const existing = groups.get(key) ?? [];
    existing.push(c);
    groups.set(key, existing);
  }
  // Sort verticals by aggregate revenue desc so the highest-impact verticals
  // float to the top — matches the leadreports.io ordering Sam called out.
  const ordered = Array.from(groups.entries())
    .map(([vertical, rows]) => ({
      vertical,
      rows,
      totalLeadsMonth: rows.reduce((s, r) => s + r.leadsThisMonth, 0),
      totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
      totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <>
      {ordered.map((g) => (
        <VerticalGroup key={g.vertical} group={g} />
      ))}
    </>
  );
}

function VerticalGroup({
  group,
}: {
  group: {
    vertical: string;
    rows: CampaignSummary[];
    totalLeadsMonth: number;
    totalRevenue: number;
    totalCost: number;
  };
}) {
  const [open, setOpen] = useState(true);
  const margin = group.totalRevenue > 0
    ? Math.round(((group.totalRevenue - group.totalCost) / group.totalRevenue) * 1000) / 10
    : 0;

  return (
    <div className="card acard cmp-group">
      <button type="button" className="cmp-group-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown className="size-[18px]" /> : <ChevronRight className="size-[18px]" />}
        <span className="cmp-vstack"><Layers className="size-4" /></span>
        <span className="cmp-vname">{group.vertical}</span>
        <span className="cmp-buyers">{group.rows.length} buyer{group.rows.length === 1 ? '' : 's'}</span>
        <span className="cmp-totals">
          <span><i>Month:</i> {group.totalLeadsMonth.toLocaleString('en-GB')}</span>
          <span><i>Revenue:</i> {formatCurrency(group.totalRevenue)}</span>
          <span><i>Margin:</i> <b className={marginCls(margin)}>{margin}%</b></span>
        </span>
      </button>
      {open && (
        <div className="table-scroll">
          <table className="inv-table cmp-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Client</th>
                <th>Status</th>
                <th className="r">Month</th>
                <th className="r">Revenue</th>
                <th className="r">CPL</th>
                <th className="r">Margin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((c) => (
                <tr key={c.id}>
                  <td className="cmp-name">{c.name}</td>
                  <td className="cmp-client">
                    <BuyerCell names={c.clientNames} fallback={c.clientName} />
                  </td>
                  <td>
                    <span className={'pill p-' + statusPill(c.status)} style={{ textTransform: 'capitalize' }}>{c.status}</span>
                  </td>
                  <td className="r mono inv-num">{c.leadsThisMonth}</td>
                  <td className="r mono inv-total">{formatCurrency(c.totalRevenue)}</td>
                  <td className="r mono inv-num">{formatCurrency(c.cpl)}</td>
                  <td className={'r mono cmp-margin ' + marginCls(c.margin)}>{c.margin}%</td>
                  <td className="r">
                    <Link to={`/campaigns/${c.id}`} className="inv-open" title="Open campaign">
                      <ExternalLink className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// T1 (Sam, 2026-05-20) — surfaces Catchr spend whose (platform, account_id)
// is not in any active traffic_sources mapping. By design these numbers
// never roll into any campaign total — they appear here only so the gap
// between Catchr's lifetime total and the sum of per-campaign attributed
// costs is visible and actionable (link the account → spend shifts from
// this card to its campaign).
function UnlinkedSpendCard() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useUnlinkedSpend(30);

  if (isLoading) {
    return <Skeleton className="h-20" />;
  }
  // Nothing to surface — every spend row in the window is attributed.
  // Hide the card rather than render an empty box that crowds the page.
  if (!data || data.total === 0 || data.rows.length === 0) {
    return null;
  }

  const rows = expanded ? data.rows : data.rows.slice(0, 5);
  return (
    <div>
      <div className="cmp-banner">
        <span className="cmp-banner-ic"><TriangleAlert className="size-5" /></span>
        <div className="cmp-banner-text">
          <strong>{formatCurrency(data.total)} of Catchr spend isn't linked to a campaign</strong>
          <span>
            {data.rows.length} ad account{data.rows.length === 1 ? '' : 's'} active in the last {data.windowDays} days with no traffic-source mapping. Link the account on its campaign's detail page to attribute spend.
          </span>
        </div>
        <button className="cmp-banner-link" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide' : 'Show'} accounts
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </div>
      {expanded && (
        <div className="card acard inv-card" style={{ marginTop: 12 }}>
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Account</th>
                  <th>Account ID</th>
                  <th className="r">Spend (30d)</th>
                  <th className="r">Days active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.platform}-${r.accountId}`}>
                    <td style={{ textTransform: 'capitalize' }}>{r.platform.replace('-', ' ')}</td>
                    <td>{r.accountName ?? <span className="cmp-client">—</span>}</td>
                    <td className="mono cmp-lbid">{r.accountId}</td>
                    <td className="r mono inv-total">{formatCurrency(r.spend)}</td>
                    <td className="r mono inv-num">{r.daysActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
