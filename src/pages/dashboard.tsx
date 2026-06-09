import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/layouts/page-header';
import { DashboardSkeleton } from '@/components/shared/loading-skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { WidgetContainer, WidgetSkeleton } from '@/components/dashboard/widget-container';
import { BankWidget } from '@/components/dashboard/bank-widget';
import { InvoicesOwedWidget } from '@/components/dashboard/invoices-owed-widget';
import { VatWidget } from '@/components/dashboard/vat-widget';
import { PnlWidget } from '@/components/dashboard/pnl-widget';
import { CreditAlertWidget } from '@/components/dashboard/credit-alert-widget';
import { NotificationFeed } from '@/components/dashboard/notification-feed';
import { TaskSummaryWidget } from '@/components/dashboard/task-summary-widget';
import {
  useDashboardStats, useFinancialOverview, useLeadsByDay, useRecentActivity,
  DASHBOARD_WINDOW_OPTIONS, type DashboardWindow,
} from '@/lib/hooks/use-dashboard';
import { useCampaigns, type CampaignSummary } from '@/lib/hooks/use-campaigns';
import { toMoney } from '@/lib/hooks/use-invoices';
import { formatPercentCapped } from '@/lib/currency';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, Users, TrendingUp, Activity, ArrowUpRight, ArrowDownRight,
  FileText, CreditCard,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// Empty fallbacks shown ONLY when the API errors or returns nothing
// (e.g. ops_manager/readonly viewing the dashboard, or before any data has
// been generated). Zero-filled so the chart renders flat-and-honest instead
// of pretending there's revenue. Real data comes from /reports/financial-overview.
const EMPTY_MONTHS_6 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
// Same shape as the real series (expenses: number | null, isPartial: boolean)
// so the ternary at use-site doesn't broaden the union and break Recharts'
// generic ChartData<T>.
const FALLBACK_REVENUE: Array<{ month: string; revenue: number; expenses: number | null; isPartial: boolean }> =
  EMPTY_MONTHS_6.map((month) => ({ month, revenue: 0, expenses: 0, isPartial: false }));
// Same shape as the real series (isPartial: boolean) so the ternary at the
// use-site doesn't broaden the union and break the Bar/Tooltip generics.
const FALLBACK_INVOICES: Array<{ month: string; paid: number; overdue: number; pending: number; isPartial: boolean }> =
  EMPTY_MONTHS_6.map((month) => ({ month, paid: 0, overdue: 0, pending: 0, isPartial: false }));

// Statto brand palette — ink → lime → green ramp, then muted greens/greys so a
// 14-slice pie keeps 10+ adjacent wedges distinct without going off-brand rainbow.
const PIE_PALETTE = [
  '#062F28', '#123F36', '#2E5249', '#6E9089', '#A9A9AF', '#C9C9CD',
  '#2A6FDB', '#66B534', '#E8A13A', '#E5575B', '#7A5AE0', '#3E7E8C',
];

const FALLBACK_LEADS_BY_DAY = [
  { day: 'Mon', leads: 0 }, { day: 'Tue', leads: 0 }, { day: 'Wed', leads: 0 },
  { day: 'Thu', leads: 0 }, { day: 'Fri', leads: 0 }, { day: 'Sat', leads: 0 }, { day: 'Sun', leads: 0 },
];

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  invoice: FileText,
  agreement: FileText,
  credit: Users,
  system: Activity,
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Components ───

function StatCard({ title, value, change, trend, icon: Icon }: { title: string; value: string; change: string | null; trend: 'up' | 'down' | 'neutral'; icon: React.ElementType }) {
  // Neutral trend → the `change` string is a label (e.g. data source) not a
  // delta; render grey with no arrow so the user doesn't read it as up/down.
  const colorClass = trend === 'up' ? 'text-positive' : trend === 'down' ? 'text-negative' : 'text-muted-foreground';
  return (
    <Card className="gap-3 py-5">
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted">
            <Icon className="size-5 text-foreground" />
          </div>
          {change !== null && (
            <div className={`flex min-w-0 items-center gap-1 text-xs font-medium ${colorClass}`}>
              {trend === 'up' && <ArrowUpRight className="size-3 shrink-0" />}
              {trend === 'down' && <ArrowDownRight className="size-3 shrink-0" />}
              <span className="truncate">{change}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="truncate text-[34px] font-semibold leading-none tracking-[-0.025em] tabular-nums text-foreground">{value}</p>
          <p className="mt-2 truncate text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function statusVariant(status: string) {
  switch (status) {
    case 'paid': return 'default' as const;
    case 'overdue': return 'destructive' as const;
    case 'sent': case 'draft': return 'outline' as const;
    default: return 'secondary' as const;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function tooltipStyleFor(dark: boolean) {
  const fg = dark ? '#EAF3EF' : '#062F28';
  return {
    contentStyle: {
      backgroundColor: dark ? '#123F36' : '#fff',
      border: `1px solid ${dark ? '#2E5249' : '#E3E3E6'}`,
      borderRadius: '12px', fontSize: '12px', fontFamily: 'Poppins, sans-serif',
      color: fg,
      boxShadow: dark ? '0 6px 20px rgba(0,0,0,0.45)' : '0 6px 20px rgba(6,47,40,0.06)',
    },
    labelStyle: { color: fg },
    itemStyle: { color: fg },
  };
}

// ─── Page ───

export function DashboardPage() {
  const { user } = useAuth();
  // Ink chart series (revenue line, paid bar) must flip to a light colour in
  // dark mode or it vanishes against the dark-green card.
  const { resolvedTheme } = useTheme();
  const inkSeries = resolvedTheme === 'dark' ? '#EAF3EF' : '#062F28';
  const tooltipStyle = tooltipStyleFor(resolvedTheme === 'dark');
  // Donut: the leading ink wedge flips to a light tone in dark mode so the
  // largest slice doesn't vanish against the dark-green card.
  const piePalette = resolvedTheme === 'dark' ? ['#EAF3EF', ...PIE_PALETTE.slice(1)] : PIE_PALETTE;
  // Top-of-dashboard window filter. Drives the Leads tile + its trend chip
  // server-side (BE swaps the date range based on this key). Other tiles
  // (Total Revenue, Net Profit, Margin, Campaigns, Bank/VAT/etc widgets)
  // intentionally keep their own windows — see the comments on those tiles
  // for the rationale.
  // Default 'last_year' preserves the dashboard's prior first-paint numbers
  // (~£734k revenue, -4.1% margin) given Catchr/Xero histories. Users pick
  // shorter windows from the dropdown to scope every value tile + the pie
  // chart to that range.
  const [leadsWindow, setLeadsWindow] = useState<DashboardWindow>('last_year');
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats({ window: leadsWindow });
  // Revenue Overview chart now respects the same window — the BE returns
  // 3 / 6 / 12 monthly buckets depending on which option is selected.
  const { data: financialOverview } = useFinancialOverview({ window: leadsWindow });
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ limit: 100 });
  const { data: leadsByDay } = useLeadsByDay(7);
  const { data: activityFeed } = useRecentActivity(5);

  // Invoice Status chart filter — toggle each status independently. Defaults
  // to all-on so the chart renders the full picture on first paint; clicking
  // a chip hides that bar segment so users can focus on a single status
  // (e.g. just Overdue) without re-rendering the whole chart.
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<{ paid: boolean; pending: boolean; overdue: boolean }>({
    paid: true,
    pending: true,
    overdue: true,
  });

  // Index of the legend item the user is hovering — used to dim other pie
  // slices so the matching slice pops out. null = no hover, full opacity.
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Animate the pie on first paint only. Recharts re-runs the slice-grow
  // animation whenever it re-renders with isAnimationActive=true, which
  // means every legend hover would re-trigger the entrance animation and
  // stutter the dim. Freeze it after the default 1500ms entrance window.
  const [pieAnimationActive, setPieAnimationActive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setPieAnimationActive(false), 1500);
    return () => clearTimeout(t);
  }, []);
  const toggleStatus = (key: 'paid' | 'pending' | 'overdue') => {
    setInvoiceStatusFilter((s) => {
      const next = { ...s, [key]: !s[key] };
      // Never let the user disable every series — leave at least one on so
      // the chart isn't a blank rectangle. If they tried to toggle off the
      // last visible one, no-op.
      if (!next.paid && !next.pending && !next.overdue) return s;
      return next;
    });
  };

  if (!user) return null;
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !stats) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Dashboard" description={`Welcome back, ${user.name}`} />
        <ErrorState
          title="Couldn't load dashboard"
          description="We couldn't fetch your stats. Check your connection and try again."
          error={error}
          onRetry={() => refetch()}
          size="page"
        />
      </div>
    );
  }

  // Real financial data → revenue/expenses chart + invoice status chart.
  // Falls back to demo data if the user lacks permission (ops_manager/readonly)
  // or the API is empty.
  //
  // r.expenses is `null` for months pre-Catchr-connection — pass it through
  // (Recharts AreaChart skips nulls so the line draws a gap rather than a
  // misleading flat-zero floor). r.isPartial marks the current incomplete
  // month so the consumer can dash-stroke / fade it; for now we leave the
  // visual treatment to the eye + tooltip "(partial)" suffix below.
  const revenueData = financialOverview && financialOverview.length > 0
    ? financialOverview.map((r) => ({
        month: r.month.split(' ')[0],
        revenue: r.revenue,
        expenses: r.expenses ?? null,
        isPartial: r.isPartial ?? false,
      }))
    : FALLBACK_REVENUE;

  // Invoice Status chart uses the same financialOverview series — no extra
  // BE call — so it inherits the window automatically (3 / 6 / 12 bars).
  // The previous `.slice(-6)` cap is gone; for Last 12 months the chart
  // now shows 12 stacked bars, for Last 6 it shows 6, for short windows 3.
  const invoiceData = financialOverview && financialOverview.length > 0
    ? financialOverview.map((r) => ({
        month: r.month.split(' ')[0],
        paid: r.invoicesPaid,
        overdue: r.invoicesOverdue,
        // BE now returns pending = anything that's not paid and not overdue
        // (drafts, sent, due-but-not-late). Older snapshots may omit it, so
        // fall back to 0 for safety.
        pending: r.invoicesPending ?? 0,
        isPartial: r.isPartial ?? false,
      }))
    : FALLBACK_INVOICES;

  // Real campaign-source pie chart — group active campaigns by vertical
  // (Solar, Hearing Aids, Insulation, etc.) and show share of leads in
  // the currently-selected dashboard window.
  //
  // The BE caches /reports/campaign for today/this_week/this_month/
  // last_month/ytd already, so leadsThisWeek / leadsThisMonth /
  // leadsLastMonth ride along on every CampaignSummary. For windows
  // LeadByte doesn't preset (last_90d, last_6m, last_year) we fall back
  // to totalLeads (the campaign's best-available cumulative count) so
  // the chart never goes blank when a long window is selected.
  const pieFieldForWindow = (c: CampaignSummary): number => {
    switch (leadsWindow) {
      case 'this_week': return c.leadsThisWeek ?? 0;
      case 'this_month': return c.leadsThisMonth ?? 0;
      case 'last_month': return c.leadsLastMonth ?? 0;
      case 'last_90d':
      case 'last_6m':
      case 'last_year':
      default:
        return c.totalLeads ?? 0;
    }
  };
  const pieWindowLabel = stats.leadsWindowLabel ?? 'This month';
  const campaignsByVertical = (campaignsData?.campaigns ?? []).reduce<Record<string, number>>((acc, c) => {
    const v = c.vertical || 'Other';
    acc[v] = (acc[v] ?? 0) + pieFieldForWindow(c);
    return acc;
  }, {});
  const totalLeadsByVertical = Object.values(campaignsByVertical).reduce((s, n) => s + n, 0);
  // Show every vertical that has at least one lead this month. Was capped at
  // top 6 which hid Sam's smaller categories (Will Writing, PMI, PCP Claims,
  // etc.) — with 14 verticals running, the cap collapsed the long tail into
  // an invisible bucket. value carries 1 decimal so a 0.4%-of-total slice
  // doesn't round to 0% in the legend.
  const campaignData = totalLeadsByVertical > 0
    ? Object.entries(campaignsByVertical)
        .filter(([, leads]) => leads > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([name, leads], i) => ({
          name,
          leads,
          value: Math.round((leads / totalLeadsByVertical) * 1000) / 10,
          color: piePalette[i % piePalette.length],
        }))
    : [
        { name: 'No data', leads: 0, value: 100, color: '#e5e5e5' },
      ];

  // Daily leads chart — real data from /api/v1/dashboard/leads-by-day.
  // Fallback to zeros until first data lands so the chart still renders.
  const leadsData = leadsByDay && leadsByDay.length > 0
    ? leadsByDay.map((p) => ({ day: p.day, leads: p.leads }))
    : FALLBACK_LEADS_BY_DAY;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Dashboard" description={`Welcome back, ${user.name}`} />
        {/* Time-range filter — drives every value tile on this page
            (Revenue, Ad Spend, Net Profit, Margin, Leads) plus the
            Campaign Sources pie chart's data window. Counts (Active
            Clients, Campaigns) and the long-running charts (Revenue
            Overview, Invoice Status) keep their own scopes because
            they're context views rather than period KPIs.
            Default 'last_year' keeps first-paint numbers close to the
            prior dashboard (~£734k revenue / -4.1% margin). */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Time range:</span>
          <select
            value={leadsWindow}
            onChange={(e) => setLeadsWindow(e.target.value as DashboardWindow)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {DASHBOARD_WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Stats — derived from actual API data */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Revenue — ${stats.leadsWindowLabel ?? 'Last 12 months'}`}
          value={formatCurrency(stats.totalRevenue)}
          change={
            stats.revenueChange !== null
              ? `${formatPercentCapped(stats.revenueChange, { showSign: true })} vs prior period`
              : null
          }
          trend={(stats.revenueChange ?? 0) >= 0 ? 'up' : 'down'}
          icon={DollarSign}
        />
        <StatCard
          title="Active Clients"
          value={String(stats.activeClients)}
          change={
            stats.clientChange !== null
              ? `${stats.clientChange >= 0 ? '+' : ''}${stats.clientChange} vs prior period`
              : null
          }
          trend={stats.clientChange === null ? 'neutral' : stats.clientChange >= 0 ? 'up' : 'down'}
          icon={Users}
        />
        {/*
          Campaigns: show "linked / total" so Sam sees both — how many
          campaigns are running on LeadByte (total active) AND how many
          contribute to Stato's per-client P&L (linked). Two-thirds of
          his LeadByte campaigns are unmapped to clients right now, so
          showing only the total made the dashboard look inflated.
        */}
        <StatCard
          title="Campaigns (linked / active)"
          value={`${stats.linkedCampaigns ?? '–'} / ${stats.activeCampaigns}`}
          change={
            stats.campaignChange !== null
              ? `${stats.campaignChange >= 0 ? '+' : ''}${stats.campaignChange} vs prior period`
              : null
          }
          trend={stats.campaignChange === null ? 'neutral' : stats.campaignChange >= 0 ? 'up' : 'down'}
          icon={TrendingUp}
        />
        <StatCard
          title={`Leads — ${stats.leadsWindowLabel ?? 'This month'}`}
          value={stats.totalLeadsThisMonth.toLocaleString()}
          change={
            stats.leadsChange !== null
              ? `${formatPercentCapped(stats.leadsChange, { showSign: true })} vs prior period`
              : null
          }
          trend={(stats.leadsChange ?? 0) >= 0 ? 'up' : 'down'}
          icon={Activity}
        />
      </div>

      {/* Secondary financial KPIs — all scoped to the same window as the
          tiles above. For 'last_year' (default) the numbers match the
          prior dashboard. Shorter windows show period-specific values;
          the ad-spend → lead → invoice → paid cycle (~30-60 days) means
          short windows often look heavily negative on margin — that's
          accurate, not a bug. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={`Ad Spend — ${stats.leadsWindowLabel ?? 'Last 12 months'}`}
          value={formatCurrency(stats.totalCost)}
          change="Catchr — Google + FB + TikTok"
          trend="neutral"
          icon={CreditCard}
        />
        <StatCard
          title="Net Profit — rolling 12mo / 90d"
          value={formatCurrency(stats.netProfit)}
          change={`${formatPercentCapped(stats.profitMargin)} margin · period-coherent`}
          trend={stats.netProfit >= 0 ? 'up' : 'down'}
          icon={TrendingUp}
        />
        <StatCard
          title="Margin — rolling 12mo / 90d"
          value={formatPercentCapped(stats.profitMargin)}
          change={stats.profitMargin >= 30 ? 'healthy' : stats.profitMargin >= 0 ? 'review' : 'loss-making'}
          trend={stats.profitMargin >= 30 ? 'up' : stats.profitMargin >= 0 ? 'neutral' : 'down'}
          icon={Activity}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>
              Monthly revenue (Xero) vs ad spend (Catchr) — {stats.leadsWindowLabel ?? 'Last 12 months'}.
              Spend line starts when Catchr was connected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {/* Axis style matches the Invoice Status chart: every month rendered
                    via interval=0 + diagonal -45° labels, so JUN/AUG don't get
                    culled by minTickGap on narrow widths. */}
                <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={inkSeries} stopOpacity={0.15} /><stop offset="100%" stopColor={inkSeries} stopOpacity={0} /></linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#84D451" stopOpacity={0.18} /><stop offset="100%" stopColor="#84D451" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="#a3a3a3"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value: unknown, name: unknown) => {
                      if (value === null || value === undefined) return ['—', String(name)];
                      return [`£${Number(value).toLocaleString()}`, String(name)];
                    }}
                    labelFormatter={(label, payload) => {
                      const partial = Array.isArray(payload) && payload[0]?.payload?.isPartial;
                      return partial ? `${label} (month-to-date)` : String(label);
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {/* connectNulls=false → expenses line breaks for pre-Catchr months
                      (rather than drawing a misleading flat-zero floor). */}
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={inkSeries} strokeWidth={2} fill="url(#revenueGrad)" />
                  <Area type="monotone" dataKey="expenses" name="Ad Spend" stroke="#84D451" strokeWidth={2} fill="url(#expenseGrad)" connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
        <WidgetContainer>
        <Card>
          <CardHeader><CardTitle>Leads This Week</CardTitle><CardDescription>Daily lead volume</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[300px]">
              {/* Axis style matches Invoice Status / Revenue Overview:
                  diagonal -45° day labels for full visual consistency
                  across the dashboard chart row, even though 7 ticks
                  would fit horizontally. */}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    stroke="#a3a3a3"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="leads" name="Leads" fill="#9FE870" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer>
        <Card>
          <CardHeader>
            <CardTitle>Campaign Sources</CardTitle>
            <CardDescription>Lead distribution by channel — {pieWindowLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              // Skeleton while React Query fetches /campaigns. Without this
              // the chart momentarily renders the "No data 100%" fallback on
              // first paint (campaignsData === undefined → empty reduce →
              // totalLeadsByVertical === 0). Match the rest of the dashboard's
              // loading shells so the page doesn't flash a misleading state.
              <>
                <div className="h-[180px] sm:h-[240px] flex items-center justify-center">
                  <Skeleton className="size-32 sm:size-40 rounded-full" />
                </div>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-1.5 py-1">
                      <Skeleton className="size-2.5 rounded-full" />
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="h-[180px] sm:h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={campaignData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                        isAnimationActive={pieAnimationActive}
                      >
                        {campaignData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={entry.color}
                            fillOpacity={activePieIndex === null || activePieIndex === i ? 1 : 0.3}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value, _name, item) => {
                          const payload = (item as { payload?: { name?: string; leads?: number } } | undefined)?.payload;
                          // Empty-state placeholder slice — don't render the
                          // misleading "100% · 0 leads"; show an honest label.
                          if (payload?.name === 'No data') {
                            return ['No leads in this period', ''];
                          }
                          return [
                            `${value}% · ${(payload?.leads ?? 0).toLocaleString()} leads`,
                            payload?.name ?? '',
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                  {campaignData.map((item, i) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-muted/40"
                      onMouseEnter={() => setActivePieIndex(i)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
                      <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-xs text-muted-foreground" title={item.name}>{item.name}</span>
                      <span className="ml-auto text-xs font-medium tabular-nums text-foreground whitespace-nowrap">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </WidgetContainer>
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Invoice Status</CardTitle>
                <CardDescription>
                  Monthly breakdown by payment status — {stats.leadsWindowLabel ?? 'Last 12 months'}. Click a chip to filter.
                </CardDescription>
              </div>
              {/* Status filter chips. Tap to toggle each bar segment.
                  At least one stays on (guarded in toggleStatus). */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: 'paid', label: 'Paid', dot: inkSeries },
                  { key: 'pending', label: 'Pending', dot: '#a3a3a3' },
                  { key: 'overdue', label: 'Overdue', dot: '#E5575B' },
                ] as const).map(({ key, label, dot }) => {
                  const on = invoiceStatusFilter[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleStatus(key)}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: dot, opacity: on ? 1 : 0.4 }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  {/* Diagonal labels (-45°) + interval=0 so every month renders.
                      Previously interval="preserveStartEnd"+minTickGap=16 culled
                      JUN/AUG at the dashboard's typical chart width. -45° (rather
                      than full vertical -90°) is what Recharts aligns to the tick
                      line cleanly by default — full vertical leaves the label
                      visibly offset from its tick. height=55 reserves vertical
                      room for the angled 3-char month abbreviations. */}
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="#a3a3a3"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(label, payload) => {
                      const partial = Array.isArray(payload) && payload[0]?.payload?.isPartial;
                      return partial ? `${label} (month-to-date)` : String(label);
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {invoiceStatusFilter.paid && <Bar dataKey="paid" name="Paid" stackId="a" fill={inkSeries} />}
                  {invoiceStatusFilter.pending && <Bar dataKey="pending" name="Pending" stackId="a" fill="#a3a3a3" />}
                  {invoiceStatusFilter.overdue && <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#E5575B" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>

      {/* Widgets Row 1: Bank, Overdue, VAT.
          T3 slice 2 (Sam, 2026-05-20): add md:grid-cols-2 so tablet portrait
          (768-1023px) shows a 2-up layout instead of one full-width widget
          per row. Mobile stays 1-col; lg+ stays 3-col (desktop unchanged). */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <WidgetContainer><BankWidget /></WidgetContainer>
        <WidgetContainer><InvoicesOwedWidget /></WidgetContainer>
        <WidgetContainer><VatWidget /></WidgetContainer>
      </div>

      {/* Widgets Row 2: P&L, Credit Alerts, Notifications */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <WidgetContainer><PnlWidget /></WidgetContainer>
        <WidgetContainer><CreditAlertWidget /></WidgetContainer>
        <WidgetContainer><NotificationFeed /></WidgetContainer>
      </div>

      {/* Task Summary Widget */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer><TaskSummaryWidget /></WidgetContainer>
      </div>

      {/* Recent Invoices (from API) + Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-4" height="h-[350px]" />}>
        <Card className="lg:col-span-4">
          <CardHeader><CardTitle>Recent Invoices</CardTitle><CardDescription>Latest billing activity</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stats.recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell><div><div className="font-medium">{inv.invoiceNumber}</div><div className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</div></div></TableCell>
                      <TableCell className="font-medium">{inv.clientName}</TableCell>
                      <TableCell><Badge variant={statusVariant(inv.status)} className="capitalize">{inv.status}{inv.daysOverdue > 0 ? ` (${inv.daysOverdue}d)` : ''}</Badge></TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: inv.currency }).format(toMoney(inv.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-3" height="h-[350px]" />}>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Recent Activity</CardTitle><CardDescription>Latest actions across the system</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-5">
              {(activityFeed ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity yet — invoices, agreements, and credit checks will appear here.</p>
              ) : (
                (activityFeed ?? []).map((item) => {
                  const Icon = ACTIVITY_ICON[item.category] ?? Activity;
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5"><Icon className="size-4 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium leading-none">{item.user}</p><p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.action}</p></div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>
    </div>
  );
}
