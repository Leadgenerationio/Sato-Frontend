import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUnlinkClientCampaign } from '@/lib/hooks/use-client-campaigns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, TrendingUp, TrendingDown, PoundSterling, Users, Target, ExternalLink,
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
import { fetchCreativeSignedUrl, useCreatives, useCreateCreative, useDeleteCreative, useSubmitCreative, type CreativeStatus } from '@/lib/hooks/use-creatives';
import { FileUpload } from '@/components/shared/file-upload';
import { type PresignedUpload } from '@/lib/hooks/use-uploads';
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

const statusPill = (s: string) => (s === 'active' ? 'pos' : s === 'paused' ? 'warn' : 'gray');

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
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-ic"><Icon className="size-5" /></span>
        {trend && (
          <span className={'kpi-delta ' + (trend.positive ? 'pos' : 'neg')}>
            {trend.positive ? <TrendingUp className="size-[13px]" /> : <TrendingDown className="size-[13px]" />}
            {trend.value}
          </span>
        )}
      </div>
      <div className="kpi-val mono">{value}</div>
      <div className="kpi-lab">{label}</div>
    </div>
  );
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id!);
  const { data: deliveries, isLoading: deliveriesLoading } = useCampaignDeliveries(id);
  const [window, setWindow] = useState<DeliveryWindow>('this_month');

  if (isLoading) {
    return (
      <div className="screen-page">
        <Skeleton className="h-8 w-64" />
        <div className="kpi-row">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="dash-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <p>Campaign not found</p>
        <Link to="/campaigns" className="btn b-ghost b-sm"><ArrowLeft className="size-4" />Back to campaigns</Link>
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
    <div className="screen-page">
      {/* Header */}
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <Link to="/campaigns" className="inv-open" title="Back to campaigns" style={{ marginTop: 6 }}>
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="ahead-title">{campaign.name?.trim() || 'Untitled campaign'}</h1>
            {buildSubtitle(campaign.clientName, campaign.vertical) && (
              <p className="ahead-sub">{buildSubtitle(campaign.clientName, campaign.vertical)}</p>
            )}
          </div>
        </div>
        <div className="page-actions">
          <span className={'pill p-' + statusPill(campaign.status)} style={{ textTransform: 'capitalize' }}>
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="kpi-row">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(campaign.totalRevenue)}
          icon={PoundSterling}
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
      <div className="seg" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
        {WINDOW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={'seg-btn' + (window === opt.value ? ' on' : '')}
            onClick={() => setWindow(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Window totals */}
      <div className="grid-3">
        <div className="card pad acard"><p className="ac-sub" style={{ marginTop: 0 }}>Leads</p><p className="kpi-val mono" style={{ fontSize: 24, marginTop: 6 }}>{windowTotals.leads.toLocaleString()}</p></div>
        <div className="card pad acard"><p className="ac-sub" style={{ marginTop: 0 }}>Revenue</p><p className="kpi-val mono" style={{ fontSize: 24, marginTop: 6 }}>{formatCurrency(windowTotals.revenue)}</p></div>
        <div className="card pad acard"><p className="ac-sub" style={{ marginTop: 0 }}>Cost</p><p className="kpi-val mono" style={{ fontSize: 24, marginTop: 6 }}>{formatCurrency(windowTotals.cost)}</p></div>
      </div>

      {/* Sam #41 cost-per-lead editor + Slice 2 Day 1 buyer list */}
      <div className="grid-2-1">
        <CostPerLeadCard campaignId={campaign.id} value={campaign.costPerLead} computedCpl={campaign.cpl} currency={campaign.currency} />
        <LinkedClientsCard campaignId={campaign.id} linkedClients={campaign.linkedClients} currency={campaign.currency} />
      </div>

      {/* Lead Volume Chart */}
      <div className="card pad acard">
        <div className="ac-head">
          <div><h3 className="statto-title">Lead Volume</h3><p className="ac-sub">{WINDOW_OPTIONS.find((o) => o.value === window)?.label} — daily lead deliveries</p></div>
        </div>
        <div style={{ height: 300 }}>
          {chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--fg2)' }}>No deliveries in this window</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="leads" stroke="var(--statto-ink)" fill="var(--statto-ink)" fillOpacity={0.15} name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Buyer caps & delivery rules — Sam Loom 2026-05-15 */}
      <div className="card pad acard">
        <div className="ac-head">
          <div>
            <h3 className="statto-title">Buyer caps &amp; delivery rules</h3>
            <p className="ac-sub">Per-buyer lead-flow ceilings configured in LeadByte. Read-only here — edit in LeadByte.</p>
          </div>
        </div>
        {deliveriesLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !deliveries || deliveries.length === 0 ? (
          <p className="ac-sub">No delivery rules configured for this campaign in LeadByte.</p>
        ) : (
          <div className="table-scroll">
            <table className="inv-table cmp-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th className="r">Day</th>
                  <th className="r">Week</th>
                  <th className="r">Month</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="cmp-name">{d.buyer?.name ?? d.reference ?? '—'}</td>
                    <td>
                      <span className={'pill p-' + (d.status === 'Active' ? 'pos' : 'gray')}>
                        {d.status ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="r mono inv-num">{d.caps.day != null ? d.caps.day.toLocaleString() : '—'}</td>
                    <td className="r mono inv-num">{d.caps.week != null ? d.caps.week.toLocaleString() : '—'}</td>
                    <td className="r mono inv-num">{d.caps.month != null ? d.caps.month.toLocaleString() : '—'}</td>
                    <td className="r mono inv-num">{d.caps.total != null ? d.caps.total.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revenue vs Cost Chart */}
      <div className="card pad acard">
        <div className="ac-head">
          <div><h3 className="statto-title">Revenue vs Cost</h3><p className="ac-sub">Daily revenue and cost breakdown</p></div>
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} />
              <Tooltip formatter={(value) => [`£${Number(value).toFixed(2)}`, '']} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="var(--statto-ink)" fill="var(--statto-ink)" fillOpacity={0.1} name="Revenue" />
              <Area type="monotone" dataKey="cost" stroke="var(--lime-500)" fill="var(--lime-500)" fillOpacity={0.1} name="Cost" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Supplier CPL Comparison */}
      {supplierData.length > 0 && (
        <div className="card pad acard">
          <div className="ac-head">
            <div><h3 className="statto-title">Supplier CPL Comparison</h3><p className="ac-sub">Cost per lead by traffic source</p></div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                <Tooltip formatter={(value) => [`£${Number(value).toFixed(2)}`, 'CPL']} />
                <Bar dataKey="cpl" fill="var(--statto-ink)" radius={[0, 4, 4, 0]} name="CPL" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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
      <input
        className="nc-input"
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
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: '#fff', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          className="nc-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${accounts.length} ${platform} accounts…`}
          style={{ border: 'none', boxShadow: 'none', height: 28, fontSize: 12, padding: '0 4px' }}
        />
        <span className="cmp-client" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
          {accountIds.length} selected
        </span>
      </div>
      <div style={{ maxHeight: 192, overflowY: 'auto' }}>
        {isLoading && <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--fg2)' }}>Loading accounts…</div>}
        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--fg2)' }}>
            {search ? 'No accounts match this search.' : 'No accounts available.'}
          </div>
        )}
        {filtered.map((a) => {
          const checked = selectedSet.has(a.id);
          return (
            <label
              key={a.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: 'pointer', background: checked ? 'var(--gray-50)' : undefined }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(a.id, a.name)}
                className="size-3.5"
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              <span className="mono cmp-lbid" style={{ fontSize: 10 }}>{a.id}</span>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {names.map((n, i) => (
          <span key={ids[i]} className="cmp-vpill" title={ids[i]}>{n}</span>
        ))}
      </div>
    );
  }
  if (catchrUrl) {
    return (
      <a href={catchrUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        <ExternalLink className="size-3 shrink-0" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catchrUrl}</span>
      </a>
    );
  }
  return <span style={{ fontSize: 12 }}>Not set</span>;
}

function TrafficSourcesCard({ campaignId }: { campaignId: string }) {
  const { data: sources, isLoading } = useTrafficSources(campaignId);
  const createSource = useCreateTrafficSource(campaignId);
  const deleteSource = useDeleteTrafficSource(campaignId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="card pad acard">
        <div className="ac-head">
          <div><h3 className="statto-title">Ad Account Links</h3><p className="ac-sub">Linked Catchr ad accounts driving this campaign's cost</p></div>
        </div>
        <Skeleton className="h-40" />
      </div>
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
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title">Ad Account Links</h3>
          <p className="ac-sub">
            {rows.length === 0
              ? 'Link Catchr ad accounts (Facebook / Google / etc) to this campaign. Only spend from linked accounts counts toward this campaign — unlinked accounts appear in the diagnostic on /campaigns.'
              : `${rows.length} source${rows.length === 1 ? '' : 's'} · spend ${formatCurrency(totals.spend)} · revenue ${formatCurrency(totals.revenue)} · profit ${formatCurrency(totals.profit)}`}
          </p>
        </div>
        <button className="btn b-primary b-sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="size-4" />Add source
        </button>
      </div>
      <div className="table-scroll">
        <table className="inv-table cmp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Supplier</th>
              <th>Catchr NCP</th>
              <th className="r">Spend</th>
              <th className="r">Leads</th>
              <th className="r">CPL</th>
              <th className="r">Revenue</th>
              <th className="r">Profit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
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
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--fg2)', padding: 32 }}>
                  No traffic sources yet. Click <span style={{ fontWeight: 600 }}>Add source</span> to map your first one.
                </td>
              </tr>
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
                <tr key={s.id}>
                  <td className="cmp-name">{s.name}</td>
                  <td>
                    <span className="cmp-vpill" style={{ textTransform: 'capitalize' }}>{s.platform || '—'}</span>
                  </td>
                  <td className="cmp-client" style={{ maxWidth: 240 }}>
                    <CatchrNcpCell
                      platform={s.platform}
                      accountId={s.accountId}
                      accountIds={s.accountIds}
                      catchrUrl={s.catchrUrl}
                    />
                  </td>
                  <td className="r mono inv-num">{formatCurrency(s.totalSpend)}</td>
                  <td className="r mono inv-num">{s.totalLeads.toLocaleString()}</td>
                  <td className="r mono inv-num">{formatCurrency(s.cpl)}</td>
                  <td className="r mono inv-total">{formatCurrency(s.revenue)}</td>
                  <td className={'r mono cmp-margin ' + (s.netProfit >= 0 ? 'm-pos' : 'm-neg')}>
                    {formatCurrency(s.netProfit)}
                  </td>
                  <td className="r">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button className="inv-open" onClick={() => setEditingId(s.id)} aria-label="Edit">
                        <Pencil className="size-4" />
                      </button>
                      <button className="inv-open" onClick={() => handleDelete(s.id, s.name)} aria-label="Delete">
                        <Trash2 className="size-4" style={{ color: 'var(--negative)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    <tr style={{ background: 'var(--gray-50)' }}>
      <td>
        <input className="nc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Facebook · Solar UK" autoFocus />
      </td>
      <td>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            // Switching platform invalidates the previously-picked accounts.
            setAccountIds([]);
          }}
          className="nc-select"
        >
          {supplierOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </td>
      <td colSpan={5}>
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
      </td>
      <td colSpan={2} className="r">
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button className="btn b-primary b-sm" onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          </button>
          <button className="btn b-ghost b-sm" onClick={onCancel} disabled={pending}>Cancel</button>
        </div>
      </td>
    </tr>
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
    <tr style={{ background: 'var(--gray-50)' }}>
      <td>
        <input className="nc-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </td>
      <td>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            // Different platform = different account list; previous picks are
            // for the wrong platform's accounts now.
            setAccountIds([]);
          }}
          className="nc-select"
        >
          {supplierOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </td>
      <td>
        <CatchrMultiAccountPicker
          platform={platform}
          accountIds={accountIds}
          manualUrl={catchrUrl}
          onChangeAccounts={(ids) => setAccountIds(ids)}
          onChangeManualUrl={setCatchrUrl}
        />
      </td>
      <td>
        <input className="nc-input r mono" type="number" min={0} step="0.01" value={spend} onChange={(e) => setSpend(e.target.value)} />
      </td>
      <td>
        <input className="nc-input r mono" type="number" min={0} step={1} value={leads} onChange={(e) => setLeads(e.target.value)} />
      </td>
      <td colSpan={3} className="cmp-client" style={{ fontSize: 12 }}>
        CPL / revenue / profit auto-recompute on save.
      </td>
      <td className="r">
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button className="btn b-primary b-sm" onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          </button>
          <button className="btn b-ghost b-sm" onClick={onDone} disabled={update.isPending}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

// T2 (Sam, 2026-05-20) — creative lifecycle pills + submit affordance.
// Colours match other lifecycle pills in the app (status badges on
// /campaigns, /clients) so the visual language stays consistent. Legacy
// rows without a status arrive as undefined → treated as already-submitted
// (the migration backfill default).
const STATUS_PILL: Record<CreativeStatus, { label: string; pill: string }> = {
  draft: { label: 'Draft', pill: 'gray' },
  sent_for_approval: { label: 'Sent', pill: 'infosoft' },
  approved: { label: 'Approved', pill: 'pos' },
  rejected: { label: 'Rejected', pill: 'neg' },
  changes_requested: { label: 'Changes requested', pill: 'warn' },
};

function statusPillFor(status: CreativeStatus | undefined) {
  return STATUS_PILL[status ?? 'sent_for_approval'];
}

function CreativesCard({ campaignId }: { campaignId: string }) {
  const { data: creatives = [], isLoading } = useCreatives(campaignId);
  const create = useCreateCreative(campaignId);
  const remove = useDeleteCreative(campaignId);
  const submit = useSubmitCreative(campaignId);

  const handleSubmit = async (id: string, name: string) => {
    try {
      await submit.mutateAsync(id);
      toast.success(`Sent "${name}" to the buyer for approval`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      // 409 = already submitted / wrong state — show it as an info, not an error.
      if (/409|state/i.test(message)) toast.info(message);
      else toast.error(message);
    }
  };

  // Buyer-review section picker (Sam #9/#11). Defaults to 'media' since that's
  // the common case (image + video). Switch to 'copy_lp' before uploading
  // ad copy or a landing-page URL — the buyer review tab renders the two
  // sections as separate cards.
  const [uploadSection, setUploadSection] = useState<'media' | 'copy_lp'>('media');

  // Sam (jam-video #3, 29-May-2026): "can't delete it" — admin needs a
  // confirm dialog before delete since portal is display-only and this is
  // the only place a mistaken upload can be removed.
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

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
        fileUrl: result.downloadUrl, // Initial signed URL, refreshed via fetchCreativeSignedUrl(id) on view.
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

  const handleView = async (id: string) => {
    try {
      // Server-resolved folder per row — works for both legacy misc/ uploads
      // and post-fix creatives/ uploads without the FE knowing which.
      const url = await fetchCreativeSignedUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to generate link');
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.info(`Removed "${confirmDelete.name}" (file kept in storage)`);
      setConfirmDelete(null);
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
    <div className="card pad acard">
      <div className="ac-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <h3 className="statto-title">Creatives</h3>
            <p className="ac-sub">
              Assets live on the <span style={{ fontWeight: 600 }}>campaign</span> (this vertical) and are
              shared across every linked buyer. Each buyer approves their own copy on the
              <span style={{ fontWeight: 600 }}> Creatives</span> tab in their portal — IP + timestamp
              captured per decision for audit.
            </p>
          </div>
          <FileUpload folder="creatives" maxSizeMB={50} label="Upload creative" onUploaded={handleUploaded} />
        </div>
        {/* Sam #9/#11 buyer-review section picker. Drives which card the
            upload appears under on the buyer's review tab. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span className="cmp-client">Upload to section:</span>
          <div className="seg" style={{ marginBottom: 0, display: 'inline-flex' }}>
            <button
              type="button"
              onClick={() => setUploadSection('media')}
              className={'seg-btn' + (uploadSection === 'media' ? ' on' : '')}
            >
              Media (image / video)
            </button>
            <button
              type="button"
              onClick={() => setUploadSection('copy_lp')}
              className={'seg-btn' + (uploadSection === 'copy_lp' ? ' on' : '')}
            >
              Copy &amp; landing page
            </button>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, border: '1px solid var(--border)', padding: 12 }}>
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="dash-empty">No creatives uploaded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {creatives.map((c) => {
            const Icon = iconFor(c.type);
            const pill = statusPillFor(c.status);
            const isDraft = c.status === 'draft';
            const canResubmit = c.status === 'changes_requested';
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: '1px solid var(--border)', padding: 12 }}>
                <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                  <span className="ac-ic" style={{ width: 36, height: 36 }}>
                    <Icon className="size-4" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="cmp-name" title={c.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p className="cmp-client" style={{ fontSize: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      <span className={'pill p-' + pill.pill}>{pill.label}</span>
                      <span className="cmp-type" style={{ textTransform: 'capitalize' }}>{c.type}</span>
                      <span className="cmp-type">{c.section === 'copy_lp' ? 'Copy / LP' : 'Media'}</span>
                      <span>
                        v{c.version} · {c.sizeBytes ? `${(c.sizeBytes / 1024).toFixed(0)} KB · ` : ''}
                        {new Date(c.uploadedAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
                  {(isDraft || canResubmit) && (
                    <button
                      className="btn b-primary b-sm"
                      onClick={() => handleSubmit(c.id, c.name)}
                      disabled={submit.isPending}
                    >
                      {canResubmit ? 'Re-submit' : 'Submit for approval'}
                    </button>
                  )}
                  <button className="inv-open" onClick={() => handleView(c.id)} aria-label="View">
                    <Download className="size-4" />
                  </button>
                  <button
                    className="inv-open"
                    onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sam (jam-video #3, 29-May-2026): confirm-before-delete. Portal is
          display-only so this is the only delete affordance — a mistaken
          click would otherwise pull the creative from every linked buyer
          with no recovery beyond DB inspection. */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete creative?</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium">{confirmDelete?.name}</span> from this campaign?
              The file stays in storage; the row is hidden from the campaign and from every linked
              buyer's portal. Past approval history is preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className="btn b-ghost b-sm" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
              Cancel
            </button>
            <button className="btn b-dark b-sm" onClick={handleConfirmRemove} disabled={remove.isPending}>
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete creative
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title">Cost per lead</h3>
          <p className="ac-sub">Manual supplier cost target. Distinct from the LeadByte-computed CPL of {formatCurrency(computedCpl, currency)}.</p>
        </div>
      </div>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <p className="kpi-val mono">
            {value != null ? formatCurrency(value, currency) : <span className="cmp-client" style={{ fontSize: 15, fontWeight: 400 }}>Not set</span>}
          </p>
          <button className="btn b-ghost b-sm" onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true); }}>
            <Pencil className="size-4" />Edit
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <input
            className="nc-input mono"
            type="number"
            min={0}
            step="0.01"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0.00"
            autoFocus
            style={{ maxWidth: 180 }}
          />
          <button className="btn b-primary b-sm" onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
          <button className="btn b-ghost b-sm" onClick={() => setEditing(false)} disabled={update.isPending}>
            Cancel
          </button>
        </div>
      )}
    </div>
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
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UsersIcon className="size-4" />
            Buyers
          </h3>
          <p className="ac-sub">
            {linkedClients.length === 0
              ? 'No buyers linked to this campaign yet.'
              : `${linkedClients.length} client${linkedClients.length !== 1 ? 's' : ''} buying leads on this vertical`}
          </p>
        </div>
      </div>
      {linkedClients.length === 0 ? (
        <p className="ac-sub">
          No clients are buying leads on this campaign yet. Open a client
          from the <Link to="/clients" style={{ fontWeight: 600, textDecoration: 'underline' }}>Clients</Link> page
          and use the <span style={{ fontWeight: 600 }}>Add campaign</span> button to link them here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {linkedClients.map((c) => (
            <div key={c.clientId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 12, border: '1px solid var(--border)', padding: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link to={`/clients/${c.clientId}`} className="cmp-name" style={{ textDecoration: 'none' }}>
                  {c.clientName}
                </Link>
                <p className="cmp-client" style={{ fontSize: 12, textTransform: 'capitalize' }}>{c.status}</p>
              </div>
              <p className="mono inv-total" style={{ fontSize: 14 }}>
                {c.leadPrice != null ? formatCurrency(c.leadPrice, c.currency || currency) : <span className="cmp-client" style={{ fontWeight: 400 }}>—</span>}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Link to={`/clients/${c.clientId}`} className="inv-open" title="Edit client" aria-label={`Edit ${c.clientName}`}>
                  <Pencil className="size-3.5" />
                </Link>
                <button
                  className="inv-open"
                  title="Remove from campaign"
                  onClick={() => setConfirmUnlinkId(c.clientId)}
                  disabled={unlink.isPending}
                  aria-label={`Remove ${c.clientName} from campaign`}
                >
                  <Trash2 className="size-3.5" style={{ color: 'var(--negative)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
            <button className="btn b-ghost b-sm" onClick={() => setConfirmUnlinkId(null)}>Cancel</button>
            <button
              className="btn b-dark b-sm"
              onClick={() => {
                const c = linkedClients.find((lc) => lc.clientId === confirmUnlinkId);
                if (c) handleUnlink(c.clientId, c.clientName);
              }}
              disabled={unlink.isPending}
            >
              {unlink.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
