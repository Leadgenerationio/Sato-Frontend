import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt } from 'lucide-react';
import { api, unwrap } from '@/lib/api';

interface VatLiabilityResponse {
  configured: boolean;
  fromDate?: string;
  toDate?: string;
  owed?: string;
  collectedOnSales?: string;
  paidOnPurchases?: string;
  currency?: string;
  error?: string;
}

function toMoney(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const owed = toMoney(data?.owed);
  const collected = toMoney(data?.collectedOnSales);
  const paid = toMoney(data?.paidOnPurchases);
  const currency = data?.currency ?? 'GBP';
  const isOwed = owed >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">VAT Liability</CardTitle>
            <CardDescription>
              {data?.fromDate
                ? `Since end of last quarter (${formatDate(data.fromDate)})`
                : 'Live from Xero'}
            </CardDescription>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${isOwed ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
            <Receipt className={`size-5 ${isOwed ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-32 mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}

        {!isLoading && data && !data.configured && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Xero not connected. Configure XERO_CLIENT_ID + XERO_CLIENT_SECRET to see VAT owed.
          </div>
        )}

        {!isLoading && data?.configured && data.error && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Couldn't load VAT report from Xero. Make sure the Custom Connection has the <code className="rounded bg-muted px-1 text-xs">accounting.reports.read</code> scope.
          </div>
        )}

        {!isLoading && data?.configured && !data.error && (
          <>
            <div className="text-center">
              <p className={`text-3xl font-bold tabular-nums ${isOwed ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatCurrency(Math.abs(owed), currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isOwed ? 'Owed to HMRC' : 'Refund due'}
              </p>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collected on sales</span>
                <span className="font-medium tabular-nums">{formatCurrency(collected, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid on purchases</span>
                <span className="font-medium tabular-nums">-{formatCurrency(paid, currency)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
