import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Receipt, AlertTriangle } from 'lucide-react';

const MOCK_VAT = {
  vatCollected: 14820.40,
  vatPaid: 6340.20,
  netLiability: 8480.20,
  vatReserveBalance: 18200.00,
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

export function VatWidget() {
  const { vatCollected, vatPaid, netLiability, vatReserveBalance } = MOCK_VAT;
  const surplus = vatReserveBalance - netLiability;
  const hasShortfall = surplus < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">VAT Tracker</CardTitle>
            <CardDescription>Q1 2026 estimate</CardDescription>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${hasShortfall ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            <Receipt className={`size-5 ${hasShortfall ? 'text-red-600' : 'text-emerald-600'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT Collected</span>
            <span className="font-medium tabular-nums">{formatCurrency(vatCollected)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT Paid (input)</span>
            <span className="font-medium tabular-nums">-{formatCurrency(vatPaid)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="font-medium">Net Liability</span>
            <span className="font-bold tabular-nums">{formatCurrency(netLiability)}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT Reserve Balance</span>
            <span className="font-medium tabular-nums">{formatCurrency(vatReserveBalance)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{hasShortfall ? 'Shortfall' : 'Surplus'}</span>
            <div className="flex items-center gap-2">
              {hasShortfall && <AlertTriangle className="size-3.5 text-red-600" />}
              <span className={`font-bold tabular-nums ${hasShortfall ? 'text-red-600' : 'text-emerald-600'}`}>
                {hasShortfall ? '-' : '+'}{formatCurrency(Math.abs(surplus))}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Coverage</span>
            <span>{Math.min(Math.round((vatReserveBalance / netLiability) * 100), 999)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hasShortfall ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((vatReserveBalance / netLiability) * 100, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
