import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Landmark } from 'lucide-react';
import { api, unwrap } from '@/lib/api';

interface XeroBankAccount {
  accountId: string;
  name: string;
  code: string | null;
  currency: string;
  balance: string;
  balanceDate: string | null;
  unreconciledLines: number | null;
}

function formatAsOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
}

interface BankAccountsResponse {
  configured: boolean;
  accounts: XeroBankAccount[];
  error?: string;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function toMoney(s: string | number): number {
  if (typeof s === 'number') return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function BankWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['xero', 'bank-accounts'],
    queryFn: async () => {
      const res = await api.get<BankAccountsResponse>('/api/v1/integrations/xero/bank-accounts');
      return unwrap(res);
    },
    refetchInterval: 5 * 60_000, // refresh every 5 min — Xero balances aren't realtime
  });

  const accounts = data?.accounts ?? [];
  const configured = data?.configured ?? false;
  const apiError = data?.error ?? null;
  const totalGBP = accounts.filter((a) => a.currency === 'GBP').reduce((sum, a) => sum + toMoney(a.balance), 0);

  // Translate the upstream Xero error so Sam doesn't read "No active bank
  // accounts" and think Stato lost his account — the actual reason the
  // accounts list is empty is the API call itself failed (most commonly 429
  // rate-limit). The /integrations card now flips to "Degraded" with the
  // same message; we mirror it here so the dashboard widget agrees.
  function explainApiError(err: string): string {
    if (err.includes('429') || err.toLowerCase().includes('rate')) {
      return 'Xero is rate-limited right now (HTTP 429). Bank balances refresh within ~60s — try again shortly. No action needed unless this persists for 10+ minutes.';
    }
    if (err.toLowerCase().includes('finance') || err.toLowerCase().includes('scope')) {
      return "Xero rejected the request — check that the Custom Connection has finance.statements.read scope (Finance API must be enabled on the app).";
    }
    return `Xero returned an error: ${err}`;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bank Accounts</CardTitle>
            <CardDescription>Statement balance · live from Xero</CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Landmark className="size-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {!isLoading && (isError || !configured) && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            {!configured ? 'Xero is not connected. Once an administrator finishes the Xero Custom Connection setup, your live balances will appear here.' : "Couldn't load balances from Xero. Check that the Custom Connection has finance.statements.read scope (Finance API must be enabled on the app)."}
          </div>
        )}

        {!isLoading && configured && !isError && accounts.length === 0 && apiError && (
          <div className="rounded-lg border border-warning/30 bg-warning-bg py-6 px-4 text-center text-sm text-warning dark:border-warning/40 dark:bg-warning/10 dark:text-warning">
            {explainApiError(apiError)}
          </div>
        )}

        {!isLoading && configured && !isError && accounts.length === 0 && !apiError && (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            No active bank accounts in Xero.
          </div>
        )}

        {!isLoading && accounts.map((account, i) => (
          <div key={account.accountId}>
            {i > 0 && <Separator className="mb-3" />}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.balanceDate ? `Statement balance · as of ${formatAsOf(account.balanceDate)}` : account.code ? `Code ${account.code}` : 'Statement balance'}
                </p>
              </div>
              <div className="ml-3 text-right">
                <p className="text-sm font-bold tabular-nums">
                  {formatCurrency(toMoney(account.balance), account.currency)}
                </p>
                {account.unreconciledLines !== null && account.unreconciledLines > 0 && (
                  <p className="text-[10px] text-muted-foreground">{account.unreconciledLines} unreconciled</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {!isLoading && accounts.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total (GBP)</p>
              <p className="text-base font-bold tabular-nums">{formatCurrency(totalGBP)}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
