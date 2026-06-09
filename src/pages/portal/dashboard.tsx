import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Megaphone, Users, FileText, AlertTriangle, CheckCircle2, BarChart3,
  ShieldCheck, ScrollText, UserCog, ArrowUpRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalDashboard, type PortalAdSpendPlatform } from '@/lib/hooks/use-portal';
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
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted">
            <Icon className="size-5 text-foreground" />
          </div>
          {badge && <Badge variant={badge.variant} className="text-xs">{badge.text}</Badge>}
        </div>
        <div className="mt-3">
          <p className="truncate text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">{value}</p>
          <p className="mt-1.5 truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link to={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${label} — view details`}>
      {card}
    </Link>
  );
}

// Statto brand dots for the ad-spend platform rows (ink → lime → green → grey).
// The leading "ink" entry flips to a light tone in dark mode so the first
// platform's dot/bar stays visible on the dark-green card.
function AdSpendByPlatform({ platforms, totalLeads }: { platforms: PortalAdSpendPlatform[]; totalLeads: number }) {
  const { resolvedTheme } = useTheme();
  const ink = resolvedTheme === 'dark' ? '#EAF3EF' : '#062F28';
  const palette = [ink, '#9FE870', '#6E9089', '#84D451', '#A9A9AF', '#123F36'];
  const total = platforms.reduce((s, p) => s + p.spend, 0);
  const max = Math.max(...platforms.map((p) => p.spend), 1);
  const avgCpl = totalLeads > 0 ? total / totalLeads : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ad Spend by Platform</CardTitle>
        <CardDescription>This month · across {platforms.length} platform{platforms.length === 1 ? '' : 's'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
          {/* Summary */}
          <div className="flex flex-col gap-1 md:border-r md:border-border md:pr-6">
            <span className="text-sm text-muted-foreground">Total ad spend</span>
            <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">{formatCurrency(total)}</span>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">{totalLeads.toLocaleString()} leads</span>
              {avgCpl > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{formatCurrency(Math.round(avgCpl))} avg CPL</span>
                </>
              )}
            </div>
          </div>
          {/* Per-platform rows */}
          <div className="flex flex-col gap-3">
            {platforms.map((p, i) => {
              const pct = total > 0 ? Math.round((p.spend / total) * 100) : 0;
              const color = palette[i % palette.length];
              return (
                <div key={p.platform} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[160px_1fr_auto_44px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-sm font-medium text-foreground">{p.platform}</span>
                  </div>
                  <div className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
                    <span className="block h-full rounded-full" style={{ width: `${(p.spend / max) * 100}%`, background: color }} />
                  </div>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">{formatCurrency(p.spend)}</span>
                  <span className="hidden text-right text-sm text-muted-foreground tabular-nums sm:block">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Snap({
  icon: Icon, title, hint, href, children,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={href}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${title} — view details`}
    >
      <Card className="h-full gap-3 py-5 transition-colors hover:bg-accent/40">
        <CardContent className="flex h-full flex-col">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon className="size-[18px]" />
            </span>
            <span className="text-[15px] font-semibold text-foreground">{title}</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            <ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
          <div className="mt-3">{children}</div>
        </CardContent>
      </Card>
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
  const adSpend = data.adSpendByPlatform ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">{data.companyName}</h1>
          {data.clientType === 'managed' && (
            <Badge variant="success" className="text-xs">Managed</Badge>
          )}
        </div>
        <p className="mt-0.5 text-muted-foreground">Client Portal</p>
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
                  <Bar dataKey="leads" fill="#9FE870" radius={[7, 7, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad Spend by Platform — managed clients only (PPL returns an empty array) */}
      {adSpend.length > 0 && (
        <AdSpendByPlatform platforms={adSpend} totalLeads={data.totalLeadsThisMonth} />
      )}

      {/* Your account at a glance */}
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Your account at a glance</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Snap icon={BarChart3} title="Leads" hint={`${data.totalLeadsThisMonth.toLocaleString()} this month`} href="/portal/leads">
            <p className="text-sm text-muted-foreground">{data.totalLeadsAllTime.toLocaleString()} delivered all-time across {data.activeCampaigns} active campaign{data.activeCampaigns === 1 ? '' : 's'}.</p>
          </Snap>

          <Snap icon={FileText} title="Invoices" href="/portal/invoices">
            <div className="text-[22px] font-semibold tabular-nums text-foreground">{formatCurrency(data.totalOutstanding)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Outstanding</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.overdueInvoices > 0 && <Badge variant="destructive" className="text-xs">{data.overdueInvoices} overdue</Badge>}
              {data.pendingInvoices > 0 && <Badge variant="warning" className="text-xs">{data.pendingInvoices} pending</Badge>}
              {data.overdueInvoices === 0 && data.pendingInvoices === 0 && <Badge variant="success" className="text-xs">All settled</Badge>}
            </div>
          </Snap>

          <Snap icon={ShieldCheck} title="Compliance" href="/portal/compliance">
            <p className="text-sm text-muted-foreground">Review your ad-asset compliance checks and approvals.</p>
          </Snap>

          <Snap icon={Megaphone} title="Creatives" href="/portal/creatives">
            <p className="text-sm text-muted-foreground">View and approve the ad creatives running on your campaigns.</p>
          </Snap>

          <Snap icon={ScrollText} title="Agreement" hint={data.agreementSigned ? 'Active' : 'Action needed'} href="/portal/agreement">
            <div className="flex items-center gap-2">
              <Badge variant={data.agreementSigned ? 'success' : 'destructive'} className="text-xs">
                {data.agreementSigned ? 'Signed' : 'Pending'}
              </Badge>
            </div>
          </Snap>

          <Snap icon={UserCog} title="Account" href="/portal/account">
            <p className="text-sm text-muted-foreground">{data.companyName} · {data.clientType === 'managed' ? 'Managed account' : 'Pay-per-lead'}</p>
          </Snap>
        </div>
      </div>
    </div>
  );
}
