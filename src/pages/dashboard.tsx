import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/layouts/page-header';
import { DashboardSkeleton } from '@/components/shared/loading-skeleton';
import { WidgetContainer, WidgetSkeleton } from '@/components/dashboard/widget-container';
import { BankWidget } from '@/components/dashboard/bank-widget';
import { OverdueWidget } from '@/components/dashboard/overdue-widget';
import { VatWidget } from '@/components/dashboard/vat-widget';
import { PnlWidget } from '@/components/dashboard/pnl-widget';
import { CreditAlertWidget } from '@/components/dashboard/credit-alert-widget';
import { NotificationFeed } from '@/components/dashboard/notification-feed';
import { TaskSummaryWidget } from '@/components/dashboard/task-summary-widget';
import { useDashboardStats, useFinancialOverview, useLeadsByDay, useRecentActivity } from '@/lib/hooks/use-dashboard';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
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
const FALLBACK_REVENUE = EMPTY_MONTHS_6.map((month) => ({ month, revenue: 0, expenses: 0 }));
const FALLBACK_INVOICES = EMPTY_MONTHS_6.map((month) => ({ month, paid: 0, overdue: 0, pending: 0 }));

const PIE_PALETTE = ['#171717', '#525252', '#a3a3a3', '#d4d4d4', '#737373', '#404040'];

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

function StatCard({ title, value, change, trend, icon: Icon }: { title: string; value: string; change: string; trend: 'up' | 'down'; icon: React.ElementType }) {
  return (
    <Card className="gap-3 py-5">
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
            <Icon className="size-5 text-neutral-700" />
          </div>
          <div className={`flex min-w-0 items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="size-3 shrink-0" /> : <ArrowDownRight className="size-3 shrink-0" />}
            <span className="truncate">{change}</span>
          </div>
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
  const { data: stats, isLoading } = useDashboardStats();
  const { data: financialOverview } = useFinancialOverview();
  const { data: campaignsData } = useCampaigns({ limit: 100 });
  const { data: leadsByDay } = useLeadsByDay(7);
  const { data: activityFeed } = useRecentActivity(5);

  if (!user) return null;
  if (isLoading || !stats) return <DashboardSkeleton />;

  // Real financial data → revenue/expenses chart + invoice status chart.
  // Falls back to demo data if the user lacks permission (ops_manager/readonly)
  // or the API is empty.
  const revenueData = financialOverview && financialOverview.length > 0
    ? financialOverview.map((r) => ({ month: r.month.split(' ')[0], revenue: r.revenue, expenses: r.expenses }))
    : FALLBACK_REVENUE;

  const invoiceData = financialOverview && financialOverview.length > 0
    ? financialOverview.slice(-6).map((r) => ({
        month: r.month.split(' ')[0],
        paid: r.invoicesPaid,
        overdue: r.invoicesOverdue,
        // Pending isn't in the financial-overview shape; show 0 until BE reports it.
        pending: 0,
      }))
    : FALLBACK_INVOICES;

  // Real campaign-source pie chart — group active campaigns by vertical
  // (Solar, Insurance, Finance, etc.) and show share of leads-this-month.
  const campaignsByVertical = (campaignsData?.campaigns ?? []).reduce<Record<string, number>>((acc, c) => {
    const v = c.vertical || 'Other';
    acc[v] = (acc[v] ?? 0) + (c.leadsThisMonth ?? 0);
    return acc;
  }, {});
  const totalLeadsByVertical = Object.values(campaignsByVertical).reduce((s, n) => s + n, 0);
  const campaignData = totalLeadsByVertical > 0
    ? Object.entries(campaignsByVertical)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, leads], i) => ({
          name,
          value: Math.round((leads / totalLeadsByVertical) * 100),
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
      <PageHeader title="Dashboard" description={`Welcome back, ${user.name}`} />

      {/* Stats — derived from actual API data */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} change={`+${stats.revenueChange}%`} trend="up" icon={DollarSign} />
        <StatCard title="Active Clients" value={String(stats.activeClients)} change={`+${stats.clientChange}`} trend="up" icon={Users} />
        <StatCard title="Active Campaigns" value={String(stats.activeCampaigns)} change={`+${stats.campaignChange}`} trend="up" icon={TrendingUp} />
        <StatCard title="Leads This Month" value={stats.totalLeadsThisMonth.toLocaleString()} change={`+${stats.leadsChange}%`} trend="up" icon={Activity} />
      </div>

      {/* Secondary financial KPIs — matches Leadreports.io top strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Cost" value={formatCurrency(stats.totalCost)} change="supplier payouts" trend="down" icon={CreditCard} />
        <StatCard title="Net Profit" value={formatCurrency(stats.netProfit)} change={`${stats.profitMargin}% margin`} trend={stats.netProfit >= 0 ? 'up' : 'down'} icon={TrendingUp} />
        <StatCard title="Profit Margin" value={`${stats.profitMargin}%`} change={stats.profitMargin >= 30 ? 'healthy' : 'review'} trend={stats.profitMargin >= 30 ? 'up' : 'down'} icon={Activity} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue Overview</CardTitle><CardDescription>Monthly revenue vs expenses (2025)</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#171717" stopOpacity={0.15} /><stop offset="100%" stopColor="#171717" stopOpacity={0} /></linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a3a3a3" stopOpacity={0.1} /><stop offset="100%" stopColor="#a3a3a3" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" /><XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" interval="preserveStartEnd" minTickGap={16} /><YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(value: any) => [`£${Number(value).toLocaleString()}`, '']} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#171717" strokeWidth={2} fill="url(#revenueGrad)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#a3a3a3" strokeWidth={2} fill="url(#expenseGrad)" />
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
          <CardHeader><CardTitle>Campaign Sources</CardTitle><CardDescription>Lead distribution by channel</CardDescription></CardHeader>
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
          <CardHeader><CardTitle>Invoice Status</CardTitle><CardDescription>Monthly breakdown by payment status</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={invoiceData}><CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" /><XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" interval="preserveStartEnd" minTickGap={16} /><YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" /><Tooltip {...tooltipStyle} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} /><Bar dataKey="paid" name="Paid" stackId="a" fill="#171717" /><Bar dataKey="pending" name="Pending" stackId="a" fill="#a3a3a3" /><Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>

      {/* Widgets Row 1: Bank, Overdue, VAT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <WidgetContainer><BankWidget /></WidgetContainer>
        <WidgetContainer><OverdueWidget /></WidgetContainer>
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
