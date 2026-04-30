import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { api, unwrap } from '@/lib/api';

interface PnlSummary {
  fromDate: string;
  toDate: string;
  currency: string;
  revenue: string;
  fixedCosts: string;
  oneOffCosts: string;
  adSpend: string;
  totalCosts: string;
  netProfit: string;
  margin: string; // "0..1" fraction
  uncategorisedCount: number;
}

function toMoney(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function PnlWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'pnl-summary', 30],
    queryFn: async () => {
      const res = await api.get<PnlSummary>('/api/v1/reports/pnl-summary?days=30');
      return unwrap(res);
    },
    refetchInterval: 10 * 60_000, // 10 min
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">P&amp;L Summary</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">P&amp;L Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-sm text-muted-foreground">Couldn&apos;t load P&amp;L data.</p>
        </CardContent>
      </Card>
    );
  }

  const revenue = toMoney(data.revenue);
  const fixed = toMoney(data.fixedCosts);
  const oneOff = toMoney(data.oneOffCosts);
  const adSpend = toMoney(data.adSpend);
  const totalCosts = toMoney(data.totalCosts);
  const netProfit = toMoney(data.netProfit);
  const margin = parseFloat(data.margin) || 0;
  const isPositive = netProfit >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">P&amp;L Summary</CardTitle>
            <CardDescription>
              {formatDate(data.fromDate)} – {formatDate(data.toDate)}
            </CardDescription>
          </div>
          {data.uncategorisedCount > 0 && (
            <Link to="/finance/bank-feed?uncategorized=true">
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="size-3" />
                {data.uncategorisedCount} uncategorised
              </Badge>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Net profit headline */}
        <div className="text-center">
          <p className={`text-3xl font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit, data.currency)}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            Net profit · {(margin * 100).toFixed(1)}% margin
          </p>
        </div>

        <Separator />

        {/* Revenue */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Revenue (paid invoices)</span>
          <span className="font-medium tabular-nums text-emerald-600">
            +{formatCurrency(revenue, data.currency)}
          </span>
        </div>

        {/* Three cost buckets */}
        <div className="space-y-1.5 rounded-md border border-border/50 bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fixed costs</span>
            <span className="font-medium tabular-nums text-red-600">
              -{formatCurrency(fixed, data.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">One-off costs</span>
            <span className="font-medium tabular-nums text-red-600">
              -{formatCurrency(oneOff, data.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ad spend</span>
            <span className="font-medium tabular-nums text-red-600">
              -{formatCurrency(adSpend, data.currency)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-medium">
            <span>Total costs</span>
            <span className="tabular-nums">-{formatCurrency(totalCosts, data.currency)}</span>
          </div>
        </div>

        {/* Margin bar */}
        {revenue > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Margin</span>
              <span>{(margin * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, Math.abs(margin) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
