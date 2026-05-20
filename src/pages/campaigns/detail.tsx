import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUnlinkClientCampaign } from '@/lib/hooks/use-client-campaigns';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Target, ExternalLink,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  useCampaign, useTrafficSources, useUpdateCampaign,
  useCreateTrafficSource, useUpdateTrafficSource, useDeleteTrafficSource,
  useCatchrAccounts, useCatchrPlatforms,
  useCampaignDeliveries,
} from '@/lib/hooks/use-campaigns';
import { useCreatives, useCreateCreative, useDeleteCreative } from '@/lib/hooks/use-creatives';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type PresignedUpload } from '@/lib/hooks/use-uploads';
import { Image as ImageIcon, Video, FileText, Download, Trash2, Save, Loader2, Pencil, Users as UsersIcon, Plus } from 'lucide-react';
import type { CampaignLinkedClient } from '@/lib/hooks/use-campaigns';
import { toast } from 'sonner';

import { logError } from '../../lib/log';
type DeliveryWindow = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'ytd';

const WINDOW_OPTIONS: { value: DeliveryWindow; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
];

function windowRange(win: DeliveryWindow): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0..Sun=6
  switch (win) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86399999) };
    case 'yesterday': {
      const y = new Date(today.getTime() - 86400000);
      return { start: y, end: new Date(y.getTime() + 86399999) };
    }
    case 'this_week': {
      const start = new Date(today.getTime() - dayOfWeek * 86400000);
      return { start, end: new Date(start.getTime() + 7 * 86400000 - 1) };
    }
    case 'last_week': {
      const endOfLast = new Date(today.getTime() - dayOfWeek * 86400000 - 1);
      const startOfLast = new Date(endOfLast.getTime() - 7 * 86400000 + 1);
      return { start: startOfLast, end: endOfLast };
    }
    case 'this_month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    case 'last_month':
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
  }
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  inactive: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function buildSubtitle(...parts: (string | undefined | null)[]): string | undefined {
  const cleaned: string[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    const trimmed = part.trim();
    if (trimmed.length > 0) cleaned.push(trimmed);
  }
  return cleaned.length > 0 ? cleaned.join(' · ') : undefined;
}

function StatCard({ label, value, icon: Icon, trend }: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <Card className="gap-3 py-5">
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-destructive'}`}>
              {trend.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {trend.value}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id!);
  const { data: deliveries, isLoading: deliveriesLoading } = useCampaignDeliveries(id);
  const [window, setWindow] = useState<DeliveryWindow>('this_month');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Campaign not found</p>
        <Link to="/campaigns"><Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back to campaigns</Button></Link>
      </div>
    );
  }

  const profit = campaign.totalRevenue - campaign.totalCost;

  const { start, end } = windowRange(window);
  const filteredDeliveries = campaign.leadDeliveries.filter((d) => {
    const dt = new Date(d.date);
    return dt >= start && dt <= end;
  });

  // Chart data — filtered by selected window
  const chartData = filteredDeliveries.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    leads: d.leadCount,
    revenue: d.revenue,
    cost: d.cost,
  }));

  // Per-window totals come from the server (computed from /reports/campaign,
  // which has accurate revenue + cost). Fall back to client-side summing of
  // the daily deliveries only if the server hasn't been redeployed yet.
  const windowTotals = campaign.windowReports?.[window] ?? filteredDeliveries.reduce(
    (acc, d) => ({ leads: acc.leads + d.leadCount, revenue: acc.revenue + d.revenue, cost: acc.cost + d.cost }),
    { leads: 0, revenue: 0, cost: 0 },
  );

  // Supplier bar chart data
  const supplierData = campaign.suppliers.map((s) => ({
    name: s.name,
    cpl: s.cpl,
    leads: s.totalLeads,
    spend: s.totalSpend,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/campaigns">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1">
          <PageHeader
            title={campaign.name?.trim() || 'Untitled campaign'}
            description={buildSubtitle(campaign.clientName, campaign.vertical)}
          >
            <Badge className={`capitalize ${statusColors[campaign.status] || ''}`}>
              {campaign.status}
            </Badge>
          </PageHeader>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(campaign.totalRevenue)}
          icon={DollarSign}
          trend={{ value: `${campaign.margin}% margin`, positive: campaign.margin >= 40 }}
        />
        <StatCard
          label="Profit"
          value={formatCurrency(profit)}
          icon={TrendingUp}
          trend={{ value: formatCurrency(campaign.cpl) + ' CPL', positive: true }}
        />
        <StatCard
          label="Total Leads"
          value={campaign.totalLeads.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Leads This Week"
          value={campaign.leadsThisWeek.toLocaleString()}
          icon={Target}
          trend={{ value: `${campaign.leadsToday} today`, positive: campaign.leadsToday > 0 }}
        />
      </div>

      {/* Window selector */}
      <Tabs value={window} onValueChange={(v) => setWindow(v as DeliveryWindow)}>
        <TabsList className="flex-wrap gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Window totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-3 py-5"><CardContent><p className="text-xs text-muted-foreground">Leads</p><p className="mt-1 text-xl font-bold tabular-nums">{windowTotals.leads.toLocaleString()}</p></CardContent></Card>
        <Card className="gap-3 py-5"><CardContent><p className="text-xs text-muted-foreground">Revenue</p><p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(windowTotals.revenue)}</p></CardContent></Card>
        <Card className="gap-3 py-5"><CardContent><p className="text-xs text-muted-foreground">Cost</p><p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(windowTotals.cost)}</p></CardContent></Card>
      </div>

      {/* Sam #41 cost-per-lead editor + Slice 2 Day 1 buyer list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CostPerLeadCard campaignId={campaign.id} value={campaign.costPerLead} computedCpl={campaign.cpl} currency={campaign.currency} />
        <LinkedClientsCard campaignId={campaign.id} linkedClients={campaign.linkedClients} currency={campaign.currency} />
      </div>

      {/* Lead Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Volume</CardTitle>
          <CardDescription>{WINDOW_OPTIONS.find((o) => o.value === window)?.label} — daily lead deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] sm:h-[300px]">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No deliveries in this window</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Area type="monotone" dataKey="leads" stroke="#171717" fill="#171717" fillOpacity={0.15} name="Leads" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Buyer caps & delivery rules — Sam Loom 2026-05-15 */}
      <Card>
        <CardHeader>
          <CardTitle>Buyer caps &amp; delivery rules</CardTitle>
          <CardDescription>
            Per-buyer lead-flow ceilings configured in LeadByte. Read-only here — edit in LeadByte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveriesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !deliveries || deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No delivery rules configured for this campaign in LeadByte.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Day</TableHead>
                  <TableHead className="text-right">Week</TableHead>
                  <TableHead className="text-right">Month</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.buyer?.name ?? d.reference ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.status === 'Active' ? 'default' : 'secondary'}>
                        {d.status ?? 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.caps.day != null ? d.caps.day.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.caps.week != null ? d.caps.week.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.caps.month != null ? d.caps.month.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.caps.total != null ? d.caps.total.toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Revenue vs Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Cost</CardTitle>
          <CardDescription>Daily revenue and cost breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} className="text-muted-foreground" />
                <Tooltip formatter={(value) => [`£${Number(value).toFixed(2)}`, '']} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#171717" fill="#171717" fillOpacity={0.1} name="Revenue" />
                <Area type="monotone" dataKey="cost" stroke="#a3a3a3" fill="#a3a3a3" fillOpacity={0.1} name="Cost" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Supplier CPL Comparison */}
      {supplierData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier CPL Comparison</CardTitle>
            <CardDescription>Cost per lead by traffic source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} className="text-muted-foreground" />
                  <Tooltip formatter={(value) => [`£${Number(value).toFixed(2)}`, 'CPL']} />
                  <Bar dataKey="cpl" fill="#171717" radius={[0, 4, 4, 0]} name="CPL" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <TrafficSourcesCard campaignId={campaign.id} />
      <CreativesCard campaignId={campaign.id} />
    </div>
  );
}

// Sam Loom #42-46 — leadreports.io-style mapping table. Each row pins a
// supplier (Facebook/Google/Bing/TikTok/Taboola/Outbrain) → Catchr NCP URL
// and surfaces spend (Catchr), leads (LeadByte), CPL, revenue, net profit.

/**
 * The "Other" sentinel kept as an always-present fallback so manual URL
 * entry stays available even when Catchr lists every platform the user
 * has connected. Sam's 2026-05-15 Loom: prior hardcoded list missed
 * everything Catchr supports beyond the 6 we'd guessed, and used short
 * slugs that didn't match Catchr's filter values. We now read the live
 * platform list from Catchr; this constant is just the trailing escape
 * hatch.
 */
const OTHER_OPTION = { id: 'other', name: 'Other' } as const;

// Baseline supplier list, used when Catchr's connected-platforms response
// is empty (loading, timeout, transient probe failure, or a stale
// React-Query cache from before any platform was connected). Slugs match
// Catchr's canonical IDs so picking one here still drives the accounts
// fetch correctly the moment Catchr comes back. Sam, 2026-05-20: supplier
// dropdown showed only "Other" on the demo while /catchr/platforms was
// returning tik-tok connected:true; this fallback removes that dead-end.
const BASELINE_SUPPLIERS: Array<{ id: string; name: string }> = [
  { id: 'facebook-ads', name: 'Facebook Ads' },
  { id: 'google-ads', name: 'Google Ads' },
  { id: 'tik-tok', name: 'Tik Tok Ads' },
  { id: 'bing-ads', name: 'Bing Ads' },
  { id: 'taboola', name: 'Taboola' },
  { id: 'outbrain', name: 'Outbrain' },
];

function useSupplierOptions(): Array<{ id: string; name: string }> {
  const { data } = useCatchrPlatforms();
  const platforms = data?.platforms ?? [];
  // Connected platforms first (sorted by display name), then any baseline
  // platforms Catchr didn't surface, then the manual "Other" escape hatch.
  const connected = platforms
    .filter((p) => p.connected)
    .sort((a, b) => a.name.localeCompare(b.name));
  const connectedIds = new Set(connected.map((p) => p.id));
  const baselineExtras = BASELINE_SUPPLIERS.filter((p) => !connectedIds.has(p.id));
  return [...connected, ...baselineExtras, OTHER_OPTION];
}

/**
 * Replaces the old "paste a Catchr NCP URL" text input with a real dropdown
 * of the user's connected ad accounts for the chosen platform (Sam's
 * 2026-05-15 Loom — he demoed how leadreports.io picks accounts by name
 * from a list, vs. our previous setup which forced a hand-pasted URL).
 *
 * - When platform is one of the supported ones AND Catchr returns accounts,
 *   render a <select>.
 * - When Catchr isn't configured, the platform is "other", or the list is
 *   empty (no accounts connected on Catchr for this platform), fall back
 *   to a free-form text field so nobody is blocked.
 * - The value stored is the Catchr account id (goes into traffic_sources.
 *   account_id); the human label is shown in the dropdown.
 */
/**
 * Multi-select Catchr account picker — lets one traffic_source row roll up
 * spend from several Catchr accounts on the same platform. Renders a
 * search-filtered checkbox list. Falls through to the same manual-URL
 * input as the single-select picker when Catchr isn't configured or the
 * platform doesn't expose accounts.
 *
 * Selected IDs are stored as a string[] in `accountIds`. The first
 * picked account also drives the legacy `accountId` field on the row so
 * older code paths that read just `accountId` keep working.
 */
function CatchrMultiAccountPicker({
  platform,
  accountIds,
  manualUrl,
  onChangeAccounts,
  onChangeManualUrl,
}: {
  platform: string;
  accountIds: string[];
  manualUrl: string;
  onChangeAccounts: (ids: string[], primaryLabel: string) => void;
  onChangeManualUrl: (url: string) => void;
}) {
  const isKnownPlatform = platform && platform !== 'other';
  const { data, isLoading } = useCatchrAccounts(isKnownPlatform ? platform : undefined);
  const accounts = data?.accounts ?? [];
  // Optimistic during loading — `configured` defaulting to false made the
  // picker briefly flash "Catchr not configured" on the first open even
  // when Catchr was healthy. Only treat as not-configured once the
  // response explicitly says so.
  const configured = isLoading ? true : (data?.configured ?? false);
  const [search, setSearch] = useState('');

  const fallbackToManual = !isKnownPlatform || !configured || (!isLoading && accounts.length === 0);
  if (fallbackToManual) {
    return (
      <Input
        value={manualUrl}
        onChange={(e) => onChangeManualUrl(e.target.value)}
        placeholder={
          isLoading
            ? 'Loading accounts…'
            : !configured
              ? 'Catchr not configured — paste NCP URL'
              : platform === 'other'
                ? 'Paste a reference URL (optional)'
                : `No ${platform} accounts found in Catchr — paste NCP URL`
        }
      />
    );
  }

  const selectedSet = new Set(accountIds);
  const filtered = search.trim()
    ? accounts.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : accounts;

  const toggle = (id: string, name: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    const arr = Array.from(next);
    // Primary label is the first selected account's name — used to auto-
    // fill the row Name field when Sam hasn't typed one. Falls back to
    // the just-toggled name when the array is now empty.
    const primary = arr.length > 0 ? accounts.find((a) => a.id === arr[0])?.name ?? name : '';
    onChangeAccounts(arr, primary);
  };

  return (
    <div className="rounded-md border border-input bg-transparent text-sm shadow-sm">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${accounts.length} ${platform} accounts…`}
          className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 px-1"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {accountIds.length} selected
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {isLoading && <div className="px-2 py-3 text-xs text-muted-foreground">Loading accounts…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {search ? 'No accounts match this search.' : 'No accounts available.'}
          </div>
        )}
        {filtered.map((a) => {
          const checked = selectedSet.has(a.id);
          return (
            <label
              key={a.id}
              className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 ${checked ? 'bg-muted/30' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(a.id, a.name)}
                className="size-3.5"
              />
              <span className="flex-1 truncate">{a.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{a.id}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renders the Catchr NCP cell on the sources table. After saving, sources
 * have only an `accountId` (opaque Catchr id) — look up the human name via
 * the live Catchr accounts list. Falls back to the legacy `catchrUrl` for
 * any older rows still using the paste-URL flow, or "Not set" when neither
 * exists.
 */
function CatchrNcpCell({
  platform,
  accountId,
  accountIds,
  catchrUrl,
}: {
  platform: string;
  accountId: string;
  accountIds?: string[];
  catchrUrl: string | null;
}) {
  const { data } = useCatchrAccounts(platform && platform !== 'other' ? platform : undefined);
  // Union legacy single accountId + new accountIds[] from the BE so the
  // cell shows every Catchr account this source rolls up. Falls back to
  // an empty set if neither is populated — handled below.
  const ids = Array.from(new Set([
    ...(accountIds ?? []),
    ...(accountId ? [accountId] : []),
  ].filter(Boolean)));

  if (ids.length > 0) {
    const names = ids.map((id) => data?.accounts?.find((a) => a.id === id)?.name ?? id);
    return (
      <div className="flex flex-wrap gap-1 text-xs">
        {names.map((n, i) => (
          <span
            key={ids[i]}
            className="inline-flex items-center rounded bg-muted px-1.5 py-0.5"
            title={ids[i]}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  if (catchrUrl) {
    return (
      <a href={catchrUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline truncate">
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate">{catchrUrl}</span>
      </a>
    );
  }
  return <span className="text-xs">Not set</span>;
}

function TrafficSourcesCard({ campaignId }: { campaignId: string }) {
  const { data: sources, isLoading } = useTrafficSources(campaignId);
  const createSource = useCreateTrafficSource(campaignId);
  const deleteSource = useDeleteTrafficSource(campaignId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ad Account Links</CardTitle>
          <CardDescription>Linked Catchr ad accounts driving this campaign's cost</CardDescription>
        </CardHeader>
        <CardContent><Skeleton className="h-40" /></CardContent>
      </Card>
    );
  }

  const rows = sources ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + r.totalSpend,
      leads: acc.leads + r.totalLeads,
      revenue: acc.revenue + r.revenue,
      profit: acc.profit + r.netProfit,
    }),
    { spend: 0, leads: 0, revenue: 0, profit: 0 },
  );

  const handleDelete = async (sourceId: string, name: string) => {
    try {
      await deleteSource.mutateAsync(sourceId);
      toast.success(`Removed "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Ad Account Links</CardTitle>
            <CardDescription>
              {rows.length === 0
                ? 'Link Catchr ad accounts (Facebook / Google / etc) to this campaign. Only spend from linked accounts counts toward this campaign — unlinked accounts appear in the diagnostic on /campaigns.'
                : `${rows.length} source${rows.length === 1 ? '' : 's'} · spend ${formatCurrency(totals.spend)} · revenue ${formatCurrency(totals.revenue)} · profit ${formatCurrency(totals.profit)}`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus className="size-4 mr-1.5" />Add source
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Catchr NCP</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding && (
                <AddSourceRow
                  pending={createSource.isPending}
                  onSubmit={async (input) => {
                    try {
                      await createSource.mutateAsync(input);
                      toast.success(`Added "${input.name}"`);
                      setIsAdding(false);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Create failed');
                    }
                  }}
                  onCancel={() => setIsAdding(false)}
                />
              )}
              {rows.length === 0 && !isAdding && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    No traffic sources yet. Click <span className="font-medium">Add source</span> to map your first one.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((s) =>
                editingId === s.id ? (
                  <EditSourceRow
                    key={s.id}
                    campaignId={campaignId}
                    source={s}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">{s.platform || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[240px]">
                      <CatchrNcpCell
                        platform={s.platform}
                        accountId={s.accountId}
                        accountIds={s.accountIds}
                        catchrUrl={s.catchrUrl}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(s.totalSpend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.totalLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(s.cpl)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(s.revenue)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${s.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(s.netProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingId(s.id)} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id, s.name)} aria-label="Delete">
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AddSourceRow({
  pending, onSubmit, onCancel,
}: {
  pending: boolean;
  onSubmit: (input: { name: string; platform?: string; accountId?: string; accountIds?: string[]; catchrUrl?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const supplierOptions = useSupplierOptions();
  const [name, setName] = useState('');
  // Default to the first connected Catchr platform if any are loaded yet,
  // else 'other' so the manual-URL fallback shows immediately.
  const [platform, setPlatform] = useState<string>(() => supplierOptions[0]?.id ?? 'other');
  // Now an array — one source can roll up multiple Catchr accounts.
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [catchrUrl, setCatchrUrl] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    await onSubmit({
      name: name.trim(),
      platform,
      // Primary `accountId` mirrors the first selected — BE de-dupes so
      // passing both is safe and keeps legacy readers working.
      accountId: accountIds[0] || undefined,
      accountIds: accountIds.length > 0 ? accountIds : undefined,
      catchrUrl: catchrUrl.trim() || undefined,
    });
  };

  return (
    <TableRow className="bg-muted/40">
      <TableCell>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Facebook · Solar UK" autoFocus />
      </TableCell>
      <TableCell>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            // Switching platform invalidates the previously-picked accounts.
            setAccountIds([]);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {supplierOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </TableCell>
      <TableCell colSpan={5}>
        <CatchrMultiAccountPicker
          platform={platform}
          accountIds={accountIds}
          manualUrl={catchrUrl}
          onChangeAccounts={(ids, primaryLabel) => {
            setAccountIds(ids);
            // If the row name is still empty, auto-fill from the first
            // selected account so Sam doesn't have to retype the supplier name.
            if (!name.trim() && primaryLabel) setName(primaryLabel);
          }}
          onChangeManualUrl={setCatchrUrl}
        />
      </TableCell>
      <TableCell colSpan={2} className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditSourceRow({
  campaignId, source, onDone,
}: {
  campaignId: string;
  source: {
    id: string;
    name: string;
    platform: string;
    accountId?: string;
    accountIds?: string[];
    catchrUrl: string | null;
    totalSpend: number;
    totalLeads: number;
  };
  onDone: () => void;
}) {
  const supplierOptions = useSupplierOptions();
  const update = useUpdateTrafficSource(campaignId);
  const [name, setName] = useState(source.name);
  // Existing rows may carry a legacy short slug ('facebook') that's no
  // longer in the Catchr-driven options list. Fall back to 'other' so the
  // dropdown renders sensibly while still preserving the underlying value
  // unless the user changes it.
  const [platform, setPlatform] = useState(source.platform || 'other');
  // Seed multi-select with the union of the legacy single accountId + new
  // accountIds[] so editing an old row doesn't lose its selection.
  const [accountIds, setAccountIds] = useState<string[]>(() => {
    const ids = new Set<string>(source.accountIds ?? []);
    if (source.accountId) ids.add(source.accountId);
    return Array.from(ids);
  });
  const [catchrUrl, setCatchrUrl] = useState(source.catchrUrl ?? '');
  const [spend, setSpend] = useState(String(source.totalSpend));
  const [leads, setLeads] = useState(String(source.totalLeads));

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const spendNum = spend.trim() === '' ? 0 : Number(spend);
    const leadsNum = leads.trim() === '' ? 0 : Number(leads);
    if (!Number.isFinite(spendNum) || spendNum < 0 || !Number.isFinite(leadsNum) || leadsNum < 0) {
      toast.error('Spend and leads must be positive numbers');
      return;
    }
    try {
      await update.mutateAsync({
        sourceId: source.id,
        name: name.trim(),
        platform,
        accountId: accountIds[0] ?? '',
        accountIds,
        catchrUrl: catchrUrl.trim() === '' ? null : catchrUrl.trim(),
        totalSpend: spendNum,
        totalLeads: Math.floor(leadsNum),
      });
      toast.success(`Updated "${name}"`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <TableRow className="bg-muted/40">
      <TableCell>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </TableCell>
      <TableCell>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            // Different platform = different account list; previous picks are
            // for the wrong platform's accounts now.
            setAccountIds([]);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {supplierOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </TableCell>
      <TableCell>
        <CatchrMultiAccountPicker
          platform={platform}
          accountIds={accountIds}
          manualUrl={catchrUrl}
          onChangeAccounts={(ids) => setAccountIds(ids)}
          onChangeManualUrl={setCatchrUrl}
        />
      </TableCell>
      <TableCell>
        <Input type="number" min={0} step="0.01" value={spend} onChange={(e) => setSpend(e.target.value)} className="text-right tabular-nums" />
      </TableCell>
      <TableCell>
        <Input type="number" min={0} step={1} value={leads} onChange={(e) => setLeads(e.target.value)} className="text-right tabular-nums" />
      </TableCell>
      <TableCell colSpan={3} className="text-xs text-muted-foreground">
        CPL / revenue / profit auto-recompute on save.
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone} disabled={update.isPending}>Cancel</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreativesCard({ campaignId }: { campaignId: string }) {
  const { data: creatives = [], isLoading } = useCreatives(campaignId);
  const create = useCreateCreative(campaignId);
  const remove = useDeleteCreative(campaignId);

  // Buyer-review section picker (Sam #9/#11). Defaults to 'media' since that's
  // the common case (image + video). Switch to 'copy_lp' before uploading
  // ad copy or a landing-page URL — the buyer review tab renders the two
  // sections as separate cards.
  const [uploadSection, setUploadSection] = useState<'media' | 'copy_lp'>('media');

  const guessTypeFromContentType = (ct: string): 'image' | 'video' | 'text' => {
    if (ct.startsWith('image/')) return 'image';
    if (ct.startsWith('video/')) return 'video';
    return 'text';
  };

  const handleUploaded = async (result: PresignedUpload, file: File) => {
    try {
      await create.mutateAsync({
        name: file.name,
        type: guessTypeFromContentType(result.contentType),
        r2Key: result.key,
        fileUrl: result.downloadUrl, // Initial signed URL, refreshed via fetchFreshDownloadUrl on view.
        sizeBytes: result.sizeBytes,
        contentType: result.contentType,
        section: uploadSection,
      });
      toast.success(`Uploaded ${file.name} (${uploadSection === 'media' ? 'Media' : 'Copy / LP'})`);
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to upload creative');
    }
  };

  const handleView = async (key: string | null) => {
    if (!key) return;
    try {
      const url = await fetchFreshDownloadUrl('misc', key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to generate link');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.info('Removed (file kept in storage)');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to remove');
    }
  };

  const iconFor = (type: string) => {
    if (type === 'image') return ImageIcon;
    if (type === 'video') return Video;
    return FileText;
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Creatives</CardTitle>
            <CardDescription>
              Assets live on the <span className="font-medium">campaign</span> (this vertical) and are
              shared across every linked buyer. Each buyer approves their own copy on the
              <span className="font-medium"> Creatives</span> tab in their portal — IP + timestamp
              captured per decision for audit.
            </CardDescription>
          </div>
          <FileUpload folder="misc" maxSizeMB={50} label="Upload creative" onUploaded={handleUploaded} />
        </div>
        {/* Sam #9/#11 buyer-review section picker. Drives which card the
            upload appears under on the buyer's review tab. */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Upload to section:</span>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setUploadSection('media')}
              className={`rounded px-2.5 py-1 transition-colors ${uploadSection === 'media' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Media (image / video)
            </button>
            <button
              type="button"
              onClick={() => setUploadSection('copy_lp')}
              className={`rounded px-2.5 py-1 transition-colors ${uploadSection === 'copy_lp' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Copy &amp; landing page
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : creatives.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No creatives uploaded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {creatives.map((c) => {
              const Icon = iconFor(c.type);
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={c.name}>{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs capitalize mr-1.5">{c.type}</Badge>
                        <Badge variant="outline" className="text-xs mr-1.5">
                          {c.section === 'copy_lp' ? 'Copy / LP' : 'Media'}
                        </Badge>
                        v{c.version} · {c.sizeBytes ? `${(c.sizeBytes / 1024).toFixed(0)} KB · ` : ''}
                        {new Date(c.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleView(c.r2Key)} aria-label="View" disabled={!c.r2Key}>
                      <Download className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(c.id)} aria-label="Remove">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cost-per-lead editor (Sam #41) ─────────────────────────────────────────
function CostPerLeadCard({
  campaignId, value, computedCpl, currency,
}: {
  campaignId: string;
  value: number | null;
  computedCpl: number;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value) : '');
  const update = useUpdateCampaign(campaignId);

  const handleSave = async () => {
    const parsed = draft.trim() === '' ? null : Number(draft);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast.error('Enter a positive number (or leave blank to clear)');
      return;
    }
    try {
      await update.mutateAsync({ costPerLead: parsed });
      setEditing(false);
      toast.success(parsed != null ? `Cost per lead set to ${formatCurrency(parsed, currency)}` : 'Cost per lead cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cost per lead</CardTitle>
        <CardDescription>
          Manual supplier cost target. Distinct from the LeadByte-computed CPL of {formatCurrency(computedCpl, currency)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-bold tabular-nums">
              {value != null ? formatCurrency(value, currency) : <span className="text-muted-foreground text-base font-normal">Not set</span>}
            </p>
            <Button variant="outline" size="sm" onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true); }}>
              <Pencil className="size-4 mr-1.5" />Edit
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="max-w-[180px]"
            />
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Linked clients (Slice 2 Day 1 join table — Sam #40) ───────────────────
function LinkedClientsCard({
  campaignId, linkedClients, currency,
}: {
  campaignId: string;
  linkedClients: CampaignLinkedClient[];
  currency: string;
}) {
  const unlink = useUnlinkClientCampaign();
  const qc = useQueryClient();
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);

  const handleUnlink = async (clientId: string, clientName: string) => {
    try {
      await unlink.mutateAsync({ campaignId, clientId });
      // The campaign detail page reads from useCampaign(campaignId) — invalidate so
      // the buyer row disappears without a hard reload.
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success(`Removed ${clientName} from this campaign`);
    } catch (err) {
      logError('Unlink failed', err);
      toast.error('Could not remove buyer. They may still have open invoices on this campaign.');
    } finally {
      setConfirmUnlinkId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UsersIcon className="size-4" />
          Buyers
        </CardTitle>
        <CardDescription>
          {linkedClients.length === 0
            ? 'No buyers linked to this campaign yet.'
            : `${linkedClients.length} client${linkedClients.length !== 1 ? 's' : ''} buying leads on this vertical`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linkedClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clients are buying leads on this campaign yet. Open a client
            from the <Link to="/clients" className="font-medium underline underline-offset-2">Clients</Link> page
            and use the <span className="font-medium">Add campaign</span> button to link them here.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedClients.map((c) => (
              <div key={c.clientId} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <Link to={`/clients/${c.clientId}`} className="text-sm font-medium underline-offset-2 hover:underline">
                    {c.clientName}
                  </Link>
                  <p className="text-xs text-muted-foreground capitalize">{c.status}</p>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {c.leadPrice != null ? formatCurrency(c.leadPrice, c.currency || currency) : <span className="text-muted-foreground font-normal">—</span>}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <Button asChild variant="ghost" size="icon" className="size-7" title="Edit client">
                    <Link to={`/clients/${c.clientId}`} aria-label={`Edit ${c.clientName}`}>
                      <Pencil className="size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title="Remove from campaign"
                    onClick={() => setConfirmUnlinkId(c.clientId)}
                    disabled={unlink.isPending}
                    aria-label={`Remove ${c.clientName} from campaign`}
                  >
                    <Trash2 className="size-3.5 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {/* Confirmation — buyer-unlink is reversible (re-link from /clients/:id) but
          still warrants an explicit confirm because deliveries + revenue
          attribution will stop for this buyer on this vertical going forward. */}
      <Dialog open={!!confirmUnlinkId} onOpenChange={(open) => { if (!open) setConfirmUnlinkId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove buyer from campaign?</DialogTitle>
            <DialogDescription>
              This unlinks the buyer from this campaign. Lead deliveries + revenue
              attribution will stop counting for them on this vertical. The client
              record itself is not deleted — you can re-link from the client page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmUnlinkId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const c = linkedClients.find((lc) => lc.clientId === confirmUnlinkId);
                if (c) handleUnlink(c.clientId, c.clientName);
              }}
              disabled={unlink.isPending}
            >
              {unlink.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
