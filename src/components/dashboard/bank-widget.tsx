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
  const totalGBP = accounts.filter((a) => a.currency === 'GBP').reduce((sum, a) => sum + toMoney(a.balance), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bank Accounts</CardTitle>
            <CardDescription>Synced from Xero</CardDescription>
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
            {!configured ? 'Xero not connected. Configure XERO_CLIENT_ID + XERO_CLIENT_SECRET to see live balances.' : "Couldn't load balances from Xero. Check that the Custom Connection has accounting.reports.read scope."}
          </div>
        )}

        {!isLoading && configured && !isError && accounts.length === 0 && (
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
                {account.code && (
                  <p className="truncate text-xs text-muted-foreground">Code {account.code}</p>
                )}
              </div>
              <p className="ml-3 text-sm font-bold tabular-nums">
                {formatCurrency(toMoney(account.balance), account.currency)}
              </p>
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
