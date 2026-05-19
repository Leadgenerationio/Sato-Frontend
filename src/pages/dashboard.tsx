import { useState } from 'react';
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
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

// 12-colour palette so 10+ vertical slices stay visually distinct. Greys
// (matching the rest of the dashboard) take the lead colours; muted accents
// fill in the long tail so a 14-slice pie doesn't have two adjacent
// identical-looking wedges.
const PIE_PALETTE = [
  '#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4',
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4',
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

function StatCard({ title, value, change, trend, icon: Icon }: { title: string; value: string; change: string | null; trend: 'up' | 'down'; icon: React.ElementType }) {
  return (
    <Card className="gap-3 py-5">
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
            <Icon className="size-5 text-neutral-700" />
          </div>
          {change !== null && (
            <div className={`flex min-w-0 items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend === 'up' ? <ArrowUpRight className="size-3 shrink-0" /> : <ArrowDownRight className="size-3 shrink-0" />}
              <span className="truncate">{change}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="truncate text-2xl font-bold tabular-nums text-neutral-900">{value}</p>
          <p className="mt-0.5 truncate text-sm text-neutral-500">{title}</p>
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

const tooltipStyle = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
};

// ─── Page ───

export function DashboardPage() {
  const { user } = useAuth();
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
  const { data: financialOverview } = useFinancialOverview();
  const { data: campaignsData } = useCampaigns({ limit: 100 });
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

  const invoiceData = financialOverview && financialOverview.length > 0
    ? financialOverview.slice(-6).map((r) => ({
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
          value: Math.round((leads / totalLeadsByVertical) * 1000) / 10,
          color: PIE_PALETTE[i % PIE_PALETTE.length],
        }))
    : [
        { name: 'No data', value: 100, color: '#e5e5e5' },
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
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="hidden sm:inline">Time range:</span>
          <select
            value={leadsWindow}
            onChange={(e) => setLeadsWindow(e.target.value as DashboardWindow)}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
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
              ? `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}% vs prior period`
              : null
          }
          trend={(stats.revenueChange ?? 0) >= 0 ? 'up' : 'down'}
          icon={DollarSign}
        />
        <StatCard title="Active Clients" value={String(stats.activeClients)} change={stats.clientChange !== null ? `+${stats.clientChange}` : null} trend="up" icon={Users} />
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
          change={stats.campaignChange !== null ? `+${stats.campaignChange}` : null}
          trend="up"
          icon={TrendingUp}
        />
        <StatCard
          title={`Leads — ${stats.leadsWindowLabel ?? 'This month'}`}
          value={stats.totalLeadsThisMonth.toLocaleString()}
          change={
            stats.leadsChange !== null
              ? `${stats.leadsChange >= 0 ? '+' : ''}${stats.leadsChange}% vs prior period`
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
          trend="down"
          icon={CreditCard}
        />
        <StatCard
          title={`Net Profit — ${stats.leadsWindowLabel ?? 'Last 12 months'}`}
          value={formatCurrency(stats.netProfit)}
          change={`${stats.profitMargin}% margin`}
          trend={stats.netProfit >= 0 ? 'up' : 'down'}
          icon={TrendingUp}
        />
        <StatCard
          title={`Margin — ${stats.leadsWindowLabel ?? 'Last 12 months'}`}
          value={`${stats.profitMargin}%`}
          change={stats.profitMargin >= 30 ? 'healthy' : 'review'}
          trend={stats.profitMargin >= 30 ? 'up' : 'down'}
          icon={Activity}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue Overview</CardTitle><CardDescription>Monthly revenue (Xero) vs ad spend (Catchr) — last 12 months. Spend line starts when Catchr was connected.</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#171717" stopOpacity={0.15} /><stop offset="100%" stopColor="#171717" stopOpacity={0} /></linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a3a3a3" stopOpacity={0.1} /><stop offset="100%" stopColor="#a3a3a3" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" /><XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" interval="preserveStartEnd" minTickGap={16} /><YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
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
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#171717" strokeWidth={2} fill="url(#revenueGrad)" />
                  <Area type="monotone" dataKey="expenses" name="Ad Spend" stroke="#a3a3a3" strokeWidth={2} fill="url(#expenseGrad)" connectNulls={false} />
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
              <ResponsiveContainer width="100%" height="100%"><BarChart data={leadsData}><CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" /><XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#a3a3a3" /><YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" /><Tooltip {...tooltipStyle} /><Bar dataKey="leads" name="Leads" fill="#171717" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
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
            <div className="h-[180px] sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={campaignData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">{campaignData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip {...tooltipStyle} formatter={(value: any) => [`${value}%`, '']} /></PieChart></ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-3 mt-2 sm:grid-cols-2">{campaignData.map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} /><span className="truncate text-xs text-neutral-600">{item.name}</span><span className="ml-auto text-xs font-medium tabular-nums text-neutral-900">{item.value}%</span></div>))}</div>
          </CardContent>
        </Card>
        </WidgetContainer>
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Invoice Status</CardTitle>
                <CardDescription>Monthly breakdown by payment status — click a chip to filter</CardDescription>
              </div>
              {/* Status filter chips. Tap to toggle each bar segment.
                  At least one stays on (guarded in toggleStatus). */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: 'paid', label: 'Paid', dot: '#171717' },
                  { key: 'pending', label: 'Pending', dot: '#a3a3a3' },
                  { key: 'overdue', label: 'Overdue', dot: '#ef4444' },
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
                          : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
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
                <BarChart data={invoiceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(label, payload) => {
                      const partial = Array.isArray(payload) && payload[0]?.payload?.isPartial;
                      return partial ? `${label} (month-to-date)` : String(label);
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  {invoiceStatusFilter.paid && <Bar dataKey="paid" name="Paid" stackId="a" fill="#171717" />}
                  {invoiceStatusFilter.pending && <Bar dataKey="pending" name="Pending" stackId="a" fill="#a3a3a3" />}
                  {invoiceStatusFilter.overdue && <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>

      {/* Widgets Row 1: Bank, Overdue, VAT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer><BankWidget /></WidgetContainer>
        <WidgetContainer><InvoicesOwedWidget /></WidgetContainer>
        <WidgetContainer><VatWidget /></WidgetContainer>
      </div>

      {/* Widgets Row 2: P&L, Credit Alerts, Notifications */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 mt-0.5"><Icon className="size-4 text-neutral-600" /></div>
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
