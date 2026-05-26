import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ExternalLink, Info, Sparkles, TrendingUp } from 'lucide-react';

// Shared explanation for the cost-concept column tooltips. "Spend" on this
// report is Catchr ad-spend (what Sam pays Meta / Google / TikTok / Taboola
// for the media buy). It is NOT the LeadByte supplier payout (what Sam pays
// third-party lead-sellers — that's £0 on most rows because the campaigns
// are direct-traffic). LeadReports.io exposes the LB-payout view, which is
// why its Cost/Margin numbers are smaller than Stato's. Both are correct
// for what they measure; this tooltip is the disambiguation.
const SPEND_HINT =
  'Catchr ad spend — what you pay Meta / Google / TikTok / Taboola for the media buy. Does NOT include LeadByte supplier payouts (different cost concept).';
const MARGIN_HINT =
  'Margin = (Revenue − Spend) / Revenue. Spend uses Catchr ad spend only — so the % reflects ad-cost efficiency, not LeadByte supplier payouts.';
import {
  useUnifiedReport,
  WINDOW_OPTIONS,
  type DeliveryWindow,
  type UnifiedReportRow,
} from '@/lib/hooks/use-reports';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

// Sam Loom #72-85 — the unified leadreports.io-style report. One row per
// (campaign × supplier). Sum of row revenue = campaign revenue. Filters:
// date window + supplier (dropdown) + campaign (dropdown). Sam, 2026-05-20
// asked for explicit dropdowns instead of free-text inputs so the picker
// always shows the exact values the report contains. We fetch the window
// unfiltered, derive option lists from the rows, and apply supplier +
// campaign filters client-side so the totals strip stays consistent with
// the visible table.

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

// Tile-friendly currency: integer pounds below 1M, compact ("£4.2M") at/above.
// The full precise value goes into the tooltip on the tile so nothing is lost.
// Exported for unit tests — the 1M threshold is a magic number worth locking in.
export function formatTileCurrency(value: number, currency = 'GBP') {
  if (Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(value);
}

export function formatTileNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return value.toLocaleString();
}

export function UnifiedReportPage() {
  // Renamed from `window` to avoid shadowing the DOM global. The prior
  // name worked thanks to React function scoping, but `window.replace(...)`
  // in JSX (lines below) reads ambiguously, lint-flags as a global shadow,
  // and breaks under stricter no-shadow/no-redeclare configs (OCT-44).
  const [reportWindow, setReportWindow] = useState<DeliveryWindow>('this_month');
  const [supplier, setSupplier] = useState('');
  const [campaign, setCampaign] = useState('');

  // Fetch unfiltered for the window — supplier + campaign filters now apply
  // client-side so the option lists below stay stable as you pick (otherwise
  // selecting "facebook" would collapse the supplier dropdown to just
  // "facebook" on the next render).
  const { data, isLoading, error, refetch } = useUnifiedReport({ window: reportWindow });

  const allRows = data?.rows ?? [];

  // Option lists drawn from the full window — sorted alphabetically so the
  // dropdown order doesn't shuffle as data refreshes. Suppliers de-duped
  // case-insensitively because LeadByte returns inconsistent casing.
  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>(); // lowercased → display
    for (const r of allRows) {
      if (!r.supplier) continue;
      const key = r.supplier.toLowerCase();
      if (!seen.has(key)) seen.set(key, r.supplier);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const campaignOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) if (r.campaignName) seen.add(r.campaignName);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const rows = useMemo(() => {
    if (!supplier && !campaign) return allRows;
    const sLower = supplier.toLowerCase();
    return allRows.filter((r) => {
      if (supplier && r.supplier.toLowerCase() !== sLower) return false;
      if (campaign && r.campaignName !== campaign) return false;
      return true;
    });
  }, [allRows, supplier, campaign]);

  // Recompute totals from the filtered rows so the totals strip always
  // matches the visible table. When no filter is applied this matches the
  // server totals exactly (same row set).
  const totals = useMemo(() => {
    if (rows.length === 0) return undefined;
    const leads = rows.reduce((s, r) => s + r.leads, 0);
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const profit = revenue - spend;
    const margin = revenue > 0 ? Math.round(((revenue - spend) / revenue) * 1000) / 10 : 0;
    return { leads, spend, revenue, profit, margin };
  }, [rows]);

  // Group rows by campaign for the breakdown view at the bottom — Sam's
  // mental model is "Solar Panels with 3 suppliers, here are the per-supplier
  // numbers". The main table shows the flat per-row view (leadreports.io
  // shape); this gives the at-a-glance per-vertical aggregate.
  const byCampaign = useMemo(() => {
    const map = new Map<string, { name: string; vertical: string; rows: UnifiedReportRow[] }>();
    for (const r of rows) {
      const existing = map.get(r.campaignName);
      if (existing) existing.rows.push(r);
      else map.set(r.campaignName, { name: r.campaignName, vertical: r.vertical, rows: [r] });
    }
    return Array.from(map.values()).sort((a, b) => {
      const aRev = a.rows.reduce((s, r) => s + r.revenue, 0);
      const bRev = b.rows.reduce((s, r) => s + r.revenue, 0);
      return bRev - aRev;
    });
  }, [rows]);

  // Sam (2026-05-15 meeting #10) — "By source · profitability". Roll the
  // per-(campaign × supplier) rows up to one row per platform (Facebook,
  // Google Ads, TikTok, Taboola, Direct, Bing, etc) — same shape Sam sees on
  // LeadReports.io. We aggregate CLIENT-SIDE off the already-filtered `rows`
  // so the table tracks the supplier + campaign dropdowns above; backend
  // sends a `byPlatform` array too but we ignore it here so a filter never
  // produces a roll-up that disagrees with the visible main-table totals.
  const bySource = useMemo(() => {
    const map = new Map<string, { platform: string; catchrUrl: string | null; leads: number; spend: number; revenue: number }>();
    for (const r of rows) {
      const key = r.supplierPlatform || 'Unknown';
      const existing = map.get(key);
      if (existing) {
        existing.leads += r.leads;
        existing.spend += r.spend;
        existing.revenue += r.revenue;
        // First-write-wins on the Catchr URL — matches the BE convention.
        if (!existing.catchrUrl && r.catchrUrl) existing.catchrUrl = r.catchrUrl;
      } else {
        map.set(key, {
          platform: key,
          catchrUrl: r.catchrUrl,
          leads: r.leads,
          spend: r.spend,
          revenue: r.revenue,
        });
      }
    }
    return Array.from(map.values())
      .map((b) => {
        const profit = b.revenue - b.spend;
        const margin = b.revenue > 0 ? Math.round(((b.revenue - b.spend) / b.revenue) * 1000) / 10 : 0;
        const cpl = b.leads > 0 ? Math.round((b.spend / b.leads) * 100) / 100 : 0;
        return { ...b, profit, margin, cpl };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="One unified view — revenue from LeadByte, cost from Catchr ad spend (NOT LeadByte supplier payout), profit + margin per supplier."
      >
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
          <Sparkles className="size-3 mr-1" />New
        </Badge>
      </PageHeader>

      {/* Window selector */}
      <Tabs value={reportWindow} onValueChange={(v) => setReportWindow(v as DeliveryWindow)}>
        <TabsList className="flex-wrap gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters — dropdowns drawn from the unfiltered window so the option
          lists stay stable while picking. Both default to "All". */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterSelect
          value={supplier}
          onChange={setSupplier}
          allLabel={`All suppliers${supplierOptions.length ? ` (${supplierOptions.length})` : ''}`}
          options={supplierOptions}
          disabled={isLoading || supplierOptions.length === 0}
        />
        <FilterSelect
          value={campaign}
          onChange={setCampaign}
          allLabel={`All campaigns${campaignOptions.length ? ` (${campaignOptions.length})` : ''}`}
          options={campaignOptions}
          disabled={isLoading || campaignOptions.length === 0}
        />
      </div>

      {/* Totals strip */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <TotalCard
            label="Leads"
            value={formatTileNumber(totals.leads)}
            fullValue={totals.leads.toLocaleString()}
          />
          <TotalCard
            label="Spend"
            value={formatTileCurrency(totals.spend)}
            fullValue={formatCurrency(totals.spend)}
            hint={SPEND_HINT}
          />
          <TotalCard
            label="Revenue"
            value={formatTileCurrency(totals.revenue)}
            fullValue={formatCurrency(totals.revenue)}
          />
          <TotalCard
            label="Profit"
            value={formatTileCurrency(totals.profit)}
            fullValue={formatCurrency(totals.profit)}
            valueClassName={totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
            hint={MARGIN_HINT}
          />
          <TotalCard
            label="Margin"
            value={`${totals.margin}%`}
            valueClassName={
              totals.margin >= 50 ? 'text-emerald-600' :
              totals.margin >= 30 ? 'text-amber-600' : 'text-red-600'
            }
            hint={MARGIN_HINT}
          />
        </div>
      )}

      {/* Main table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {rows.length === 0 ? 'No matching rows' : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
          </CardTitle>
          <CardDescription>
            One row per (campaign × supplier). Revenue allocated by lead share — sum across
            suppliers equals each campaign's total.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Couldn't load report" error={error} onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title={supplier || campaign ? 'No matches for these filters' : 'No data for this window'}
              description={
                supplier || campaign
                  ? 'Try widening or clearing the supplier / campaign filters.'
                  : 'LeadByte returned nothing for this window. Try a wider window or wait for the next hourly sync.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2.5 pl-4 pr-3 font-medium">Campaign</th>
                    <th className="py-2.5 px-3 font-medium">Vertical</th>
                    <th className="py-2.5 px-3 font-medium">Client</th>
                    <th className="py-2.5 px-3 font-medium">Supplier</th>
                    <th className="py-2.5 px-3 font-medium">Catchr NCP</th>
                    <th className="py-2.5 px-3 font-medium text-right">Leads</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Spend
                        <span title={SPEND_HINT} aria-label={SPEND_HINT} className="cursor-help">
                          <Info className="h-3 w-3" />
                        </span>
                      </span>
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">CPL</th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 pl-3 pr-4 font-medium text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Margin
                        <span title={MARGIN_HINT} aria-label={MARGIN_HINT} className="cursor-help">
                          <Info className="h-3 w-3" />
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.campaignName}-${r.supplier}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 pl-4 pr-3 font-medium max-w-[180px]">
                        <div className="truncate" title={r.campaignName}>{r.campaignName}</div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className="text-xs">{r.vertical}</Badge>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground max-w-[160px]">
                        {/* OCT-42: render multi-buyer rows as "Multiple (N)" with all names in the tooltip. */}
                        {(() => {
                          const names = r.clientNames && r.clientNames.length > 0 ? r.clientNames : [r.clientName];
                          if (names.length <= 1) {
                            return <div className="truncate" title={names[0]}>{names[0]}</div>;
                          }
                          return (
                            <div className="truncate cursor-help" title={names.join('\n')}>
                              Multiple ({names.length})
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm">{r.supplier}</span>
                        {r.supplierPlatform && (
                          <Badge variant="outline" className="text-xs ml-1.5 capitalize">{r.supplierPlatform}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {r.catchrUrl ? (
                          <a
                            href={r.catchrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                            title={r.catchrUrl}
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            <span>Linked</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not linked</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">{r.leads.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(r.spend)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(r.cpl)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(r.revenue)}</td>
                      <td className={`py-3 px-3 text-right tabular-nums font-medium ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(r.profit)}
                      </td>
                      <td className={`py-3 pl-3 pr-4 text-right tabular-nums font-medium ${
                        r.margin >= 50 ? 'text-emerald-600' :
                        r.margin >= 30 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {r.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                    <tr>
                      <td colSpan={5} className="py-3 pl-4 pr-3">Totals · {reportWindow.replace('_', ' ')}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{totals.leads.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(totals.spend)}</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(totals.revenue)}</td>
                      <td className={`py-3 px-3 text-right tabular-nums ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(totals.profit)}
                      </td>
                      <td className={`py-3 pl-3 pr-4 text-right tabular-nums ${
                        totals.margin >= 50 ? 'text-emerald-600' :
                        totals.margin >= 30 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {totals.margin}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By-campaign roll-up (mental-model affordance for Sam) */}
      {byCampaign.length > 1 && (
        <Card data-testid="by-campaign-rollup">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By campaign · roll-up</CardTitle>
            <CardDescription>
              Same numbers, aggregated per campaign so you can scan the verticals quickly.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2.5 pl-4 pr-3 font-medium">Campaign</th>
                    <th className="py-2.5 px-3 font-medium">Vertical</th>
                    <th className="py-2.5 px-3 font-medium text-right">Suppliers</th>
                    <th className="py-2.5 px-3 font-medium text-right">Leads</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Spend
                        <span title={SPEND_HINT} aria-label={SPEND_HINT} className="cursor-help">
                          <Info className="h-3 w-3" />
                        </span>
                      </span>
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 pl-3 pr-4 font-medium text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Margin
                        <span title={MARGIN_HINT} aria-label={MARGIN_HINT} className="cursor-help">
                          <Info className="h-3 w-3" />
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byCampaign.map((g) => {
                    const subLeads = g.rows.reduce((s, r) => s + r.leads, 0);
                    const subSpend = g.rows.reduce((s, r) => s + r.spend, 0);
                    const subRevenue = g.rows.reduce((s, r) => s + r.revenue, 0);
                    const subProfit = subRevenue - subSpend;
                    const subMargin = subRevenue > 0 ? Math.round(((subRevenue - subSpend) / subRevenue) * 1000) / 10 : 0;
                    return (
                      <tr key={g.name} className="border-b last:border-0">
                        <td className="py-3 pl-4 pr-3 font-medium max-w-[200px]">
                          <Link to={`/campaigns?search=${encodeURIComponent(g.name)}`} className="underline-offset-2 hover:underline">
                            <span className="truncate" title={g.name}>{g.name}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-3"><Badge variant="secondary" className="text-xs">{g.vertical}</Badge></td>
                        <td className="py-3 px-3 text-right tabular-nums">{g.rows.length}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{subLeads.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(subSpend)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(subRevenue)}</td>
                        <td className={`py-3 px-3 text-right tabular-nums font-medium ${subProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(subProfit)}
                        </td>
                        <td className={`py-3 pl-3 pr-4 text-right tabular-nums font-medium ${
                          subMargin >= 50 ? 'text-emerald-600' :
                          subMargin >= 30 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {subMargin}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By-source roll-up — Sam (2026-05-15 meeting #10): "Facebook spend →
          Facebook profit / margin" — same rows summed across campaigns so the
          per-platform performance is one scan away. Match the per-(campaign ×
          supplier) tooltips above so the cost-concept disambiguation is
          identical everywhere. */}
      {bySource.length > 0 && (
        <Card data-testid="by-source-rollup">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By source · profitability</CardTitle>
            <CardDescription>
              Aggregated per platform — same numbers, summed across campaigns so you can
              scan source-level performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2.5 pl-4 pr-3 font-medium">Platform</th>
                    <th className="py-2.5 px-3 font-medium">Catchr NCP</th>
                    <th className="py-2.5 px-3 font-medium text-right">Leads</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Spend
                        <span title={SPEND_HINT} aria-label={SPEND_HINT} className="cursor-help">
                          <Info className="h-3 w-3" />
                        </span>
                      </span>
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">CPL</th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 pl-3 pr-4 font-medium text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Margin
                        <span title={MARGIN_HINT} aria-label={MARGIN_HINT} className="cursor-help">
                          <Info className="h-3 w-3" />
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((p) => (
                    <tr key={p.platform} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 pl-4 pr-3 font-medium capitalize">{p.platform}</td>
                      <td className="py-3 px-3">
                        {p.catchrUrl ? (
                          <a
                            href={p.catchrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                            title={p.catchrUrl}
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            <span>Linked</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not linked</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">{p.leads.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(p.spend)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(p.cpl)}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className={`py-3 px-3 text-right tabular-nums font-medium ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(p.profit)}
                      </td>
                      <td className={`py-3 pl-3 pr-4 text-right tabular-nums font-medium ${
                        p.margin >= 50 ? 'text-emerald-600' :
                        p.margin >= 30 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {p.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                    <tr>
                      <td colSpan={2} className="py-3 pl-4 pr-3">Totals · {reportWindow.replace('_', ' ')}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{totals.leads.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(totals.spend)}</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(totals.revenue)}</td>
                      <td className={`py-3 px-3 text-right tabular-nums ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(totals.profit)}
                      </td>
                      <td className={`py-3 pl-3 pr-4 text-right tabular-nums ${
                        totals.margin >= 50 ? 'text-emerald-600' :
                        totals.margin >= 30 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {totals.margin}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterSelect({
  value, onChange, allLabel, options, disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  allLabel: string;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
    </div>
  );
}

function TotalCard({
  label, value, fullValue, valueClassName, hint,
}: {
  label: string;
  value: string;
  fullValue?: string;
  valueClassName?: string;
  /** Optional clarification shown as a native tooltip on a small Info icon next to the label. */
  hint?: string;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {label}
          {hint && (
            <span title={hint} aria-label={hint} className="cursor-help">
              <Info className="h-3 w-3" />
            </span>
          )}
        </p>
        <p
          className={`mt-1 text-xl font-bold tabular-nums whitespace-nowrap ${valueClassName ?? ''}`}
          title={fullValue ?? value}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
