import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt } from 'lucide-react';
import { api, unwrap } from '@/lib/api';

interface QuarterBlock {
  fromDate: string;
  toDate: string;
  label?: string;
  owed?: string;
  collectedOnSales?: string;
  paidOnPurchases?: string;
  error?: string;
}

interface VatLiabilityResponse {
  configured: boolean;
  currency?: string;
  stagger?: 1 | 2 | 3;
  previousQuarter?: QuarterBlock;
  currentQuarter?: QuarterBlock;
}

function toMoney(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

function formatRange(block: QuarterBlock): string {
  if (block.label) return block.label;
  const fromYear = new Date(`${block.fromDate}T00:00:00Z`).getUTCFullYear();
  const toYear = new Date(`${block.toDate}T00:00:00Z`).getUTCFullYear();
  if (fromYear === toYear) {
    const fromMonth = new Date(`${block.fromDate}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short' });
    const toMonth = new Date(`${block.toDate}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short' });
    return `${fromMonth} – ${toMonth} ${toYear}`;
  }
  return `${formatMonth(block.fromDate)} – ${formatMonth(block.toDate)}`;
}

export function VatWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['xero', 'vat-liability'],
    queryFn: async () => {
      const res = await api.get<VatLiabilityResponse>('/api/v1/integrations/xero/vat-liability');
      return unwrap(res);
    },
    refetchInterval: 30 * 60_000,
  });

  const currency = data?.currency ?? 'GBP';
  const prev = data?.previousQuarter;
  const curr = data?.currentQuarter;
  const prevOwed = toMoney(prev?.owed);
  const currOwed = toMoney(curr?.owed);

  const prevIsOwed = prevOwed >= 0;
  const anyError = !!(prev?.error || curr?.error);
  // Both zeroed with no error usually means the Xero org isn't VAT-registered.
  const notVatRegistered =
    !!data?.configured && !anyError &&
    prevOwed === 0 && currOwed === 0 &&
    toMoney(prev?.collectedOnSales) === 0 && toMoney(curr?.collectedOnSales) === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">VAT Liability</CardTitle>
            <CardDescription>HMRC quarter view, live from Xero</CardDescription>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${prevIsOwed ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
            <Receipt className={`size-5 ${prevIsOwed ? 'text-amber-600' : 'text-emerald-600'}`} />
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

        {!isLoading && data?.configured && anyError && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Couldn't load VAT report from Xero. Make sure the Custom Connection has the{' '}
            <code className="rounded bg-muted px-1 text-xs">accounting.reports.read</code> scope.
          </div>
        )}

        {!isLoading && data?.configured && !anyError && notVatRegistered && (
          <div className="rounded-lg border border-dashed py-6 text-center">
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              {formatCurrency(0, currency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              No VAT registration on this Xero organisation.
            </p>
          </div>
        )}

        {!isLoading && data?.configured && !anyError && !notVatRegistered && prev && curr && (
          <>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Due to HMRC</p>
                <p className="text-xs text-muted-foreground">{formatRange(prev)}</p>
              </div>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${prevIsOwed ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatCurrency(Math.abs(prevOwed), currency)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {prevIsOwed ? 'Owed for the closed quarter' : 'Refund due for the closed quarter'}
              </p>
            </div>

            <Separator />

            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Accruing now</p>
                <p className="text-xs text-muted-foreground">{formatRange(curr)}</p>
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCurrency(Math.abs(currOwed), currency)}
              </p>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Sales VAT</span>
                <span className="tabular-nums">{formatCurrency(toMoney(curr.collectedOnSales), currency)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Purchase VAT</span>
                <span className="tabular-nums">-{formatCurrency(toMoney(curr.paidOnPurchases), currency)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
