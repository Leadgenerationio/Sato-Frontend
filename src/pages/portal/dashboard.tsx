import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Users, FileText, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalDashboard } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency } from '@/lib/currency';

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
  usePageTitle('Stato — Dashboard');
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
            <div className="h-[180px] sm:h-[250px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#062F28" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
