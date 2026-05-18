import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, ExternalLink, TrendingUp } from 'lucide-react';
import { useUnifiedReport, type UnifiedReportRow, type DeliveryWindow } from '@/lib/hooks/use-reports';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';

// Sam (2026-05-15 meeting #10): "Master at the top + per-source profitability
// row — the Facebook spend → Facebook profit / margin row that
// leadreports.io shows." This widget rolls /reports/unified rows up to one
// row per source platform and pins them at the top of the dashboard so the
// hero ad-spend → profit number is the first thing visible.

export interface PlatformAggregate {
  platform: string;
  leads: number;
  spend: number;
  revenue: number;
  profit: number;
  /** Whole-number percentage, 1 decimal place. */
  margin: number;
}

export interface AggregateResult {
  rows: PlatformAggregate[];
  totals: PlatformAggregate;
}

/**
 * Pure aggregator — bucket UnifiedReport rows by supplierPlatform, sum the
 * money fields, compute profit + margin, sort by spend desc.
 *
 * Exported for unit-testing without rendering the whole widget.
 */
export function aggregateByPlatform(rows: UnifiedReportRow[]): AggregateResult {
  const grouped = new Map<string, PlatformAggregate>();
  let tLeads = 0;
  let tSpend = 0;
  let tRevenue = 0;

  for (const r of rows) {
    const key = r.supplierPlatform || 'unknown';
    const existing = grouped.get(key) ?? {
      platform: key,
      leads: 0,
      spend: 0,
      revenue: 0,
      profit: 0,
      margin: 0,
    };
    existing.leads += r.leads;
    existing.spend += r.spend;
    existing.revenue += r.revenue;
    grouped.set(key, existing);
    tLeads += r.leads;
    tSpend += r.spend;
    tRevenue += r.revenue;
  }

  // Finalise per-row profit + margin in one pass after summation.
  const finalised = Array.from(grouped.values()).map((g) => ({
    ...g,
    profit: g.revenue - g.spend,
    margin: g.revenue > 0
      ? Math.round(((g.revenue - g.spend) / g.revenue) * 1000) / 10
      : 0,
  }));

  finalised.sort((a, b) => b.spend - a.spend);

  return {
    rows: finalised,
    totals: {
      platform: 'all',
      leads: tLeads,
      spend: tSpend,
      revenue: tRevenue,
      profit: tRevenue - tSpend,
      margin: tRevenue > 0
        ? Math.round(((tRevenue - tSpend) / tRevenue) * 1000) / 10
        : 0,
    },
  };
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function marginColor(margin: number): string {
  if (margin >= 50) return 'text-emerald-600';
  if (margin >= 30) return 'text-amber-600';
  return 'text-red-600';
}

function profitColor(profit: number): string {
  return profit >= 0 ? 'text-emerald-600' : 'text-red-600';
}

const WIDGET_WINDOWS: { value: DeliveryWindow; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
];

/**
 * Presentational shell — accepts already-aggregated data plus loading/error
 * state. Split out from the container so render tests can drive each branch
 * without spinning up React Query.
 */
export function PerformanceBySourceTable({
  isLoading,
  error,
  aggregate,
  onRetry,
}: {
  isLoading: boolean;
  error: unknown;
  aggregate: AggregateResult | null;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <ErrorState title="Couldn't load performance data" error={error} onRetry={onRetry} />;
  }
  if (!aggregate || aggregate.rows.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No traffic-source activity in this window yet"
        description="Spend syncs hourly from Catchr; revenue from LeadByte. Once the next sync finishes, this widget fills in."
        link={{ label: 'View detailed report', to: '/reports', icon: ExternalLink }}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2.5 pl-4 pr-3 font-medium">Platform</th>
            <th className="py-2.5 px-3 font-medium text-right">Leads</th>
            <th className="py-2.5 px-3 font-medium text-right">Spend</th>
            <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
            <th className="py-2.5 px-3 font-medium text-right">Profit</th>
            <th className="py-2.5 pl-3 pr-4 font-medium text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {aggregate.rows.map((r) => (
            <tr key={r.platform} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-3 pl-4 pr-3 font-medium capitalize">{r.platform.replace(/-/g, ' ')}</td>
              <td className="py-3 px-3 text-right tabular-nums">{r.leads.toLocaleString()}</td>
              <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(r.spend)}</td>
              <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(r.revenue)}</td>
              <td className={`py-3 px-3 text-right tabular-nums font-medium ${profitColor(r.profit)}`}>
                {formatCurrency(r.profit)}
              </td>
              <td className={`py-3 pl-3 pr-4 text-right tabular-nums font-medium ${marginColor(r.margin)}`}>
                {r.margin}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/30 text-sm font-semibold">
          <tr>
            <td className="py-3 pl-4 pr-3">Totals</td>
            <td className="py-3 px-3 text-right tabular-nums">{aggregate.totals.leads.toLocaleString()}</td>
            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(aggregate.totals.spend)}</td>
            <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(aggregate.totals.revenue)}</td>
            <td className={`py-3 px-3 text-right tabular-nums ${profitColor(aggregate.totals.profit)}`}>
              {formatCurrency(aggregate.totals.profit)}
            </td>
            <td className={`py-3 pl-3 pr-4 text-right tabular-nums ${marginColor(aggregate.totals.margin)}`}>
              {aggregate.totals.margin}%
            </td>
          </tr>
        </tfoot>
      </table>
      <div className="flex justify-end p-3">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          View detailed report <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Container widget — owns the window selector + the React Query call,
 * delegates rendering to PerformanceBySourceTable.
 */
export function PerformanceBySourceWidget() {
  const [window, setWindow] = useState<DeliveryWindow>('this_month');
  const { data, isLoading, error, refetch } = useUnifiedReport({ window });
  const aggregate = useMemo(
    () => (data ? aggregateByPlatform(data.rows) : null),
    [data],
  );
  const windowLabel = WIDGET_WINDOWS.find((w) => w.value === window)?.label ?? '';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Performance by source · {windowLabel}</CardTitle>
            <CardDescription>
              Catchr ad-spend × LeadByte revenue, rolled up per platform.
            </CardDescription>
          </div>
          <select
            value={window}
            onChange={(e) => setWindow(e.target.value as DeliveryWindow)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            aria-label="Window"
          >
            {WIDGET_WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <PerformanceBySourceTable
          isLoading={isLoading}
          error={error}
          aggregate={aggregate}
          onRetry={() => refetch()}
        />
      </CardContent>
    </Card>
  );
}
