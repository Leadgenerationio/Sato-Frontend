import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, ChevronDown, ChevronUp } from 'lucide-react';
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
  /** Sam Loom #12 — past quarters, newest-first. Only present when the widget
   *  asks for ?history=N (the expanded view). */
  history?: QuarterBlock[];
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

const HISTORY_COUNT = 4;

export function VatWidget() {
  // Sam Loom #12 — history is lazy-fetched only when the user expands the
  // "Past quarters" disclosure. Keeps the default dashboard mount cheap (no
  // 5 extra Xero TaxSummary calls per page load).
  const [showHistory, setShowHistory] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['xero', 'vat-liability', showHistory ? HISTORY_COUNT : 0],
    queryFn: async () => {
      const qs = showHistory ? `?history=${HISTORY_COUNT}` : '';
      const res = await api.get<VatLiabilityResponse>(`/api/v1/integrations/xero/vat-liability${qs}`);
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
          <div className={`flex size-10 items-center justify-center rounded-lg ${prevIsOwed ? 'bg-warning/10' : 'bg-positive/10'}`}>
            <Receipt className={`size-5 ${prevIsOwed ? 'text-warning' : 'text-positive'}`} />
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
            Xero is not connected. Once an administrator finishes the Xero Custom Connection setup, your VAT figures will appear here.
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
            <p className="text-2xl font-bold tabular-nums text-positive">
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
              <p className={`mt-1 text-3xl font-bold tabular-nums ${prevIsOwed ? 'text-warning' : 'text-positive'}`}>
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

            <Separator />

            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Past quarters</span>
              {showHistory ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {showHistory && (
              <div className="space-y-1">
                {data.history === undefined || data.history.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2 text-center">No earlier quarters on file.</p>
                ) : (
                  data.history.map((h) => (
                    <div key={`${h.fromDate}-${h.toDate}`} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{formatRange(h)}</span>
                      {h.error ? (
                        <span className="text-warning">unavailable</span>
                      ) : (
                        <span className="tabular-nums font-medium">{formatCurrency(Math.abs(toMoney(h.owed)), currency)}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
