import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ExternalLink, Sparkles, TrendingUp } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';
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
// date window + supplier (substring) + campaign (substring).

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
  const [window, setWindow] = useState<DeliveryWindow>('this_month');
  const [supplierInput, setSupplierInput] = useState('');
  const [campaignInput, setCampaignInput] = useState('');
  const supplier = useDebounce(supplierInput, 250);
  const campaign = useDebounce(campaignInput, 250);

  const { data, isLoading, error, refetch } = useUnifiedReport({ window, supplier, campaign });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="One unified view — revenue from LeadByte, cost from Catchr, profit + margin per supplier."
      >
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
          <Sparkles className="size-3 mr-1" />New
        </Badge>
      </PageHeader>

      {/* Window selector */}
      <Tabs value={window} onValueChange={(v) => setWindow(v as DeliveryWindow)}>
        <TabsList className="flex-wrap gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={supplierInput}
            onChange={(e) => setSupplierInput(e.target.value)}
            placeholder="Filter by supplier (e.g. facebook, google)"
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={campaignInput}
            onChange={(e) => setCampaignInput(e.target.value)}
            placeholder="Filter by campaign / vertical"
            className="pl-9"
          />
        </div>
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
          />
          <TotalCard
            label="Margin"
            value={`${totals.margin}%`}
            valueClassName={
              totals.margin >= 50 ? 'text-emerald-600' :
              totals.margin >= 30 ? 'text-amber-600' : 'text-red-600'
            }
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
                    <th className="py-2.5 px-3 font-medium text-right">Spend</th>
                    <th className="py-2.5 px-3 font-medium text-right">CPL</th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 pl-3 pr-4 font-medium text-right">Margin</th>
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
                        <div className="truncate" title={r.clientName}>{r.clientName}</div>
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
                      <td colSpan={5} className="py-3 pl-4 pr-3">Totals · {window.replace('_', ' ')}</td>
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
        <Card>
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
                    <th className="py-2.5 px-3 font-medium text-right">Spend</th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-3 font-medium text-right">Profit</th>
                    <th className="py-2.5 pl-3 pr-4 font-medium text-right">Margin</th>
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
    </div>
  );
}

function TotalCard({
  label, value, fullValue, valueClassName,
}: {
  label: string;
  value: string;
  fullValue?: string;
  valueClassName?: string;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
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
