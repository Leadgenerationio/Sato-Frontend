import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt } from 'lucide-react';
import { api, unwrap } from '@/lib/api';

// Sam Loom #7-12: VAT widget shows TWO numbers — the most-recently-completed
// quarter's total liability (the headline number Sam files with HMRC) AND
// the currently-running quarter accruing so far. Empty Xero org / non-VAT
// company still renders cleanly.

interface VatPeriod {
  fromDate?: string;
  toDate?: string;
  label?: string;
  owed?: string;
  collectedOnSales?: string;
  paidOnPurchases?: string;
  error?: string;
}

interface VatLiabilityResponse {
  configured: boolean;
  currency?: string;
  current?: VatPeriod;
  past?: VatPeriod;
}

function toMoney(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function VatWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['xero', 'vat-liability'],
    queryFn: async () => {
      const res = await api.get<VatLiabilityResponse>('/api/v1/integrations/xero/vat-liability');
      return unwrap(res);
    },
    refetchInterval: 30 * 60_000, // refresh every 30 min
  });

  const currency = data?.currency ?? 'GBP';
  const current = data?.current;
  const past = data?.past;
  const currentOwed = toMoney(current?.owed);
  const pastOwed = toMoney(past?.owed);

  // If both periods report £0 across the board, the Xero org likely isn't
  // VAT-registered — render the friendly empty state instead of three £0s.
  const notVatRegistered = !!data?.configured && !current?.error && !past?.error
    && currentOwed === 0 && pastOwed === 0
    && toMoney(current?.collectedOnSales) === 0 && toMoney(past?.collectedOnSales) === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">VAT Liability</CardTitle>
            <CardDescription>Past + current quarter from Xero</CardDescription>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${pastOwed >= 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
            <Receipt className={`size-5 ${pastOwed >= 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!isLoading && data && !data.configured && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Xero not connected. Configure XERO_CLIENT_ID + XERO_CLIENT_SECRET to see VAT owed.
          </div>
        )}

        {!isLoading && data?.configured && (current?.error || past?.error) && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Couldn't load VAT report from Xero. Make sure the Custom Connection has the <code className="rounded bg-muted px-1 text-xs">accounting.reports.read</code> scope.
          </div>
        )}

        {!isLoading && data?.configured && !current?.error && !past?.error && notVatRegistered && (
          <div className="rounded-lg border border-dashed py-6 text-center">
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              {formatCurrency(0, currency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              No VAT registration on this Xero organisation.
            </p>
          </div>
        )}

        {!isLoading && data?.configured && !current?.error && !past?.error && !notVatRegistered && (
          <>
            <PeriodRow
              label={past?.label ?? 'Last quarter'}
              sub="Due to HMRC"
              amount={pastOwed}
              currency={currency}
              emphasised
            />
            <Separator />
            <PeriodRow
              label={current?.label ?? 'This quarter'}
              sub="Accruing so far"
              amount={currentOwed}
              currency={currency}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PeriodRow({
  label, sub, amount, currency, emphasised,
}: {
  label: string;
  sub: string;
  amount: number;
  currency: string;
  emphasised?: boolean;
}) {
  const positive = amount >= 0;
  return (
    <div className="flex items-baseline justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <p
        className={`tabular-nums font-bold ${emphasised ? 'text-2xl' : 'text-lg'} ${positive ? 'text-amber-600' : 'text-emerald-600'}`}
      >
        {formatCurrency(Math.abs(amount), currency)}
      </p>
    </div>
  );
}
