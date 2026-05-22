import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Megaphone, ChevronDown, ChevronRight, Layers, List as ListIcon, AlertTriangle } from 'lucide-react';
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

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  inactive: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

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
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  if (list.length === 1) return <span>{list[0]}</span>;
  return (
    <span title={list.join('\n')} className="cursor-help">
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Campaigns" description="Lead generation campaigns synced from LeadByte" />

      <UnlinkedSpendCard />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleStatusChange(tab)}
                className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  statusFilter === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTypeChange(tab.value)}
                className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  typeFilter === tab.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => handleGroupModeChange('vertical')}
              className={`shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                groupMode === 'vertical' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={groupMode === 'vertical'}
            >
              <Layers className="size-4" />
              Group by vertical
            </button>
            <button
              onClick={() => handleGroupModeChange('flat')}
              className={`shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                groupMode === 'flat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={groupMode === 'flat'}
            >
              <ListIcon className="size-4" />
              Flat
            </button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Couldn't load campaigns"
              error={error}
              onRetry={() => refetch()}
            />
          ) : !campaigns?.length ? (
            <EmptyState
              icon={Megaphone}
              title={search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No matching campaigns' : 'No campaigns yet'}
              description={
                search || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try a different filter or search term.'
                  : 'Campaigns sync from LeadByte. Check that LeadByte is connected and has active campaigns.'
              }
            />
          ) : groupMode === 'vertical' ? (
            <VerticalGroupedView campaigns={campaigns} />
          ) : (
            <div className="overflow-x-auto">
              {/* T3.6 (Sam, 2026-05-20): 11-column flat table — pin the
                  Campaign column so the row label stays visible while
                  the metric columns scroll horizontally on narrow
                  viewports. */}
              <Table className="[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-card [&_th:first-child]:z-20 [&_th:first-child]:border-r [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-card [&_td:first-child]:z-10 [&_td:first-child]:border-r">
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">Week</TableHead>
                    <TableHead className="text-right">Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: CampaignSummary) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[140px] sm:max-w-[220px]">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">LeadByte ID: {c.id.replace(/^lb-/, '')}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <BuyerCell names={c.clientNames} fallback={c.clientName} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">{c.vertical}</Badge>
                          <Badge variant="outline" className="text-xs">{campaignTypeLabels[c.campaignType] ?? 'PPL'}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${statusColors[c.status] || ''}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.leadsToday}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.leadsThisWeek}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.leadsThisMonth}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.totalRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.cpl)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={c.margin >= 50 ? 'text-emerald-600' : c.margin >= 30 ? 'text-amber-600' : 'text-destructive'}>
                          {c.margin}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link to={`/campaigns/${c.id}`}>
                          <Button variant="ghost" size="icon" className="size-8">
                            <ExternalLink className="size-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {data && data.total > 0 && groupMode === 'flat' && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>
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
    <div className="p-2">
      {ordered.map((g) => (
        <VerticalGroup key={g.vertical} group={g} />
      ))}
    </div>
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
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors sm:flex-row sm:items-center sm:gap-3"
        aria-expanded={open}
      >
        {/* T3 slice 2 (Sam, 2026-05-20): on mobile, stack the title-row
            above the metric chips so the vertical name + buyer count
            stay readable at 375px and the £Revenue / Margin chips wrap
            cleanly underneath. Above sm the original single-row layout
            with ml-auto metrics returns. */}
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          <Layers className="size-4 text-muted-foreground" />
          <span className="font-semibold">{group.vertical}</span>
          <Badge variant="secondary" className="text-xs">
            {group.rows.length} buyer{group.rows.length === 1 ? '' : 's'}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pl-7 text-xs tabular-nums sm:ml-auto sm:pl-0">
          <span><span className="text-muted-foreground">Month:</span> <span className="font-medium">{group.totalLeadsMonth.toLocaleString()}</span></span>
          <span><span className="text-muted-foreground">Revenue:</span> <span className="font-medium">{formatCurrency(group.totalRevenue)}</span></span>
          <span>
            <span className="text-muted-foreground">Margin:</span>{' '}
            <span className={`font-medium ${margin >= 50 ? 'text-emerald-600' : margin >= 30 ? 'text-amber-600' : 'text-destructive'}`}>
              {margin}%
            </span>
          </span>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          {/* T3 slice 2 (Sam, 2026-05-20): 8-column grouped table overflowed
              at 375px because the outer card was already inside a
              non-scrolling div. Wrap in overflow-x-auto so phones can pan
              the inner columns (Month / Revenue / CPL / Margin) while the
              vertical group header above stays fully visible. */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-12">Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-12 max-w-[220px]">
                    <div className="truncate font-medium">{c.name}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <BuyerCell names={c.clientNames} fallback={c.clientName} />
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs capitalize ${statusColors[c.status] || ''}`}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.leadsThisMonth}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(c.totalRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(c.cpl)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={c.margin >= 50 ? 'text-emerald-600' : c.margin >= 30 ? 'text-amber-600' : 'text-destructive'}>
                      {c.margin}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link to={`/campaigns/${c.id}`}>
                      <Button variant="ghost" size="icon" className="size-8">
                        <ExternalLink className="size-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-100">
              <AlertTriangle className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {formatCurrency(data.total)} of Catchr spend isn't linked to a campaign
              </p>
              <p className="text-xs text-muted-foreground">
                {data.rows.length} ad account{data.rows.length === 1 ? '' : 's'} active in the last {data.windowDays} days with no traffic-source mapping. Link the account on its campaign's detail page to attribute spend.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-amber-700 hover:text-amber-800"
          >
            {expanded ? 'Hide' : 'Show'} accounts
            {expanded ? <ChevronDown className="ml-1 size-4" /> : <ChevronRight className="ml-1 size-4" />}
          </Button>
        </div>
        {expanded && (
          <div className="mt-3 overflow-x-auto rounded-md border border-amber-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Account ID</TableHead>
                  <TableHead className="text-xs text-right">Spend (30d)</TableHead>
                  <TableHead className="text-xs text-right">Days active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.platform}-${r.accountId}`}>
                    <TableCell className="text-sm capitalize">{r.platform.replace('-', ' ')}</TableCell>
                    <TableCell className="text-sm">{r.accountName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.accountId}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{formatCurrency(r.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.daysActive}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!expanded && data.rows.length > 5 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Showing top 5 by spend — click Show accounts to see all {data.rows.length}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
