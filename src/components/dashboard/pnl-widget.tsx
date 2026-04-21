import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown } from 'lucide-react';

const MOCK_PNL = {
  revenue: 38420.00,
  costs: 16280.00,
  profit: 22140.00,
  revenueTrend: 12.4,
  costTrend: 3.1,
  profitTrend: 18.6,
  period: 'Apr 2026 MTD',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {positive ? '+' : ''}{value}%
    </span>
  );
}

export function PnlWidget() {
  const { revenue, costs, profit, revenueTrend, costTrend, profitTrend, period } = MOCK_PNL;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">P&L Summary</CardTitle>
            <CardDescription>{period}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Revenue</span>
          <div className="flex items-center gap-2">
            <TrendBadge value={revenueTrend} />
            <span className="text-sm font-medium tabular-nums">{formatCurrency(revenue)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Costs</span>
          <div className="flex items-center gap-2">
            <TrendBadge value={-costTrend} />
            <span className="text-sm font-medium tabular-nums">-{formatCurrency(costs)}</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Profit</span>
          <div className="flex items-center gap-2">
            <TrendBadge value={profitTrend} />
            <span className="text-base font-bold tabular-nums text-emerald-600">{formatCurrency(profit)}</span>
          </div>
        </div>

        {/* Margin bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Margin</span>
            <span>{Math.round((profit / revenue) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(profit / revenue) * 100}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
