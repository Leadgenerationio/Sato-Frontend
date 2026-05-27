import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Users, FileText, AlertTriangle, CheckCircle2, BarChart3, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalDashboard } from '@/lib/hooks/use-portal';
import { EmptyState } from '@/components/shared/empty-state';

function formatCurrency(value: number, currency = 'GBP') {
  // Defensive: Intl.NumberFormat throws RangeError on a malformed currency
  // code (empty string, wrong length, non-letters). ad_spend.currency comes
  // from Catchr and isn't guaranteed clean — an unguarded throw here crashed
  // the whole managed-client dashboard in production (2026-05-27). Fall back
  // to GBP formatting, then to a plain number, so a bad code can never take
  // the page down. The backend also sanitises, but the UI must be crash-proof
  // regardless of what it's handed.
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
  } catch {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
    } catch {
      return value.toFixed(2);
    }
  }
}

// Sum ad-spend rows into one total per currency, preserving the (spend-desc)
// order the API already returned — first-seen currency wins. Never sums
// across currencies.
function totalsByCurrency(
  rows: { spend: number; currency: string }[],
): { currency: string; total: number }[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!totals.has(r.currency)) order.push(r.currency);
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.spend);
  }
  return order.map((currency) => ({ currency, total: totals.get(currency)! }));
}

function StatCard({
  label, value, icon: Icon, badge, href,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  badge?: { text: string; variant: 'default' | 'destructive' | 'secondary' };
  href?: string;
}) {
  const card = (
    <Card className={`gap-3 py-5 ${href ? 'transition-colors hover:bg-accent/40 cursor-pointer' : ''}`}>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          {badge && <Badge variant={badge.variant} className="text-xs">{badge.text}</Badge>}
        </div>
        <div className="mt-3">
          <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg" aria-label={`${label} — view details`}>
      {card}
    </Link>
  );
}

export function PortalDashboardPage() {
  const { data, isLoading } = usePortalDashboard();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const chartData = data.recentLeads.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    leads: d.leads,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{data.companyName}</h1>
          {data.clientType === 'managed' && (
            <Badge variant="secondary" className="text-xs">Managed</Badge>
          )}
        </div>
        <p className="text-muted-foreground">Client Portal</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Campaigns" value={String(data.activeCampaigns)} icon={Megaphone} href="/portal/leads" />
        <StatCard label="Leads This Month" value={data.totalLeadsThisMonth.toLocaleString()} icon={Users} href="/portal/leads" />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data.totalOutstanding)}
          icon={FileText}
          badge={data.overdueInvoices > 0 ? { text: `${data.overdueInvoices} overdue`, variant: 'destructive' } : undefined}
          href="/portal/invoices"
        />
        <StatCard
          label="Agreement"
          value={data.agreementSigned ? 'Signed' : 'Pending'}
          icon={data.agreementSigned ? CheckCircle2 : AlertTriangle}
          badge={{ text: data.agreementSigned ? 'Active' : 'Action needed', variant: data.agreementSigned ? 'secondary' : 'destructive' }}
          href="/portal/agreement"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Lead Deliveries</CardTitle>
          <CardDescription>Last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 || chartData.every((d) => d.leads === 0) ? (
            <EmptyState
              icon={BarChart3}
              title="No lead deliveries yet"
              description="Once leads are delivered against your campaigns, you'll see daily volumes here."
            />
          ) : (
            <div className="h-[180px] sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#171717" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad spend — managed clients only. PPL clients never render this block,
          so there's no behaviour change for them. Per-platform, current month,
          consistent with the "Leads This Month" window above. */}
      {data.clientType === 'managed' && (
        <Card>
          <CardHeader>
            <CardTitle>Ad Spend</CardTitle>
            <CardDescription>By platform · this month</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.adSpendByPlatform || data.adSpendByPlatform.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No ad spend this month"
                description="Once ad spend is recorded against your campaigns this month, the per-platform breakdown will appear here."
              />
            ) : (
              <div className="divide-y">
                {data.adSpendByPlatform.map((row) => (
                  <div key={`${row.platform}-${row.currency}`} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">{row.platform}</span>
                    <span className="text-sm font-medium tabular-nums">{formatCurrency(row.spend, row.currency)}</span>
                  </div>
                ))}
                {/* Totals per currency — a client running ads in more than one
                    currency gets one Total line each, since spend in different
                    currencies can't be summed into a single figure. The common
                    single-currency case renders exactly one "Total" line. */}
                {totalsByCurrency(data.adSpendByPlatform).map(({ currency, total }) => (
                  <div key={currency} className="flex items-center justify-between pt-2.5 font-semibold">
                    <span className="text-sm">Total</span>
                    <span className="text-sm tabular-nums">{formatCurrency(total, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
