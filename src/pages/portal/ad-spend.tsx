import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Lock } from 'lucide-react';
import { usePortalDashboard } from '@/lib/hooks/use-portal';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, totalsByCurrency } from '@/lib/currency';

// Dedicated Ad Spend tab. Ad spend is a managed-client feature only — PPL
// clients shouldn't reach here (the nav item is hidden for them), but if one
// does (typed URL / stale link) we show a clear "not available" state rather
// than an empty page. Data is the per-platform MTD breakdown from the portal
// dashboard payload (shared react-query cache — no extra round trip when the
// dashboard has already loaded).
export function PortalAdSpendPage() {
  const { data, isLoading } = usePortalDashboard();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (data.clientType !== 'managed') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Ad Spend</h1>
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={Lock}
              title="Ad spend isn't available on your plan"
              description="Ad spend reporting is included for managed accounts. Contact your account manager if you'd like to enable it."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data.adSpendByPlatform ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ad Spend</h1>
        <p className="text-muted-foreground">By platform · this month</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spend by platform</CardTitle>
          <CardDescription>Current month to date</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No ad spend this month"
              description="Once ad spend is recorded against your campaigns this month, the per-platform breakdown will appear here."
            />
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div key={`${row.platform}-${row.currency}`} className="flex items-center justify-between py-2.5">
                  <span className="text-sm">{row.platform}</span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(row.spend, row.currency)}</span>
                </div>
              ))}
              {/* One Total line per currency — spend in different currencies
                  can't be summed into a single figure. */}
              {totalsByCurrency(rows).map(({ currency, total }) => (
                <div key={currency} className="flex items-center justify-between pt-2.5 font-semibold">
                  <span className="text-sm">Total</span>
                  <span className="text-sm tabular-nums">{formatCurrency(total, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
